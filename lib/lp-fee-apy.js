/**
 * LP card APY = trading fees only, never PnL / ROI / IL.
 * feesUsd / investedUsd * (365 / days) * 100
 */

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
    const v = x && x.quotes && x.quotes.usd && x.quotes.usd.value;
    const n = Number(v);
    if (Number.isFinite(n)) tot += n;
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
  if (!(inv > 0) || !Number.isFinite(fees) || fees < 0) return false;
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
  params.set("limit", "200");
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
  const fees = usdFromTokenRows(pos.feePending) + usdFromTokenRows(pos.feesClaimed);
  let invested = Number(pos.totalDepositValue);
  const provided = usdFromTokenRows(pos.providedAmounts);
  if (!(invested > 0) && provided > 0) invested = provided;
  const openSec = Number(pos.openedTime || pos.createdTime);
  if (!(openSec > 0)) return null;
  const days = Math.max((nowMs - openSec * 1000) / 86400000, 1 / 24);
  const apy = feeApyPct(fees, invested, days);
  if (apy == null) return null;
  return { apy, fees, invested, days };
}

function revertFeeApyFromData(data) {
  if (!data) return null;
  const fees = Number(data.fees_value);
  const invested = Number(data.deposits_value);
  const days = Number(data.age);
  const apy = feeApyPct(fees, invested, days);
  if (apy == null) return null;
  return { apy, fees, invested, days };
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

async function refreshLpFeeApys(tools, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const list = tools || [];
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
      applyFeeApy(job.tool, revertFeeApyFromData(data));
    } catch {
      /* keep Excel */
    }
  });

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
      applyFeeApy(job.tool, krystalFeeApyFromPos(pos, now));
    }
    if (job.tool.apySource !== "fee-apr" && revertFeesTrusted(job.kry.nfpm, job.revertData)) {
      applyFeeApy(job.tool, revertFeeApyFromData(job.revertData));
    }
  });

  return list;
}

module.exports = {
  feeApyPct,
  parseKrystalLink,
  parseRevertLink,
  krystalFeeApyFromPos,
  revertFeeApyFromData,
  refreshLpFeeApys,
  formatApyOneDecimal,
};
