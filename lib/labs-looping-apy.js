/**
 * Pendle PT Looping APY for PT-USD3 / USDT at a fixed leverage.
 * Card rate = mean of one UTC-day snapshot from launch, not last print.
 */

const PENDLE_CORE = "https://api-v2.pendle.finance/core";
const LOOPING_PT = "0x7f47c3e6b2c00fc4eb4d5ae50d0ab0ab6888eb4d";
const LOOPING_CHAIN = 1;
const LOOPING_DEBT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const DEFAULT_LEVERAGE = 7.5;

function loopingApyPct(fixedApy, borrowApy, leverage) {
  const f = Number(fixedApy);
  const b = Number(borrowApy);
  const L = Number(leverage);
  if (!Number.isFinite(f) || !Number.isFinite(b) || !(L > 1)) return null;
  return 100 * (L * f - (L - 1) * b);
}

function utcDateKey(nowMs) {
  const ms = nowMs == null ? Date.now() : nowMs;
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchJsonOk(url, timeoutMs) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    ctrl && timeoutMs
      ? setTimeout(function () {
          ctrl.abort();
        }, timeoutMs)
      : null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DeFi-Compass/1.0" },
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pickUsdtOption(payload) {
  const options = (payload && payload.options) || [];
  const usdt = options.find(function (o) {
    return String(o.debtSymbol || "").toUpperCase() === "USDT";
  });
  if (usdt) return usdt;
  return options.find(function (o) {
    return String(o.debtAsset || "").toLowerCase() === LOOPING_DEBT;
  });
}

function snapshotFromOption(option, leverage, nowMs) {
  if (!option) return null;
  const data = option.data || {};
  const ref = data.reference || {};
  const fixed = Number(ref.fixedApy != null ? ref.fixedApy : data.fixedApy);
  const borrow = Number(data.borrowApy);
  const apyPct = loopingApyPct(fixed, borrow, leverage);
  if (apyPct == null) return null;
  return {
    date: utcDateKey(nowMs),
    apyPct,
    fixedApy: fixed,
    borrowApy: borrow,
    leverage: Number(leverage),
    source: "pendle-live",
    boxId: option.boxId || "",
    marketUrl: option.marketUrl || "",
  };
}

async function fetchUsd3UsdtLoopingSnapshot(leverage, nowMs) {
  const L = leverage == null ? DEFAULT_LEVERAGE : leverage;
  const url = `${PENDLE_CORE}/v1/pt-looping/loop/pts/${LOOPING_CHAIN}/${LOOPING_PT}/looping`;
  const payload = await fetchJsonOk(url, 8000);
  return snapshotFromOption(pickUsdtOption(payload), L, nowMs);
}

function meanApyPct(rows, launchDate) {
  const launch = String(launchDate || "");
  const vals = (rows || [])
    .filter(function (r) {
      return r && (!launch || String(r.date) >= launch) && Number.isFinite(Number(r.apyPct));
    })
    .map(function (r) {
      return Number(r.apyPct);
    });
  if (!vals.length) return null;
  return (
    vals.reduce(function (a, b) {
      return a + b;
    }, 0) / vals.length
  );
}

function mergeDailyRows(base, extra) {
  const map = {};
  (base || []).concat(extra || []).forEach(function (row) {
    if (!row || !row.date) return;
    const key = String(row.date);
    const prev = map[key];
    if (!prev) {
      map[key] = row;
      return;
    }
    if (row.source === "pendle-live" && prev.source !== "pendle-live") {
      map[key] = row;
      return;
    }
    if (row.source === prev.source) map[key] = row;
  });
  return Object.keys(map)
    .sort()
    .map(function (k) {
      return map[k];
    });
}

module.exports = {
  PENDLE_CORE,
  LOOPING_PT,
  LOOPING_CHAIN,
  LOOPING_DEBT,
  DEFAULT_LEVERAGE,
  loopingApyPct,
  utcDateKey,
  fetchUsd3UsdtLoopingSnapshot,
  meanApyPct,
  mergeDailyRows,
  snapshotFromOption,
  pickUsdtOption,
};
