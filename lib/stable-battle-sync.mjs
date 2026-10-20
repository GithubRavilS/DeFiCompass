/**
 * Stable battle position discovery (Hyperliquid / Pendle / Fluid / Yearn / Curve).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY_CACHE = path.join(__dirname, "..", ".stable-entry-cache.json");

export const STABLE_WALLETS = [
  "0xE6C9B6407676432a95cE23fd414021ED31fC0566",
  "0x6aF9874250e7250223148e12C811Ea7643Db8A20",
];

const STABLE_CHAIN_RPC = {
  1: "https://ethereum.publicnode.com",
  8453: "https://base.publicnode.com",
  42161: "https://arbitrum-one.publicnode.com",
  9745: "https://plasma.publicnode.com",
  143: "https://rpc.monad.xyz",
};

const STABLE_CHAIN_NAMES = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  9745: "Plasma",
  10: "Optimism",
  137: "Polygon",
  56: "BNB Chain",
  999: "HyperEVM",
  143: "Monad",
};

const BLOCKSCOUT = {
  1: "https://eth.blockscout.com",
  42161: "https://arbitrum.blockscout.com",
  8453: "https://base.blockscout.com",
  56: "https://bsc.blockscout.com",
  999: "https://www.hyperscan.com",
  9745: "https://plasmascan.to",
  143: "https://monadvision.com",
};

const PENDLE_CHAINS = [1, 42161, 8453, 56, 999];
const FLUID_CHAINS = ["1", "8453", "42161", "9745", "10", "137"];
const YEARN_CHAINS = [1, 8453];
const CURVE_SCAN = [
  { chainId: "42161", slug: "arbitrum", registries: ["factory-stable-ng", "main"] },
  { chainId: "1", slug: "ethereum", registries: ["factory-stable-ng", "main"] },
  { chainId: "8453", slug: "base", registries: ["factory-stable-ng", "main"] },
];
/** Curve Monad AUSD/USDC/USDT0 was removed from live Compass stables. */

export const DEBUG_HEADERS = {
  currentValue: "Текущая стоимость USD",
  daysWorked: "Дней в работе",
  entryCost: "Стоимость входа USD",
  debugNote: "Отладка расчёта",
};

let pendleMarketsCache = null;
let yearnVaultsCache = {};

function loadEntryCache() {
  try {
    return JSON.parse(fs.readFileSync(ENTRY_CACHE, "utf8"));
  } catch {
    return {};
  }
}

function saveEntryCache(cache) {
  fs.writeFileSync(ENTRY_CACHE, JSON.stringify(cache, null, 2));
}

function getEntry(posKey, fallbackInvested, extra = {}) {
  const cache = loadEntryCache();
  const now = Date.now();
  let e = cache[posKey];
  if (!e) {
    e = { invested: 0, firstSeenMs: now };
    cache[posKey] = e;
  }
  if (extra.purchaseCost > 0) {
    e.invested = extra.purchaseCost;
    e.purchaseCost = extra.purchaseCost;
  } else if (!(e.invested > 0) && fallbackInvested > 0) {
    e.invested = fallbackInvested;
  }
  if (extra.openDateMs > 0 && !(e.openDateMs > 0)) e.openDateMs = extra.openDateMs;
  if (extra.ptFaceUsd > 0) e.ptFaceUsd = extra.ptFaceUsd;
  if (extra.lockedApyTotal > 0 && !(e.lockedApyTotal > 0)) e.lockedApyTotal = extra.lockedApyTotal;
  if (!(e.firstSeenMs > 0)) e.firstSeenMs = now;
  cache[posKey] = e;
  saveEntryCache(cache);
  return e;
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

async function ethCall(rpcUrl, to, data) {
  const body = await fetchJson(rpcUrl, {
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

async function ethBalanceOf(rpcUrl, token, wallet) {
  const u = wallet.toLowerCase().replace("0x", "");
  const hex = await ethCall(rpcUrl, token, "0x70a08231000000000000000000000000" + u);
  if (!hex || hex === "0x" || hex.length > 66) return 0n;
  return BigInt(hex);
}

function fromWei(amount, decimals = 18) {
  return Number(amount) / 10 ** decimals;
}

function isStableSymbol(sym) {
  const s = String(sym || "")
    .trim()
    .toUpperCase();
  if (!s || s === "0X0000000000000000000000000000000000000000") return false;
  if (
    /^(ETH|WETH|BTC|WBTC|CBBTC|STETH|WSTETH|AVLT|SOL|BNB|MATIC|OP|ARB|CRV|CVX|AERO|CAKE|PENDLE|XAUT|PAXG|GOLD)$/i.test(
      s,
    )
  )
    return false;
  return /(USD|DAI|GHO|FRAX|LUSD|SUSD|USDS|USDE|REUSD|MSUSD|AUSD|CRVUSD|TUSD|USDT0|USDC|LIMUSD|SYRUPUSDT)/i.test(
    s,
  );
}

function chainName(id) {
  return STABLE_CHAIN_NAMES[id] || STABLE_CHAIN_NAMES[String(id)] || `chain:${id}`;
}

export function formatOpenDate(ms) {
  if (!(ms > 0)) return "";
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function daysSince(ms) {
  if (!(ms > 0)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

export function annualizeReturnPct(returnPct, days) {
  if (!(days > 0) || !isFinite(returnPct)) return returnPct;
  return returnPct * (365 / days);
}

function parsePendleTokenId(tokenId) {
  const s = String(tokenId || "");
  const i = s.indexOf("-");
  if (i < 0) return "";
  return s.slice(i + 1);
}

async function getPendleMarkets() {
  if (pendleMarketsCache) return pendleMarketsCache;
  const byAddress = {};
  const ingest = (m) => {
    if (m?.address) byAddress[`${m.address}`.toLowerCase()] = m;
  };
  for (const active of [true, false]) {
    const data = await fetchJson(
      `https://api-v2.pendle.finance/core/v1/markets/all?isActive=${active}`,
    );
    for (const m of data?.markets || []) ingest(m);
  }
  for (const chainId of PENDLE_CHAINS) {
    for (const kind of ["active", "inactive"]) {
      const data = await fetchJson(
        `https://api-v2.pendle.finance/core/v1/${chainId}/markets/${kind}`,
      );
      for (const m of data?.markets || []) ingest(m);
    }
  }
  pendleMarketsCache = byAddress;
  return byAddress;
}

function pendleIsStable(m, op) {
  if (m?.categoryIds?.includes("stables")) return true;
  const name = String(m?.name || op?.pair || "").toLowerCase();
  if (!name) return false;
  if (/eth|btc|avax|sol|bnb|gold|xaut|hype|sthype|hahype|avlt/i.test(name)) return false;
  return /usd|dai|gho|susd|usds|usde|reusd|susdai|msusd|ausd|frax|crvusd|syrup|limusd/i.test(name);
}

async function getFirstTxToContract(chainId, wallet, contract) {
  const base = BLOCKSCOUT[chainId];
  if (!base || !contract) return null;
  const w = wallet.toLowerCase();
  const data = await fetchJson(`${base}/api/v2/addresses/${w}/transactions?filter=to%20%7C%20from`);
  const c = contract.toLowerCase();
  for (const tx of data?.items || []) {
    const to = tx.to?.hash?.toLowerCase();
    const from = tx.from?.hash?.toLowerCase();
    if (to === c || from === c) {
      return tx.timestamp ? new Date(tx.timestamp).getTime() : null;
    }
  }
  return null;
}

async function getYearnPurchaseFromChain(chainId, wallet, vaultAddress) {
  const base = BLOCKSCOUT[chainId];
  if (!base) return null;
  const w = wallet.toLowerCase();
  const data = await fetchJson(
    `${base}/api/v2/addresses/${w}/token-transfers?type=ERC-20&token=${vaultAddress}`,
  );
  const inbound = (data?.items || []).find((t) => t.to?.hash?.toLowerCase() === w);
  if (!inbound) return null;
  const dec = Number(inbound.token?.decimals || 18);
  const shares = Number(inbound.total?.value || 0) / 10 ** dec;
  return {
    openDateMs: inbound.timestamp ? new Date(inbound.timestamp).getTime() : null,
    shares,
  };
}

async function getPendlePurchaseFromChain(chainId, wallet, ptTokenAddress) {
  const base = BLOCKSCOUT[chainId];
  if (!base || !ptTokenAddress) return null;
  const w = wallet.toLowerCase();
  const data = await fetchJson(
    `${base}/api/v2/addresses/${w}/token-transfers?type=ERC-20&token=${ptTokenAddress}`,
  );
  const items = data?.items || [];
  const inbound = items.find((t) => t.to?.hash?.toLowerCase() === w);
  if (!inbound) return null;
  const txh = inbound.transaction_hash;
  const openDateMs = inbound.timestamp ? new Date(inbound.timestamp).getTime() : 0;
  const ptDecimals = Number(inbound.token?.decimals || 18);
  const ptAmount = Number(inbound.total?.value || 0) / 10 ** ptDecimals;
  const txData = await fetchJson(`${base}/api/v2/transactions/${txh}/token-transfers`);
  let cost = 0;
  for (const x of txData?.items || []) {
    if (x.from?.hash?.toLowerCase() !== w) continue;
    const sym = x.token?.symbol || "";
    if (!isStableSymbol(sym) && !/^(REUSDE|SUSDAI|SY-)/i.test(sym)) continue;
    const dec = Number(x.token?.decimals || 18);
    cost += Number(x.total?.value || 0) / 10 ** dec;
  }
  if (!(cost > 0)) return { openDateMs, ptAmount, cost: 0 };
  return { openDateMs, ptAmount, cost };
}

async function discoverHyperliquid() {
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
      const investedGuess = equity - pnl;
      const posKey = `HL:${vault.toLowerCase()}:${wallet.toLowerCase()}`;
      const openDateMs = fs?.vaultEntryTime ? Number(fs.vaultEntryTime) : null;
      const entry = getEntry(posKey, investedGuess > 0 ? investedGuess : equity, { openDateMs });
      const invested = entry.invested > 0 ? entry.invested : investedGuess;
      const currentValue = equity;
      const earned = currentValue - invested;
      const days = daysSince(entry.openDateMs || openDateMs);
      const retPct = invested > 0 ? (earned / invested) * 100 : 0;
      out.push({
        posKey,
        platform: "Hyperliquid",
        pair: "USDC",
        chain: "Hyperliquid",
        openDateMs: entry.openDateMs || openDateMs,
        earnedStables: earned,
        invested,
        currentValue,
        daysWorked: days,
        entryCost: invested,
        apy: days > 0 ? annualizeReturnPct(retPct, days) : retPct,
        apr: retPct,
        debugNote: `HL equity=${equity.toFixed(4)} pnl=${pnl.toFixed(4)}`,
        link: `https://app.hyperliquid.xyz/vaults/${vault}`,
        status: "active",
      });
    }
  }
  return out;
}

async function discoverPendle() {
  const markets = await getPendleMarkets();
  const out = [];
  const now = Date.now();

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
        const balanceRaw = pt.balance || "0";
        const valuation = Number(pt.valuation || 0);
        const faceUsd = fromWei(BigInt(balanceRaw || 0), 18);
        if (faceUsd <= 0 && valuation <= 0) continue;
        if (!meta) continue;
        if (!pendleIsStable(meta, op)) continue;

        let marketName = `PT-${meta.name}`;
        if (meta.expiry) marketName += `-${String(meta.expiry).slice(0, 10)}`;

        const ptToken = parsePendleTokenId(meta?.pt);
        const purchase = ptToken
          ? await getPendlePurchaseFromChain(chainId, wallet, ptToken)
          : null;
        const purchaseCost = purchase?.cost > 0 ? purchase.cost : valuation > 0 ? valuation : 0;
        if (!(purchaseCost > 0)) continue;
        const openDateMs = purchase?.openDateMs || null;
        const expiryMs = meta?.expiry ? new Date(meta.expiry).getTime() : 0;
        const expired = expiryMs > 0 && expiryMs < now;
        const lockedFace = purchase?.ptAmount > 0 ? purchase.ptAmount : faceUsd;
        const lockedApyTotal = purchaseCost > 0 ? (lockedFace / purchaseCost - 1) * 100 : null;

        const posKey = `PENDLE:${marketId}:${wallet.toLowerCase()}`;
        const entry = getEntry(posKey, purchaseCost, {
          purchaseCost,
          openDateMs,
          ptFaceUsd: lockedFace,
          lockedApyTotal,
        });
        const invested = entry.purchaseCost > 0 ? entry.purchaseCost : entry.invested;
        const daysWorked = daysSince(entry.openDateMs || openDateMs);
        const apyAnnual =
          lockedApyTotal != null && daysWorked > 0
            ? lockedApyTotal * (365 / daysWorked)
            : lockedApyTotal;
        const apyDisplay =
          apyAnnual != null && isFinite(apyAnnual)
            ? apyAnnual
            : lockedApyTotal != null
              ? lockedApyTotal * (365 / Math.max(daysWorked, 1))
              : null;

        const active = !expired && (faceUsd > 0.0001 || valuation > 0.0001);
        out.push({
          posKey,
          platform: "Pendle V2",
          pair: marketName,
          chain: chainName(chainId),
          openDateMs: entry.openDateMs || openDateMs,
          earnedStables: valuation - invested,
          invested,
          currentValue: valuation,
          daysWorked: daysSince(entry.openDateMs || openDateMs),
          entryCost: invested,
          apy: apyDisplay,
          apr: apyDisplay,
          debugNote: `locked=${lockedApyTotal?.toFixed(2)}% ann=${apyDisplay?.toFixed(2)}% days=${daysWorked} face=${lockedFace.toFixed(6)} cost=${invested.toFixed(6)}`,
          link: `https://app.pendle.finance/trade/markets/${marketAddress}/swap?chain=${chainId}`,
          status: active ? "active" : "inactive",
        });
      }
    }
  }
  return out;
}

function fluidTokenUsd(raw, token) {
  if (!token || raw == null) return 0;
  const amt = fromWei(BigInt(raw), Number(token.decimals || 18));
  return amt * Number(token.price || 1);
}

async function discoverFluid() {
  const out = [];
  for (const chainId of FLUID_CHAINS) {
    for (const wallet of STABLE_WALLETS) {
      const nfts = await fetchJson(
        `https://api.fluid.instadapp.io/v2/${chainId}/users/${wallet}/nfts`,
      );
      if (!Array.isArray(nfts)) continue;
      for (const nft of nfts) {
        const supply = nft.supply || "0";
        const borrow = nft.borrow || "0";
        if (BigInt(supply) <= 0n && BigInt(borrow) <= 0n) continue;
        const v = nft.vault || {};
        const st = v.supplyToken?.token0;
        const bt = v.borrowToken?.token0;
        if (!st?.symbol) continue;
        if (!isStableSymbol(st.symbol)) continue;
        if (bt?.symbol && !isStableSymbol(bt.symbol)) continue;

        const supplyUsd = fluidTokenUsd(supply, st);
        const borrowUsd = fluidTokenUsd(borrow, bt);
        const currentValue = supplyUsd - borrowUsd;
        if (!(Math.abs(currentValue) > 0.001)) continue;

        const posKey = `FLUID:${chainId}:${nft.id}:${wallet.toLowerCase()}`;
        const vaultOpenMs = v.address
          ? await getFirstTxToContract(Number(chainId), wallet, v.address)
          : null;
        const entry = getEntry(posKey, currentValue, { openDateMs: vaultOpenMs });
        const invested = entry.invested > 0 ? entry.invested : currentValue;
        const earned = currentValue - invested;
        const retPct = invested > 0 ? (earned / invested) * 100 : 0;
        const daysDisplay = daysSince(entry.openDateMs || entry.firstSeenMs);
        const pair = st?.symbol && bt?.symbol ? `${st.symbol}/${bt.symbol}` : st?.symbol || "Fluid";

        out.push({
          posKey,
          platform: "Fluid",
          pair,
          chain: chainName(chainId),
          openDateMs: entry.openDateMs || entry.firstSeenMs,
          earnedStables: earned,
          invested,
          currentValue,
          daysWorked: daysDisplay,
          entryCost: invested,
          apy:
            entry.openDateMs > 0 && daysDisplay >= 7 ? annualizeReturnPct(retPct, daysDisplay) : "",
          apr: retPct,
          debugNote: `supply$=${supplyUsd.toFixed(4)} borrow$=${borrowUsd.toFixed(4)} nft=${nft.id}`,
          link: v.address
            ? `https://fluid.io/multiply/${chainId}/${v.address}/${nft.id}`
            : "https://fluid.io/",
          status: Math.abs(currentValue) > 0.01 ? "active" : "inactive",
        });
      }
    }
  }
  return out;
}

async function getYearnVaults(chainId) {
  if (yearnVaultsCache[chainId]) return yearnVaultsCache[chainId];
  const all = await fetchJson(`https://ydaemon.yearn.fi/${chainId}/vaults/all`);
  if (!Array.isArray(all)) return [];
  const out = all.filter((v) => {
    const sym = v.token?.symbol || "";
    const name = String(v.name || "");
    if (/ETH|BTC|WETH|WBTC|AERO|CRV|CVX|PENDLE|STETH/i.test(`${name} ${sym}`)) return false;
    return /(USDC|USDT|USDS|DAI|GHO|USD|FRAX|LUSD|SUSD|CRVUSD)/i.test(`${name} ${sym}`);
  });
  yearnVaultsCache[chainId] = out;
  return out;
}

async function discoverYearn() {
  const out = [];
  for (const chainId of YEARN_CHAINS) {
    const rpc = STABLE_CHAIN_RPC[chainId];
    if (!rpc) continue;
    const vaults = await getYearnVaults(chainId);
    for (const wallet of STABLE_WALLETS) {
      for (const vault of vaults) {
        const shares = await ethBalanceOf(rpc, vault.address, wallet);
        if (shares <= 0n) continue;
        const dec = vault.decimals ?? 18;
        const tokenDec = vault.token?.decimals ?? 18;
        const shareAmt = fromWei(shares, dec);
        const ppsNorm = fromWei(BigInt(vault.pricePerShare || 0), tokenDec);
        const currentValue = shareAmt * ppsNorm;
        if (!(currentValue > 0.01) || !isFinite(currentValue)) continue;

        const posKey = `YEARN:${chainId}:${vault.address.toLowerCase()}:${wallet.toLowerCase()}`;
        const purchase = await getYearnPurchaseFromChain(chainId, wallet, vault.address);
        const entry = getEntry(posKey, currentValue, { openDateMs: purchase?.openDateMs });
        const invested = entry.invested > 0 ? entry.invested : currentValue;
        const openMs = entry.openDateMs || entry.firstSeenMs;
        const daysDisplay = daysSince(openMs);
        const earned = currentValue - invested;
        const retPct = invested > 0 ? (earned / invested) * 100 : 0;
        out.push({
          posKey,
          platform: "Yearn V3",
          pair: vault.token?.symbol || vault.name || "Vault",
          chain: chainName(chainId),
          openDateMs: entry.openDateMs || entry.firstSeenMs,
          earnedStables: earned,
          invested,
          currentValue,
          daysWorked: daysDisplay,
          entryCost: invested,
          apy:
            entry.openDateMs > 0 && daysDisplay >= 7
              ? annualizeReturnPct(retPct, daysDisplay)
              : vault.apr?.netAPR != null
                ? Number(vault.apr.netAPR) * 100
                : "",
          apr: retPct,
          debugNote: `shares=${shareAmt.toFixed(6)} pps=${ppsNorm.toFixed(6)}`,
          link: `https://yearn.fi/vaults/${chainId}/${vault.address}`,
          status: "active",
        });
      }
    }
  }
  return out;
}

async function discoverCurve() {
  const out = [];
  for (const scan of CURVE_SCAN) {
    const rpc = STABLE_CHAIN_RPC[scan.chainId];
    if (!rpc) continue;
    for (const reg of scan.registries) {
      const data = await fetchJson(`https://api.curve.finance/api/getPools/${scan.slug}/${reg}`);
      const pools = data?.data?.poolData || [];
      for (const pool of pools) {
        const coins = (pool.coins || []).map((c) => c.symbol);
        if (!coins.length || !coins.every(isStableSymbol)) continue;
        const lp = pool.lpTokenAddress || pool.address;
        if (!lp) continue;
        for (const wallet of STABLE_WALLETS) {
          const bal = await ethBalanceOf(rpc, lp, wallet);
          if (bal <= 0n) continue;
          const ts = Number(pool.totalSupply || 0);
          const usdTotal = Number(pool.usdTotal || 0);
          const currentValue = ts > 0 ? (usdTotal * Number(bal)) / ts : 0;
          if (!(currentValue > 0.01)) continue;
          const posKey = `CURVE:${scan.chainId}:${pool.address.toLowerCase()}:${wallet.toLowerCase()}`;
          const entry = getEntry(posKey, currentValue);
          const invested = entry.invested > 0 ? entry.invested : currentValue;
          const openMs = entry.openDateMs || entry.firstSeenMs;
          const daysDisplay = daysSince(openMs);
          const earned = currentValue - invested;
          const retPct = invested > 0 ? (earned / invested) * 100 : 0;
          out.push({
            posKey,
            platform: "Curve",
            pair: coins.join(" + "),
            chain: chainName(scan.chainId),
            openDateMs: entry.openDateMs || entry.firstSeenMs,
            earnedStables: earned,
            invested,
            currentValue,
            daysWorked: daysDisplay,
            entryCost: invested,
            apy:
              entry.openDateMs > 0 && daysDisplay >= 7
                ? annualizeReturnPct(retPct, daysDisplay)
                : "",
            apr: retPct,
            debugNote: `lpBal=${fromWei(bal, 18).toFixed(6)}`,
            link: `https://curve.fi/#/${scan.slug}/pools/${pool.address}/deposit`,
            status: "active",
          });
        }
      }
    }
  }
  return out;
}

export async function discoverAllStablePositions() {
  const chunks = await Promise.all([
    discoverHyperliquid(),
    discoverPendle(),
    discoverFluid(),
    discoverYearn(),
    discoverCurve(),
  ]);
  return chunks.flat();
}

export function normalizeHeader(h) {
  return String(h || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildColumnMap(headers) {
  const find = (cands) => {
    for (let i = 0; i < headers.length; i++) {
      const hn = normalizeHeader(headers[i]);
      if (cands.some((c) => hn === normalizeHeader(c))) return i;
    }
    return -1;
  };
  return {
    colNftId: find(["nft_id", "nft id"]),
    colPlatform: find(["платформа", "platform"]),
    colMinRange: find(["мин диапазона"]),
    colMaxRange: find(["макс диапазон"]),
    colOpenDate: find(["дата открытия норм", "дата открытия"]),
    colEarnedStables: find(["заработано стейблов"]),
    colEarnedEth: find(["заработано eth"]),
    colEarnedCakeAero: find(["заработано cake/aero", "заработано cake"]),
    colTotalFee: find(["итого комс доход"]),
    colPair: find(["пара", "pair"]),
    colChain: find(["блокчейн", "chain"]),
    colFeeTier: find(["fee_tier", "fee tier"]),
    colApr: find(["apr"]),
    colApy: find(["apy"]),
    colLink: find(["ссылка на позицию", "ссылка", "link"]),
    colInvested: find(["инвестировано"]),
    colStatus: find(["статус", "status"]),
    colBattle: find(["битва", "battle"]),
    colCurrentValue: find(["текущая стоимость usd", "текущая стоимость"]),
    colDaysWorked: find(["дней в работе"]),
    colEntryCost: find(["стоимость входа usd", "стоимость входа"]),
    colDebug: find(["отладка расчёта", "отладка"]),
  };
}

function fmtNum(n, digits = 4) {
  if (n == null || !isFinite(n)) return "";
  return Number(n).toFixed(digits);
}

export function positionToRow(pos, cols, width) {
  const row = Array(width).fill("");
  const set = (col, val) => {
    if (col >= 0) row[col] = val == null ? "" : String(val);
  };
  set(cols.colNftId, pos.posKey);
  set(cols.colPlatform, pos.platform);
  set(cols.colOpenDate, formatOpenDate(pos.openDateMs));
  set(cols.colEarnedStables, fmtNum(pos.earnedStables, 4));
  set(cols.colTotalFee, fmtNum(pos.earnedStables, 4));
  set(cols.colPair, pos.pair);
  set(cols.colChain, pos.chain);
  set(cols.colApr, pos.apr != null && isFinite(pos.apr) ? fmtNum(pos.apr, 4) : "");
  set(cols.colApy, pos.apy != null && isFinite(pos.apy) ? fmtNum(pos.apy, 4) : "");
  set(cols.colLink, pos.link);
  set(cols.colInvested, fmtNum(pos.invested, 4));
  set(cols.colStatus, pos.status || "active");
  set(cols.colBattle, "Stablecoins");
  set(cols.colCurrentValue, fmtNum(pos.currentValue, 4));
  set(cols.colDaysWorked, pos.daysWorked != null ? String(pos.daysWorked) : "");
  set(cols.colEntryCost, fmtNum(pos.entryCost ?? pos.invested, 4));
  set(cols.colDebug, pos.debugNote || "");
  return row;
}

export function ensureDebugHeaders(headers) {
  const out = [...headers];
  const targets = [
    [DEBUG_HEADERS.currentValue, 17],
    [DEBUG_HEADERS.daysWorked, 18],
    [DEBUG_HEADERS.entryCost, 19],
    [DEBUG_HEADERS.debugNote, 20],
  ];
  for (const [name, idx] of targets) {
    while (out.length <= idx) out.push("");
    if (!out[idx]) out[idx] = name;
  }
  return out;
}
