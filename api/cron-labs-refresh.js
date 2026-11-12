/**
 * Daily snapshot of Labs looping APY + live Labs wallet rates.
 * Vercel cron GET /api/cron-labs-refresh
 */
const {
  applyLabsStableCatalog,
  refreshAllLabsLiveRates,
} = require("../lib/labs-stable-strategies");
const { refreshLiveSheetStableApys } = require("../lib/refresh-live-stable-apys");

function cronAuthorized(req) {
  if (req.headers["x-vercel-cron"] === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = String(req.headers.authorization || "");
  return auth === `Bearer ${secret}`;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "GET or POST" });
    return;
  }
  if (!cronAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const tools = await refreshLiveSheetStableApys(
      await refreshAllLabsLiveRates(applyLabsStableCatalog([]), Date.now(), { persist: true }),
    );
    const labs = tools.filter(function (t) {
      return t && t.strategyId;
    });
    res.status(200).json({
      ok: true,
      at: new Date().toISOString(),
      labs: labs.map(function (t) {
        return {
          id: t.strategyId,
          rateKind: t.rateKind,
          apy: t.apy,
          sampleCount: t.sampleCount || null,
          liveEntryAprPct: t.liveEntryAprPct || null,
        };
      }),
    });
  } catch (e) {
    console.error("cron-labs-refresh", e);
    res.status(500).json({ error: String(e.message || e).slice(0, 300) });
  }
};
