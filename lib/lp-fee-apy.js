/**
 * LP card APY = DeFi Navigator scan: claimed+pending trading fees AND farm
 * (CAKE/AERO), never PnL / ROI / IL.
 * APY = earned / principal / hours * 24 * 365
 */

const fs = require("fs");
const path = require("path");

const LP_FEE_CATS = { ethereum: true, bitcoin: true, stables: true };
const AERODROME_NFPM = {
  "0x827922686190790b37229fd06084350e74485b72": true,
  "0xe1f8cd9ac4e4a65f54f38a5cdafca44f6dd68b53": true,
};

const CHAIN_REVERT = {
  1: "ethereum",
  10: "optimism",
  56: "bsc",
  137: "polygon",
  8453: "base",
  42161: "arbitrum",
  43114: "avalanche",
};

/** Krystal NFPM → Revert exchange. Used for owner lookup; fees still come from Krystal. */
const NFPM_EXCHANGE = {
  "0x827922686190790b37229fd06084350e74485b72": "aerodrome",
  "0x46a15b0b27311cedf172ab29e4f4766fbe7f4364": "pancakeswapv3",
  "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e": "uniswapv4",
  "0x3c3ea4b57a46241e54610e5f022e5c45859a1017": "uniswapv4",
  "0x7c5f5a4bbd8fd63184577525326123b519429bdc": "uniswapv4",
  "0xd88f38f930b7952f2db2432cb002e7abbf3dd869": "uniswapv4",
  "0x7a4a5c919ae2541aed11041a1aeee68f1287f95b": "uniswapv4",
};

const RPCS = {
  1: ["https://rpc.mevblocker.io", "https://ethereum.publicnode.com", "https://1rpc.io/eth"],
  10: ["https://mainnet.optimism.io", "https://optimism.publicnode.com", "https://1rpc.io/op"],
  56: ["https://bsc-dataseed.binance.org", "https://bsc.publicnode.com"],
  137: ["https://polygon-bor.publicnode.com", "https://1rpc.io/matic"],
  8453: ["https://mainnet.base.org", "https://base.publicnode.com", "https://1rpc.io/base"],
  42161: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one.publicnode.com",
    "https://1rpc.io/arb",
  ],
};

function formatApyOneDecimal(n) {
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10) / 10);
}

function feeApyPct(feesUsd, investedUsd, days) {
  const fees = Number(feesUsd);
  const inv = Number(investedUsd);
  const d = Number(days);
  if (!(inv > 0) || !(d > 0) || !Number.isFinite(fees) || fees < 0) return null;
  return (fees / inv) * (365 / d) * 100;
}

const MIN_HOURS = 1;

function lifetimeHours(createdSec, openedSec, nowMs) {
  const c = Number(createdSec) || 0;
  const o = Number(openedSec) || 0;
  let t = 0;
  if (c > 0 && o > 0) t = Math.min(c, o);
  else t = c || o;
  if (!(t > 0)) return null;
  const sec = t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
  const hours = (nowMs - sec * 1000) / 3600000;
  if (!(hours > 0)) return null;
  return Math.max(hours, MIN_HOURS);
}

function computeNavApyPct(earnedUsd, principalUsd, hoursOpen) {
  const earned = Math.max(0, Number(earnedUsd) || 0);
  const invested = Number(principalUsd) || 0;
  let hours = Number(hoursOpen) || 0;
  if (!(invested > 0) || !(hours > 0)) return null;
  hours = Math.max(hours, MIN_HOURS);
  return (earned / invested / hours) * 24 * 365 * 100;
}

function parseKrystalLink(link) {
  const m = String(link || "").match(
    /(?:cloud-ui\.krystal\.app|defi\.krystal\.app)\/positions\/(\d+)\/(0x[a-fA-F0-9]{40})-(\d+)/i,
  );
  if (!m) return null;
  return { chainId: Number(m[1]), nfpm: m[2].toLowerCase(), nft: m[3] };
}

function parseRevertLink(link) {
  const m = String(link || "").match(/revert\.finance\/#\/uniswap-position\/([a-z0-9-]+)\/(\d+)/i);
  if (!m) return null;
  return { network: m[1], nft: m[2], exchange: "uniswapv3" };
}

function isLabsFrozenRate(tool) {
  return (
    tool &&
    (tool.rateKind === "review-saved" ||
      tool.rateKind === "wallet-live" ||
      tool.rateKind === "daily-average")
  );
}

function usdFromTokenRows(arr) {
  let tot = 0;
  (arr || []).forEach(function (x) {
    if (!x) return;
    let n = Number(x.quotes && x.quotes.usd && x.quotes.usd.value);
    if (!Number.isFinite(n)) n = Number(x.value);
    if (!Number.isFinite(n)) n = Number(x.usd);
    if (Number.isFinite(n) && n > 0 && n < 1e6) tot += n;
  });
  return tot;
}

function mergeHeaders(base, extra) {
  const out = {};
  Object.keys(base || {}).forEach(function (k) {
    out[k] = base[k];
  });
  Object.keys(extra || {}).forEach(function (k) {
    out[k] = extra[k];
  });
  return out;
}

async function fetchJsonOk(url, timeoutMs, init) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    ctrl && timeoutMs
      ? setTimeout(function () {
          ctrl.abort();
        }, timeoutMs)
      : null;
  const headers = mergeHeaders(
    {
      "User-Agent": "DeFi-Compass/1.0",
      Accept: "application/json",
    },
    init && init.headers,
  );
  try {
    const res = await fetch(
      url,
      Object.assign({}, init || {}, {
        headers,
        signal: ctrl ? ctrl.signal : init && init.signal,
      }),
    );
    const text = await res.text();
    if (!res.ok) return null;
    if (!text || text.charAt(0) === "<") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function addrFromEthCall(raw) {
  if (!raw || raw === "0x") return "";
  const addr = "0x" + String(raw).slice(-40).toLowerCase();
  if (addr === "0x0000000000000000000000000000000000000000") return "";
  return addr;
}

async function ownerOfNft(chainId, nfpm, nft, timeoutMs) {
  const rpcs = RPCS[chainId] || [];
  if (!rpcs.length || !nfpm || !nft) return "";
  const tokenHex = BigInt(nft).toString(16).padStart(64, "0");
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: nfpm, data: "0x6352211e" + tokenHex }, "latest"],
  };
  const raw = JSON.stringify(body);
  const found = await Promise.all(
    rpcs.map(function (rpc) {
      return fetchJsonOk(rpc, timeoutMs || 5000, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw,
      }).then(function (json) {
        return addrFromEthCall(json && json.result);
      });
    }),
  );
  for (let i = 0; i < found.length; i++) {
    if (found[i]) return found[i];
  }
  return "";
}

function revertFeesTrusted(nfpm, data) {
  if (!data) return false;
  const ex = NFPM_EXCHANGE[nfpm];
  const fees = Number(data.fees_value);
  const inv = Number(data.deposits_value);
  if (!(inv > 0.05) || inv > 20000 || !Number.isFinite(fees) || fees < 0) return false;
  if (ex === "aerodrome") return fees >= 0.001;
  return ex === "pancakeswapv3" || ex === "uniswapv4";
}

async function fetchRevertPosition(kry) {
  const net = CHAIN_REVERT[kry.chainId];
  const ex = NFPM_EXCHANGE[kry.nfpm];
  if (!net || !ex) return null;
  const url = `https://api.revert.finance/v1/positions/${net}/${ex}/${kry.nft}`;
  const payload = await fetchJsonOk(url, 8000, {
    headers: { Origin: "https://revert.finance", Referer: "https://revert.finance/" },
  });
  const data = payload && payload.success ? payload.data : payload;
  if (!data || typeof data !== "object") return null;
  return data;
}

async function krystalPositionsPage(wallet, chainId, offset) {
  const params = new URLSearchParams();
  params.set("addresses", wallet);
  params.set("walletAddress", wallet);
  params.set("quoteSymbols", "usd");
  params.set("offset", String(offset || 0));
  params.set("orderBy", "liquidity");
  params.set("positionStatus", "open");
  params.set("limit", "1000");
  params.set("chainIds[0]", String(chainId));
  params.set("isIncludeSpamPosition", "true");
  const url = "https://api.krystal.app/all/v2/lp/userPositions?" + params.toString();
  const d = await fetchJsonOk(url, 8000, {
    headers: {
      Origin: "https://defi.krystal.app",
      Referer: "https://defi.krystal.app/",
    },
  });
  return (d && d.positions) || [];
}

function indexKrystalPositions(rows, map) {
  (rows || []).forEach(function (p) {
    if (p && p.id) map[String(p.id).toLowerCase()] = p;
    if (p && p.tokenId != null) map["tid:" + String(p.tokenId)] = p;
  });
}

async function krystalPositionsForWallet(wallet, chainId, needed) {
  const map = {};
  const pages = [0, 200];
  for (let i = 0; i < pages.length; i++) {
    const rows = await krystalPositionsPage(wallet, chainId, pages[i]);
    indexKrystalPositions(rows, map);
    const allFound =
      !needed ||
      !needed.length ||
      needed.every(function (id) {
        return map[id] || map["tid:" + String(id).split("-").pop()];
      });
    if (allFound || rows.length < 200) break;
  }
  return map;
}

function krystalFeeApyFromPos(pos, nowMs) {
  if (!pos) return null;
  const now = nowMs == null ? Date.now() : nowMs;
  const feesPublic = usdFromTokenRows(pos.feePending) + usdFromTokenRows(pos.feesClaimed);
  const farmPublic =
    usdFromTokenRows(pos.farmRewardsPending) + usdFromTokenRows(pos.farmRewardsClaimed);
  const tf = pos.tradingFee && typeof pos.tradingFee === "object" ? pos.tradingFee : {};
  const fr = pos.farmingReward && typeof pos.farmingReward === "object" ? pos.farmingReward : {};
  const feesCloud = usdFromTokenRows(tf.pending) + usdFromTokenRows(tf.claimed);
  const farmCloud = usdFromTokenRows(fr.pending) + usdFromTokenRows(fr.claimed);
  const earned = Math.max(feesPublic + farmPublic, feesCloud + farmCloud);
  let invested = Number(pos.totalDepositValue);
  const current = Number(pos.currentPositionValue);
  const provided = usdFromTokenRows(pos.providedAmounts);
  if (!(invested > 0) && current > 0) invested = current;
  if (!(invested > 0) && provided > 0) invested = provided;
  const hours = lifetimeHours(pos.createdTime, pos.openedTime, now);
  const apy = computeNavApyPct(earned, invested, hours);
  if (apy == null) return null;
  return { apy, fees: earned, invested, days: hours / 24 };
}

function revertTokenUsd(data, addr, amount) {
  const amt = Number(amount) || 0;
  if (!(amt > 0) || !data) return 0;
  const tokens = data.tokens || {};
  const meta = tokens[String(addr || "").toLowerCase()] || tokens[addr] || {};
  let px = Number(meta.price);
  if (!Number.isFinite(px) && meta.prices) px = Number(meta.prices.usd);
  if (!Number.isFinite(px)) return 0;
  return amt * px;
}

function revertFeeApyFromData(data, nowMs) {
  if (!data) return null;
  const now = nowMs == null ? Date.now() : nowMs;
  const fClaim =
    revertTokenUsd(data, data.token0, data.collected_fees0) +
    revertTokenUsd(data, data.token1, data.collected_fees1);
  const fPend =
    revertTokenUsd(data, data.token0, data.uncollected_fees0) +
    revertTokenUsd(data, data.token1, data.uncollected_fees1);
  const feesVal = Number(data.fees_value) || 0;
  const fees = Math.max(fClaim + fPend, feesVal);
  const farm = Number(data.rewards_value) || 0;
  const earned = fees + (farm > 0 ? farm : 0);
  const invested = Number(data.deposits_value);
  let hours = Number(data.age) > 0 ? Number(data.age) * 24 : 0;
  const fromMint = lifetimeHours(data.first_mint_ts, data.first_mint_ts, now);
  if (fromMint) hours = fromMint;
  const apy = computeNavApyPct(earned, invested, hours);
  if (apy == null) return null;
  return { apy, fees: earned, invested, days: hours / 24 };
}

function mapLimit(items, limit, fn) {
  const list = items || [];
  let i = 0;
  const workers = Math.min(limit, Math.max(list.length, 1));
  const run = async function () {
    while (i < list.length) {
      const idx = i++;
      await fn(list[idx], idx);
    }
  };
  const jobs = [];
  for (let w = 0; w < workers; w++) jobs.push(run());
  return Promise.all(jobs);
}

function applyFeeApy(tool, computed) {
  if (!computed || computed.apy == null) return;
  tool.apy = formatApyOneDecimal(computed.apy);
  tool.apySource = "fee-apr";
  tool.feeUsd = computed.fees;
  tool.investedUsd = computed.invested;
}

function applyAerodromeOpenUrl(tool, kry) {
  if (!kry || !AERODROME_NFPM[kry.nfpm]) return;
  tool.primaryUrl = "https://aerodrome.finance/deposit?tokenId=" + kry.nft;
}

function cacheKey(kry) {
  return kry.chainId + ":" + kry.nfpm + ":" + kry.nft;
}

function loadFeeCache() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "..", "data", "lp-fee-cache.json"), "utf8");
    const json = JSON.parse(raw);
    return (json && json.rates) || {};
  } catch {
    return {};
  }
}

function applyCachedFeeApys(tools) {
  const cache = loadFeeCache();
  (tools || []).forEach(function (tool) {
    if (!tool || !LP_FEE_CATS[tool.categoryId] || isLabsFrozenRate(tool)) return;
    if (tool.apySource === "fee-apr") return;
    const kry = parseKrystalLink(tool.link);
    if (!kry) return;
    const row = cache[cacheKey(kry)];
    if (!row || row.apy == null) return;
    applyFeeApy(tool, { apy: row.apy, fees: row.fees, invested: row.invested });
  });
}

function stripSheetRoiForLp(tools) {
  (tools || []).forEach(function (tool) {
    if (!tool || !LP_FEE_CATS[tool.categoryId] || isLabsFrozenRate(tool)) return;
    if (tool.apySource === "fee-apr") return;
    const link = String(tool.link || "");
    if (!parseKrystalLink(link) && !parseRevertLink(link)) return;
    tool.apy = "";
    tool.apySource = "fee-missing";
  });
}

async function refreshLpFeeApys(tools, nowMs, opts) {
  const now = nowMs == null ? Date.now() : nowMs;
  const liveKrystal = !!(opts && opts.liveKrystal);
  const list = tools || [];
  applyCachedFeeApys(list);
  const revertJobs = [];
  const krystalJobs = [];
  list.forEach(function (tool) {
    if (!tool || !LP_FEE_CATS[tool.categoryId] || isLabsFrozenRate(tool)) return;
    const link = String(tool.link || "");
    const rev = parseRevertLink(link);
    const kry = parseKrystalLink(link);
    if (rev) revertJobs.push({ tool, rev });
    else if (kry) krystalJobs.push({ tool, kry });
  });

  await mapLimit(revertJobs, 6, async function (job) {
    try {
      const url = `https://api.revert.finance/v1/positions/${job.rev.network}/${job.rev.exchange}/${job.rev.nft}`;
      const payload = await fetchJsonOk(url, 8000, {
        headers: { Origin: "https://revert.finance", Referer: "https://revert.finance/" },
      });
      const data = payload && payload.success ? payload.data : payload;
      applyFeeApy(job.tool, revertFeeApyFromData(data, now));
    } catch {
      /* keep Excel */
    }
  });

  if (!liveKrystal) {
    krystalJobs.forEach(function (job) {
      applyAerodromeOpenUrl(job.tool, job.kry);
    });
    return list;
  }

  const metaPromises = {};
  await mapLimit(krystalJobs, 8, async function (job) {
    const key = job.kry.chainId + ":" + job.kry.nfpm + ":" + job.kry.nft;
    if (!metaPromises[key]) {
      metaPromises[key] = (async function () {
        let data = null;
        try {
          data = await fetchRevertPosition(job.kry);
        } catch {
          data = null;
        }
        let owner = addrFromEthCall(data && (data.owner || data.og_owner));
        if (!owner) {
          try {
            owner = await ownerOfNft(job.kry.chainId, job.kry.nfpm, job.kry.nft, 4000);
          } catch {
            owner = "";
          }
        }
        return { owner: owner || "", data: data };
      })();
    }
    const meta = await metaPromises[key];
    job.owner = meta.owner;
    job.revertData = meta.data;
  });

  const walletKeys = {};
  krystalJobs.forEach(function (job) {
    const owner = job.owner;
    if (!owner) return;
    const wk = job.kry.chainId + ":" + owner;
    if (!walletKeys[wk]) {
      walletKeys[wk] = { chainId: job.kry.chainId, owner, needed: [], posById: null };
    }
    walletKeys[wk].needed.push((job.kry.nfpm + "-" + job.kry.nft).toLowerCase());
  });

  await mapLimit(Object.keys(walletKeys), 4, async function (wk) {
    const meta = walletKeys[wk];
    try {
      meta.posById = await krystalPositionsForWallet(meta.owner, meta.chainId, meta.needed);
    } catch {
      meta.posById = {};
    }
  });

  krystalJobs.forEach(function (job) {
    applyAerodromeOpenUrl(job.tool, job.kry);
    if (job.owner) {
      const wk = job.kry.chainId + ":" + job.owner;
      const meta = walletKeys[wk];
      const map = meta && meta.posById;
      const id = (job.kry.nfpm + "-" + job.kry.nft).toLowerCase();
      const pos = map && (map[id] || map["tid:" + job.kry.nft]);
      let computed = krystalFeeApyFromPos(pos, now);
      const fromRevert = revertFeeApyFromData(job.revertData, now);
      if (computed && fromRevert && fromRevert.fees > computed.fees) computed = fromRevert;
      else if (!computed) computed = fromRevert;
      applyFeeApy(job.tool, computed);
    } else {
      applyFeeApy(job.tool, revertFeeApyFromData(job.revertData, now));
    }
  });

  return list;
}

module.exports = {
  feeApyPct,
  computeNavApyPct,
  parseKrystalLink,
  parseRevertLink,
  krystalFeeApyFromPos,
  revertFeeApyFromData,
  refreshLpFeeApys,
  applyCachedFeeApys,
  formatApyOneDecimal,
};
