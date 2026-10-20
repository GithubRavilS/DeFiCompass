/**
 * Rebuild stable_raw_dump:
 *  A–Q = exact ethereum headers + filled per platform rules
 *  R+  = raw/extra API fields
 *
 * NEVER touches ethereum (IMPORTRANGE spill).
 *
 * node scripts/rebuild-stable-raw-dump.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { STABLE_WALLETS, formatOpenDate, daysSince } from "../lib/stable-battle-sync.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPREADSHEET_ID = "1ZrMaFUyrHmxldFG242OsKHLOWPxhI4H8vCxO-TvL9Zg";
const SHEET = "stable_raw_dump";
const CRED = path.join(__dirname, "..", "pusher-490008-bf7c384ba372.json");

/** A–Q exactly like ethereum */
const MAIN_HEADERS = [
  "Платформа",
  "Мин диапазона",
  "Макс диапазон",
  "Дата открытия норм",
  "Заработано стейблов",
  "Заработано ETH",
  "Заработано CAKE/AERO",
  "Итого комс доход",
  "Пара",
  "Блокчейн",
  "fee_tier",
  "APR",
  "APY",
  "Ссылка на позицию",
  "Инвестировано",
  "Статус",
  "Битва",
];

/** R+ extras */
const EXTRA_HEADERS = [
  "Текущая стоимость USD",
  "Стоимость входа USD",
  "Дней в работе",
  "Дней до экспирации (open→expiry)",
  "Дата экспирации",
  "Locked yield % (face/cost-1)",
  "PT face (nominal)",
  "PT valuation now",
  "Purchase cost on-chain",
  "Supply USD",
  "Borrow USD",
  "Equity USD",
  "Open date ISO",
  "Expiry ISO",
  "Wallet",
  "PosKey / NFT id",
  "Protocol APR (raw)",
  "Staking APR (raw)",
  "Borrow rate bps",
  "Source note",
  "Raw JSON (кратко)",
];

const HEADERS = [...MAIN_HEADERS, ...EXTRA_HEADERS];

const auth = new google.auth.GoogleAuth({
  keyFile: CRED,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

function safeCell(val) {
  if (val == null || val === "") return "";
  if (typeof val === "number") return isFinite(val) ? Number(Number(val).toFixed(8)) : "";
  let s = String(val);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function num(v, digits = 6) {
  if (v == null || v === "" || !isFinite(Number(v))) return "";
  return Number(Number(v).toFixed(digits));
}

function pct(v, digits = 4) {
  if (v == null || v === "" || !isFinite(Number(v))) return "";
  return Number(Number(v).toFixed(digits));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "User-Agent": "DeFi-Compass/1.0", ...(options.headers || {}) },
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function fromWei(amount, decimals = 18) {
  return Number(amount) / 10 ** decimals;
}

function chainName(id) {
  const m = {
    1: "Ethereum",
    8453: "Base",
    42161: "Arbitrum",
    9745: "Plasma",
    999: "HyperEVM",
    56: "BNB",
    143: "Monad",
  };
  return m[id] || m[String(id)] || `chain:${id}`;
}

function isStableSym(sym) {
  const s = String(sym || "").toUpperCase();
  if (/^(ETH|WETH|BTC|WBTC|CBBTC|STETH|WSTETH|AVLT|PAXG|XAUT|GOLD|HYPE)$/i.test(s)) return false;
  return /(USD|DAI|GHO|FRAX|LUSD|USDS|USDE|SUSDAI|SYRUP|AUSD|CRVUSD|TUSD|USDT0|USDC)/i.test(s);
}

async function ethBalanceOf(rpc, token, wallet) {
  const u = wallet.toLowerCase().replace("0x", "");
  const body = await fetchJson(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: token, data: "0x70a08231000000000000000000000000" + u }, "latest"],
    }),
  });
  const hex = body?.result;
  if (!hex || hex === "0x" || hex.length > 66) return 0n;
  return BigInt(hex);
}

/** Build one output row: main[17] + extra[...] */
function buildRow(main, extra) {
  const row = Array(HEADERS.length).fill("");
  for (let i = 0; i < 17; i++) row[i] = safeCell(main[i] ?? "");
  for (let i = 0; i < EXTRA_HEADERS.length; i++) row[17 + i] = safeCell(extra[i] ?? "");
  return row;
}

async function collectHyperliquid() {
  const out = [];
  for (const wallet of STABLE_WALLETS) {
    const list = await fetchJson("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "userVaultEquities", user: wallet }),
    });
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const vault = item.vaultAddress;
      if (!vault) continue;
      const details = await fetchJson("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "vaultDetails", vaultAddress: vault, user: wallet }),
      });
      const fs = details?.followerState;
      const equity = Number(item.equity || fs?.vaultEquity || 0);
      if (!(equity > 0)) continue;
      const pnl = Number(fs?.pnl || 0);
      const invested = equity - pnl;
      const openMs = fs?.vaultEntryTime ? Number(fs.vaultEntryTime) : null;
      // HL: APR = growth to today / invested, NO annualize. APY = APR
      const apr = invested > 0 ? (pnl / invested) * 100 : 0;

      out.push(
        buildRow(
          [
            "Hyperliquid",
            "",
            "",
            formatOpenDate(openMs),
            num(pnl, 6),
            "",
            "",
            num(pnl, 6),
            "USDC",
            "Hyperliquid",
            "",
            pct(apr),
            pct(apr),
            `https://app.hyperliquid.xyz/vaults/${vault}`,
            num(equity, 6),
            "active",
            "Stablecoins",
          ],
          [
            num(equity, 6),
            num(invested, 6),
            daysSince(openMs),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            num(equity, 6),
            openMs ? new Date(openMs).toISOString() : "",
            "",
            wallet,
            `HL:${vault}:${wallet}`,
            pct(apr),
            "",
            "",
            "HL: APR=pnl/invested (без экстраполяции на 365д); APY=APR",
            JSON.stringify({ equity, pnl, vaultEntryTime: fs?.vaultEntryTime }).slice(0, 800),
          ],
        ),
      );
    }
  }
  return out;
}

async function collectPendle() {
  const out = [];
  const markets = {};
  for (const active of [true, false]) {
    const data = await fetchJson(
      `https://api-v2.pendle.finance/core/v1/markets/all?isActive=${active}`,
    );
    for (const m of data?.markets || []) {
      if (m.address) markets[m.address.toLowerCase()] = m;
    }
  }
  for (const chainId of [1, 42161, 8453, 56, 999]) {
    for (const kind of ["active", "inactive"]) {
      const data = await fetchJson(
        `https://api-v2.pendle.finance/core/v1/${chainId}/markets/${kind}`,
      );
      for (const m of data?.markets || []) {
        if (m.address) markets[m.address.toLowerCase()] = m;
      }
    }
  }

  const blockscout = {
    1: "https://eth.blockscout.com",
    42161: "https://arbitrum.blockscout.com",
    8453: "https://base.blockscout.com",
    999: "https://www.hyperscan.com",
  };

  for (const wallet of STABLE_WALLETS) {
    const payload = await fetchJson(
      `https://api-v2.pendle.finance/core/v1/dashboard/positions/database/${wallet}`,
    );
    for (const chainEntry of payload?.positions || []) {
      const chainId = chainEntry.chainId;
      const allOps = [...(chainEntry.openPositions || []), ...(chainEntry.closedPositions || [])];
      for (const op of allOps) {
        const marketId = String(op.marketId || "");
        const [, marketAddress] = marketId.split("-");
        const meta = markets[marketAddress?.toLowerCase()];
        const pt = op.pt || {};
        const face = fromWei(BigInt(pt.balance || 0), 18);
        const valuation = Number(pt.valuation || 0);
        if (face <= 0 && valuation <= 0) continue;

        let purchaseCost = 0;
        let openMs = null;
        let ptAmt = face;
        const ptToken = meta?.pt ? String(meta.pt).split("-").slice(1).join("-") : "";
        const base = blockscout[chainId];
        if (base && ptToken) {
          const transfers = await fetchJson(
            `${base}/api/v2/addresses/${wallet.toLowerCase()}/token-transfers?type=ERC-20&token=${ptToken}`,
          );
          const inbound = (transfers?.items || []).find(
            (t) => t.to?.hash?.toLowerCase() === wallet.toLowerCase(),
          );
          if (inbound) {
            openMs = inbound.timestamp ? new Date(inbound.timestamp).getTime() : null;
            ptAmt = Number(inbound.total?.value || 0) / 10 ** Number(inbound.token?.decimals || 18);
            const txData = await fetchJson(
              `${base}/api/v2/transactions/${inbound.transaction_hash}/token-transfers`,
            );
            for (const x of txData?.items || []) {
              if (x.from?.hash?.toLowerCase() !== wallet.toLowerCase()) continue;
              const sym = x.token?.symbol || "";
              if (!isStableSym(sym) && !/^(REUSDE|SUSDAI|SY-)/i.test(sym)) continue;
              purchaseCost += Number(x.total?.value || 0) / 10 ** Number(x.token?.decimals || 18);
            }
          }
        }
        if (!(purchaseCost > 0)) purchaseCost = valuation > 0 ? valuation : 0;
        if (!(purchaseCost > 0) || !(ptAmt > 0)) continue;

        const expiryMs = meta?.expiry ? new Date(meta.expiry).getTime() : 0;
        const expired = expiryMs > 0 && expiryMs < Date.now();
        const lockedPct = (ptAmt / purchaseCost - 1) * 100;
        // Pendle: period = open → expiry, then annualize to 365d
        let daysOpenToExpiry = 0;
        if (openMs > 0 && expiryMs > openMs) {
          daysOpenToExpiry = Math.max(1, Math.floor((expiryMs - openMs) / 86400000));
        } else if (expiryMs > Date.now()) {
          daysOpenToExpiry = Math.max(1, Math.floor((expiryMs - Date.now()) / 86400000));
        }
        const apr = daysOpenToExpiry > 0 ? lockedPct * (365 / daysOpenToExpiry) : lockedPct;
        const apy = apr; // APY = APR for Pendle

        const name = meta?.name ? `PT-${meta.name}` : `PT-${(marketAddress || "").slice(0, 8)}`;
        const pair = meta?.expiry ? `${name}-${String(meta.expiry).slice(0, 10)}` : name;
        const cat = (meta?.categoryIds || []).join(",");
        const isStable =
          cat.includes("stables") ||
          /usd|dai|susdai|reusd|syrup|ausd|limusd/i.test(meta?.name || pair);
        const isNonStable = /avlt|hype|eth|btc|gold/i.test(meta?.name || pair);
        const battle = isStable && !isNonStable ? "Stablecoins" : "Pendle-other";
        const earned = valuation - purchaseCost;

        out.push(
          buildRow(
            [
              "Pendle V2",
              "",
              "",
              formatOpenDate(openMs),
              num(earned, 6),
              "",
              "",
              num(earned, 6),
              pair,
              chainName(chainId),
              "",
              pct(apr),
              pct(apy),
              `https://app.pendle.finance/trade/markets/${marketAddress}/swap?chain=${chainId}`,
              num(purchaseCost, 6),
              expired ? "inactive" : face > 0 ? "active" : "closed",
              battle,
            ],
            [
              num(valuation, 6),
              num(purchaseCost, 6),
              daysSince(openMs),
              daysOpenToExpiry || "",
              formatOpenDate(expiryMs),
              pct(lockedPct),
              num(ptAmt, 8),
              num(valuation, 6),
              num(purchaseCost, 6),
              "",
              "",
              "",
              openMs ? new Date(openMs).toISOString() : "",
              meta?.expiry || "",
              wallet,
              marketId,
              meta?.details?.impliedApy != null ? pct(Number(meta.details.impliedApy) * 100) : "",
              "",
              "",
              "Pendle: locked=(face/cost-1); APR=locked*(365/days_open→expiry); APY=APR",
              JSON.stringify({
                marketId,
                pt,
                name: meta?.name,
                expiry: meta?.expiry,
                impliedApy: meta?.details?.impliedApy,
                lockedPct,
                daysOpenToExpiry,
                apr,
              }).slice(0, 900),
            ],
          ),
        );
      }
    }
  }
  return out;
}

async function collectFluid() {
  const out = [];
  const chains = ["1", "8453", "42161", "9745", "10", "137"];
  for (const chainId of chains) {
    for (const wallet of STABLE_WALLETS) {
      const nfts = await fetchJson(
        `https://api.fluid.instadapp.io/v2/${chainId}/users/${wallet}/nfts`,
      );
      if (!Array.isArray(nfts) || !nfts.length) continue;
      for (const nft of nfts) {
        const detail =
          (await fetchJson(`https://api.fluid.instadapp.io/v2/${chainId}/nfts/${nft.id}`)) || nft;
        const v = detail.vault || {};
        const st = v.supplyToken?.token0;
        const bt = v.borrowToken?.token0;
        const supply = detail.supply || "0";
        const borrow = detail.borrow || "0";
        if (BigInt(supply) <= 0n && BigInt(borrow) <= 0n) continue;

        const supplyUsd =
          fromWei(BigInt(supply), Number(st?.decimals || 18)) * Number(st?.price || 1);
        const borrowUsd =
          fromWei(BigInt(borrow), Number(bt?.decimals || 6)) * Number(bt?.price || 1);
        const equity = supplyUsd - borrowUsd;
        if (!(Math.abs(equity) > 0.001)) continue;

        const pair = st?.symbol && bt?.symbol ? `${st.symbol}/${bt.symbol}` : st?.symbol || "Fluid";
        const bothStable = isStableSym(st?.symbol) && (!bt?.symbol || isStableSym(bt?.symbol));
        const battle = bothStable ? "Stablecoins" : "Fluid-other";
        // Fluid API stakingApr is in basis points / percent*100? Earlier we used /100 → e.g. 763 → 7.63
        // Check: stakingApr: "763" → likely 7.63% (bps/100) or 763% which is wrong. Use /100.
        const stakingAprRaw = st?.stakingApr != null ? Number(st.stakingApr) : null;
        const apr = stakingAprRaw != null ? stakingAprRaw / 100 : "";
        const apy = apr; // APY = APR
        const borrowRate = Number(v.borrowRate?.vault?.rate || 0);

        out.push(
          buildRow(
            [
              "Fluid",
              "",
              "",
              "", // open date unavailable in Fluid API
              "", // earned unknown without entry date
              "",
              "",
              "",
              pair,
              chainName(chainId),
              "",
              apr !== "" ? pct(apr) : "",
              apy !== "" ? pct(apy) : "",
              v.address ? `https://fluid.io/multiply/${chainId}/${v.address}/${detail.id}` : "",
              num(equity, 6),
              Math.abs(equity) > 0.01 ? "active" : "closed",
              battle,
            ],
            [
              num(equity, 6),
              num(equity, 6),
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              num(supplyUsd, 6),
              num(borrowUsd, 6),
              num(equity, 6),
              "",
              "",
              wallet,
              `FLUID:${chainId}:${detail.id}`,
              "",
              apr !== "" ? pct(apr) : "",
              borrowRate,
              "Fluid: APR=stakingApr API (/100); APY=APR; даты открытия в API нет",
              JSON.stringify({
                id: detail.id,
                supply: detail.supply,
                borrow: detail.borrow,
                beforeSupply: detail.beforeSupply,
                beforeBorrow: detail.beforeBorrow,
                tick: detail.tick,
                supplyToken: st,
                borrowToken: bt,
                stakingApr: st?.stakingApr,
                borrowRate: v.borrowRate,
                collateralFactor: v.collateralFactor,
              }).slice(0, 1200),
            ],
          ),
        );
      }
    }
  }
  return out;
}

/** Vaults missing from yDaemon /vaults/all but live on-chain. */
const EXTRA_YEARN_VAULTS = {
  1: [
    "0xc9f01b5c6048B064E6d925d1c2d7206d4fEeF8a3", // Spark USDS Compounder (ysUSDS)
    "0x888239Ffa9a0613F9142C808aA9F7d1948a14f75", // Morpho OEV-boosted USDC Compounder (ysUSDC)
  ],
};

async function loadYearnVault(chainId, address) {
  return fetchJson(`https://ydaemon.yearn.fi/${chainId}/vaults/${address}`);
}

function pushYearnRow(out, { chainId, wallet, vault, shares, openMs }) {
  const sym = vault.token?.symbol || "";
  if (/ETH|BTC|WETH|WBTC|STETH/i.test(`${vault.name} ${sym}`)) return;
  if (!/(USDC|USDT|USDS|DAI|GHO|USD|FRAX|CRVUSD|TUSD)/i.test(`${vault.name} ${sym}`)) return;

  const dec = vault.decimals ?? 18;
  const tokenDec = vault.token?.decimals ?? 18;
  const shareAmt = fromWei(shares, dec);
  const ppsNorm = Number(vault.pricePerShare || 0) / 10 ** tokenDec;
  const priceUsd = Number(vault.tvl?.price || 1);
  const current = shareAmt * ppsNorm * priceUsd;
  if (!(current > 0.001) || !isFinite(current)) return;

  const apr = vault.apr?.netAPR != null ? Number(vault.apr.netAPR) * 100 : "";
  const apy = apr;

  out.push(
    buildRow(
      [
        "Yearn V3",
        "",
        "",
        formatOpenDate(openMs),
        "",
        "",
        "",
        "",
        sym || vault.name,
        chainName(chainId),
        "",
        apr !== "" ? pct(apr) : "",
        apy !== "" ? pct(apy) : "",
        `https://yearn.fi/vaults/${chainId}/${vault.address}`,
        num(current, 6),
        "active",
        "Stablecoins",
      ],
      [
        num(current, 6),
        num(current, 6),
        daysSince(openMs),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        openMs ? new Date(openMs).toISOString() : "",
        "",
        wallet,
        `YEARN:${chainId}:${vault.address}`,
        apr !== "" ? pct(apr) : "",
        "",
        "",
        "Yearn: APR=yDaemon netAPR; APY=APR",
        JSON.stringify({
          address: vault.address,
          name: vault.name,
          token: vault.token,
          pricePerShare: vault.pricePerShare,
          ppsNorm,
          apr: vault.apr,
          shares: shares.toString(),
          shareAmt,
          current,
        }).slice(0, 1000),
      ],
    ),
  );
}

async function collectYearn() {
  const out = [];
  const rpcs = { 1: "https://ethereum.publicnode.com", 8453: "https://base.publicnode.com" };
  const blockscout = {
    1: "https://eth.blockscout.com",
    8453: "https://base.blockscout.com",
  };
  for (const chainId of [1, 8453]) {
    const listed = await fetchJson(`https://ydaemon.yearn.fi/${chainId}/vaults/all`);
    const byAddr = new Map();
    for (const v of Array.isArray(listed) ? listed : []) {
      if (v?.address) byAddr.set(String(v.address).toLowerCase(), v);
    }
    for (const addr of EXTRA_YEARN_VAULTS[chainId] || []) {
      const key = addr.toLowerCase();
      if (byAddr.has(key)) continue;
      const v = await loadYearnVault(chainId, addr);
      if (v?.address) byAddr.set(key, v);
    }
    const rpc = rpcs[chainId];
    const base = blockscout[chainId];
    for (const wallet of STABLE_WALLETS) {
      for (const vault of byAddr.values()) {
        const shares = await ethBalanceOf(rpc, vault.address, wallet);
        if (shares <= 0n) continue;
        let openMs = null;
        if (base) {
          const tr = await fetchJson(
            `${base}/api/v2/addresses/${wallet.toLowerCase()}/token-transfers?type=ERC-20&token=${vault.address}`,
          );
          const inbound = (tr?.items || []).find(
            (t) => t.to?.hash?.toLowerCase() === wallet.toLowerCase(),
          );
          if (inbound?.timestamp) openMs = new Date(inbound.timestamp).getTime();
        }
        pushYearnRow(out, { chainId, wallet, vault, shares, openMs });
      }
    }
  }
  return out;
}

/** Fluid Lite yield vaults (ERC-4626 shares, not NFT lending). */
const FLUID_LITE_VAULTS = [
  {
    chainId: 1,
    address: "0x273DA948ACa9261043fbdb2a857BC255ECC29012",
    pair: "fLiteUSD/USDC",
    assetDecimals: 6,
    llamaPoolId: "488f06db-5a36-450e-9ba9-b4321be39c7c",
  },
];

async function ethCall(rpc, to, data) {
  const body = await fetchJson(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  return body?.result || null;
}

async function collectFluidLite() {
  const out = [];
  const rpc = "https://ethereum.publicnode.com";
  const base = "https://eth.blockscout.com";
  let llamaApr = null;
  for (const vault of FLUID_LITE_VAULTS) {
    if (vault.llamaPoolId && llamaApr == null) {
      const chart = await fetchJson(`https://yields.llama.fi/chart/${vault.llamaPoolId}`);
      const last = (chart?.data || []).slice(-1)[0];
      if (last?.apy != null) llamaApr = Number(last.apy);
    }
    for (const wallet of STABLE_WALLETS) {
      const shares = await ethBalanceOf(rpc, vault.address, wallet);
      if (shares <= 0n) continue;
      const assetsHex = await ethCall(
        rpc,
        vault.address,
        "0x07a2d13a" + shares.toString(16).padStart(64, "0"),
      );
      const assets = assetsHex ? BigInt(assetsHex) : 0n;
      const current = fromWei(assets, vault.assetDecimals);
      if (!(current > 0.001)) continue;

      let openMs = null;
      const tr = await fetchJson(
        `${base}/api/v2/addresses/${wallet.toLowerCase()}/token-transfers?type=ERC-20&token=${vault.address}`,
      );
      const inbound = (tr?.items || []).find(
        (t) => t.to?.hash?.toLowerCase() === wallet.toLowerCase(),
      );
      if (inbound?.timestamp) openMs = new Date(inbound.timestamp).getTime();

      const apr = llamaApr != null ? llamaApr : "";
      const apy = apr;

      out.push(
        buildRow(
          [
            "Fluid",
            "",
            "",
            formatOpenDate(openMs),
            "",
            "",
            "",
            "",
            vault.pair,
            chainName(vault.chainId),
            "",
            apr !== "" ? pct(apr) : "",
            apy !== "" ? pct(apy) : "",
            `https://fluid.io/`,
            num(current, 6),
            "active",
            "Stablecoins",
          ],
          [
            num(current, 6),
            num(current, 6),
            daysSince(openMs),
            "",
            "",
            "",
            "",
            "",
            "",
            num(current, 6),
            "",
            num(current, 6),
            openMs ? new Date(openMs).toISOString() : "",
            "",
            wallet,
            `FLUID-LITE:${vault.chainId}:${vault.address}`,
            apr !== "" ? pct(apr) : "",
            "",
            "",
            "Fluid Lite: ERC4626 convertToAssets; APR=Llama fluid-lite USDC; APY=APR",
            JSON.stringify({
              vault: vault.address,
              shares: shares.toString(),
              assets: assets.toString(),
              current,
              llamaApr,
            }).slice(0, 800),
          ],
        ),
      );
    }
  }
  return out;
}

async function collectCurve() {
  const out = [];
  const monadRpc = "https://rpc.monad.xyz";
  const regs = ["factory-stable-ng", "factory-twocrypto", "factory-tricrypto"];
  const llama = await fetchJson("https://yields.llama.fi/pools");
  const llamaByUnderlying = new Map();
  for (const p of llama?.data || []) {
    if (p.project !== "curve-dex" || String(p.chain || "").toLowerCase() !== "monad") continue;
    const key = (p.underlyingTokens || [])
      .map((t) => String(t).toLowerCase())
      .sort()
      .join(",");
    if (key) llamaByUnderlying.set(key, p);
  }

  for (const reg of regs) {
    const data = await fetchJson(`https://api-core.curve.finance/v1/getPools/monad/${reg}`);
    for (const pool of data?.data?.poolData || []) {
      const coins = pool.coins || [];
      const syms = coins.map((c) => c.symbol || "").filter(Boolean);
      if (!syms.length || !syms.every((s) => isStableSym(s))) continue;

      const lp = pool.lpTokenAddress || pool.address;
      const poolAddr = String(pool.address || lp || "").toLowerCase();
      if (poolAddr === "0x942644106b073e30d72c2c5d7529d5c296ea91ab") continue;
      const gauge = pool.gaugeAddress;
      const supplyRaw = BigInt(pool.totalSupply || "0");
      const usdTotal = Number(pool.usdTotal || 0);
      const virtualPrice = Number(pool.virtualPrice || 1e18) / 1e18;

      const underKey = (pool.coinsAddresses || [])
        .map((t) => String(t).toLowerCase())
        .sort()
        .join(",");
      const llamaPool = llamaByUnderlying.get(underKey);
      const apr = llamaPool?.apy != null ? Number(llamaPool.apy) : "";

      for (const wallet of STABLE_WALLETS) {
        let shares = 0n;
        let loc = "lp";
        if (gauge && gauge !== "0x0000000000000000000000000000000000000000") {
          shares = await ethBalanceOf(monadRpc, gauge, wallet);
          if (shares > 0n) loc = "gauge";
        }
        if (shares <= 0n) {
          shares = await ethBalanceOf(monadRpc, lp, wallet);
          loc = "lp";
        }
        if (shares <= 0n) continue;

        const shareAmt = fromWei(shares, 18);
        let current =
          supplyRaw > 0n && usdTotal > 0
            ? (Number(shares) / Number(supplyRaw)) * usdTotal
            : shareAmt * virtualPrice;
        if (!(current > 0.001) || !isFinite(current)) continue;

        const pair = syms.join(" + ");
        out.push(
          buildRow(
            [
              "Curve",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              pair,
              "Monad",
              "",
              apr !== "" ? pct(apr) : "",
              apr !== "" ? pct(apr) : "",
              `https://curve.finance/#/monad/pools/${pool.address}/deposit`,
              num(current, 6),
              "active",
              "Stablecoins",
            ],
            [
              num(current, 6),
              num(current, 6),
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              wallet,
              `CURVE:monad:${pool.address}:${loc}`,
              apr !== "" ? pct(apr) : "",
              "",
              "",
              "Curve Monad: gauge/LP balance × pool USD share; APR=Llama curve-dex; APY=APR",
              JSON.stringify({
                address: pool.address,
                gauge,
                loc,
                shares: shares.toString(),
                shareAmt,
                usdTotal,
                virtualPrice,
                current,
                llamaApy: llamaPool?.apy,
              }).slice(0, 900),
            ],
          ),
        );
      }
    }
  }
  return out;
}

async function ensureSheet() {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(title)",
  });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    console.log("Created", SHEET);
  }
}

async function main() {
  console.log("Collecting positions (ethereum NOT touched)...");
  const allRows = (
    await Promise.all([
      collectHyperliquid(),
      collectPendle(),
      collectFluid(),
      collectFluidLite(),
      collectYearn(),
      collectCurve(),
    ])
  ).flat();

  // Dump sheet = stable battle only (drop PT-AVLT, Fluid cbBTC, etc.)
  const rows = allRows.filter((r) => r[16] === "Stablecoins");
  const dropped = allRows.length - rows.length;
  if (dropped) console.log(`Filtered out ${dropped} non-Stablecoins rows`);

  console.log("Rows:", rows.length);
  for (const r of rows) {
    console.log(" -", r[0], r[8], `~$${r[14]}`, `APR=${r[11]} APY=${r[12]}`, r[15]);
  }

  await ensureSheet();

  // Full rewrite of dump sheet only
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET}'`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS, ...rows] },
  });

  console.log(`OK: wrote ${rows.length} data rows to ${SHEET} (A–Q main, R+ extras)`);
  console.log("ethereum sheet was NOT modified.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
