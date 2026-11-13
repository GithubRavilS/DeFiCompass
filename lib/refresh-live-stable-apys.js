/**
 * Overlay live APYs onto sheet-backed stables that are not frozen Labs rates.
 * Does not write the ethereum sheet. Failures keep the Excel number.
 */

const FROZEN_PENDLE_MARKETS = ["0x90b70c407f1077f8eb92bf423b44cd92329b737a"];

function normalizeAddr(value) {
  const m = String(value || "")
    .toLowerCase()
    .match(/0x[a-f0-9]{40}/);
  return m ? m[0] : "";
}

function formatApyOneDecimal(n) {
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10) / 10);
}

async function fetchJsonOk(url, timeoutMs, init) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    ctrl && timeoutMs
      ? setTimeout(function () {
          ctrl.abort();
        }, timeoutMs)
      : null;
  try {
    const res = await fetch(
      url,
      Object.assign(
        {
          headers: { "User-Agent": "DeFi-Compass/1.0" },
          signal: ctrl ? ctrl.signal : undefined,
        },
        init || {},
      ),
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isFrozenSheetStable(tool) {
  if (!tool || tool.categoryId !== "stables") return true;
  if (
    tool.rateKind === "review-saved" ||
    tool.rateKind === "wallet-live" ||
    tool.rateKind === "daily-average"
  ) {
    return true;
  }
  const addr = normalizeAddr(tool.link);
  if (addr && FROZEN_PENDLE_MARKETS.indexOf(addr) >= 0) return true;
  return false;
}

function yearnVaultFromLink(link) {
  const m = String(link || "").match(/yearn\.fi\/vaults\/(\d+)\/(0x[a-fA-F0-9]{40})/);
  if (!m) return null;
  return { chainId: m[1], address: m[2] };
}

/** Yearn vault APY only. Ethereum/Bitcoin LP APY: lib/lp-fee-apy.js (Navigator scan). */

async function overlayYearn(tool) {
  const v = yearnVaultFromLink(tool.link);
  if (!v) return;
  const d = await fetchJsonOk(`https://ydaemon.yearn.fi/${v.chainId}/vaults/${v.address}`, 7000);
  const net = d && d.apr && (d.apr.netAPR != null ? d.apr.netAPR : d.apr.netApr);
  const n = Number(net);
  if (!Number.isFinite(n)) return;
  tool.apy = formatApyOneDecimal(n * 100);
  tool.apySource = "yearn-live";
}

async function refreshLiveSheetStableApys(tools) {
  const list = tools || [];
  const jobs = list.filter(function (t) {
    return t && t.categoryId === "stables" && !isFrozenSheetStable(t);
  });
  await Promise.all(
    jobs.map(async function (tool) {
      const link = String(tool.link || "");
      try {
        if (/yearn\.fi\/vaults\//i.test(link)) await overlayYearn(tool);
      } catch {
        /* keep Excel APY */
      }
    }),
  );
  return list;
}

module.exports = {
  FROZEN_PENDLE_MARKETS,
  isFrozenSheetStable,
  refreshLiveSheetStableApys,
};
