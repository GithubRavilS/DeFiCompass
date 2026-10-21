/**
 * Labs Strategies in «Стейблкоин-стратегии»: saved review APRs + contract maturity.
 * Live list hides a row when Date.now() >= maturityAt (no redeploy).
 */

const DISABLED_CURVE_MONAD_LP = "0x942644106b073e30d72c2c5d7529d5c296ea91ab";

const LABS_STABLE_STRATEGIES = [
  {
    id: "labs-pt-usd3",
    status: "active",
    protocol: "Pendle",
    title: "Pendle · PT-USD3",
    pair: "PT-USD3-17DEC2026",
    chain: "Ethereum",
    chainId: 1,
    marketAddress: "0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e",
    tokenAddress: "0x7f47c3e6b2c00fc4eb4d5ae50d0ab0ab6888eb4d",
    savedAprPct: "14.0",
    liveEntryAprPct: null,
    rateKind: "review-saved",
    rateKindLabel: "сохранённая ставка исходного разбора",
    rateScope: "pt-only",
    publishedAt: "",
    sourceUrl: "https://t.me/c/2520601362/233/740",
    primaryUrl:
      "https://app.pendle.finance/trade/markets/0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e/swap?chain=ethereum&view=pt&chart=price",
    maturityAt: "2026-12-17T00:00:00.000Z", // expiry() 1797465600
    descRu:
      "Важное различие: 14% относится к базовой PT-позиции. Итоговая доходность полной конструкции с Morpho и Fluid зависит от плавающих ставок займа и размещения USDC. Не обозначать всю комбинированную стратегию как фиксированные 14%.",
    descEn:
      "Important: 14% is the base PT position only. The Morpho + Fluid construction depends on floating borrow and USDC deposit rates. Do not treat the full stack as a locked 14%.",
    extraLinks: [
      {
        labelRu: "Morpho · залог PT-USD3 / займ USDC",
        labelEn: "Morpho · PT-USD3 collateral / USDC borrow",
        url: "https://app.morpho.org/ethereum/variable/0xf8c5aa31ea6b2a068a9eddb46dd110cae57bf0f12be9583a3f9a818effecba89/pt-usd3-17dec2026-usdc#market",
      },
      {
        labelRu: "Fluid Lite USDC",
        labelEn: "Fluid Lite USDC",
        url: "https://fluid.io/1/lite/usdc?mode=deposit",
      },
    ],
  },
  {
    id: "labs-pt-strcx",
    status: "active",
    protocol: "Pendle",
    title: "PT-STRCx · Strategy",
    pair: "PT-STRCx-26NOV2026",
    chain: "Ethereum",
    chainId: 1,
    marketAddress: "0x8ce3a13852d13e0e991c677a8c6137584e2b7635",
    tokenAddress: "0x599ef448e1d3378ed2dd7982d4b00615d9e5bf77",
    savedAprPct: "22.1",
    liveEntryAprPct: null,
    rateKind: "review-saved",
    rateKindLabel: "сохранённая ставка исходного разбора",
    rateScope: "pt-strcx",
    publishedAt: "2026-10-05",
    sourceUrl: "https://t.me/c/2520601362/292/802",
    primaryUrl:
      "https://app.pendle.finance/trade/markets/0x8ce3a13852d13e0e991c677a8c6137584e2b7635/swap?chain=ethereum&view=pt&chart=price",
    maturityAt: "2026-11-26T00:00:00.000Z", // expiry() 1795651200
    maturityKind: "pt-issue",
    descRu:
      "PT на базе токенизированного STRC. Ставка сохранена на момент разбора; долларовый результат зависит также от стоимости расчётного актива.",
    descEn:
      "PT on tokenized STRC. The rate is saved from the review; dollar outcome also depends on the settlement asset price.",
    extraLinks: [],
  },
  {
    id: "labs-fxb-20261231",
    status: "active",
    protocol: "Frax Finance",
    title: "Frax Finance · FXB20261231",
    pair: "FXB20261231 / FRAX",
    chain: "Ethereum",
    chainId: 1,
    marketAddress: "0x76237bcfdbe8e06fb774663add96216961df4ff3",
    tokenAddress: "0x76237bcfdbe8e06fb774663add96216961df4ff3",
    settlementAsset: "0x853d955acef822db058eb8505911ed77f175b99e",
    savedAprPct: "16.0",
    liveEntryAprPct: null,
    rateKind: "review-saved",
    rateKindLabel: "сохранённая ставка исходного разбора",
    rateScope: "saved-fxb",
    publishedAt: "",
    sourceUrl: "https://t.me/c/2520601362/304/806",
    primaryUrl:
      "https://swap.cow.fi/#/1/limit/0x853d955acef822db058eb8505911ed77f175b99e/0x76237bcfdbe8e06fb774663add96216961df4ff3",
    maturityAt: "2027-01-01T00:00:00.000Z", // MATURITY_TIMESTAMP() 1798761600
    descRu:
      "При погашении 1 FXB конвертируется в 1 Legacy FRAX. Сохранённая ставка не гарантирует доходность в USDC или долларах. Не заменять Legacy FRAX на frxUSD или токен FRAX другого назначения.",
    descEn:
      "At maturity 1 FXB converts to 1 Legacy FRAX. The saved rate does not guarantee a USDC or dollar yield. Do not substitute frxUSD or any other FRAX token for Legacy FRAX.",
    extraLinks: [
      {
        labelRu: "График FXB/FRAX",
        labelEn: "FXB/FRAX chart",
        url: "https://www.geckoterminal.com/eth/pools/0xe035e27a8ed6842b478933820f90093d205f7098",
      },
      {
        labelRu: "Облигации Frax",
        labelEn: "Frax bonds",
        url: "https://app.frax.finance/fxb/bonds",
      },
      {
        labelRu: "Исходная стратегия",
        labelEn: "Source strategy",
        url: "https://t.me/c/2520601362/304/806",
      },
      {
        labelRu: "Инструкция по входу",
        labelEn: "Entry guide",
        url: "https://t.me/c/2520601362/304/808",
      },
    ],
  },
];

function normalizeAddr(value) {
  const m = String(value || "")
    .toLowerCase()
    .match(/0x[a-f0-9]{40}/);
  return m ? m[0] : "";
}

function isDisabledCurveMonadPool(tool) {
  const blob = [
    tool && tool.link,
    tool && tool.pair,
    tool && tool.name,
    tool && tool.platform,
    tool && tool.desc,
  ]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
  return blob.includes(DISABLED_CURVE_MONAD_LP);
}

function isSavedReviewRate(tool) {
  return !!(tool && tool.rateKind === "review-saved");
}

function parseMaturityMs(maturityAt) {
  const n = Date.parse(maturityAt);
  return Number.isFinite(n) ? n : NaN;
}

function labsStrategyStatus(strategy, nowMs) {
  if (!strategy) return "disabled";
  if (strategy.status === "disabled") return "disabled";
  if (strategy.status === "matured") return "matured";
  const now = nowMs == null ? Date.now() : nowMs;
  const mat = parseMaturityMs(strategy.maturityAt);
  if (Number.isFinite(mat) && now >= mat) return "matured";
  return strategy.status === "active" ? "active" : "disabled";
}

function isLabsStrategyLive(strategy, nowMs) {
  return labsStrategyStatus(strategy, nowMs) === "active";
}

function isLabsToolLive(tool, nowMs) {
  if (!tool) return false;
  if (isDisabledCurveMonadPool(tool)) return false;
  return (
    labsStrategyStatus(
      {
        status: tool.strategyStatus || tool.status,
        maturityAt: tool.maturityAt,
      },
      nowMs,
    ) === "active"
  );
}

function labsStableToTool(strategy, nowMs) {
  return {
    id: strategy.id,
    strategyId: strategy.id,
    categoryId: "stables",
    name: strategy.title,
    platform: strategy.title,
    protocol: strategy.protocol,
    pair: strategy.pair,
    savedAprPct: strategy.savedAprPct,
    liveEntryAprPct: strategy.liveEntryAprPct == null ? null : String(strategy.liveEntryAprPct),
    apy: strategy.savedAprPct,
    chain: strategy.chain,
    chainId: strategy.chainId || 1,
    link: strategy.primaryUrl,
    primaryUrl: strategy.primaryUrl,
    extraLinks: strategy.extraLinks,
    desc: strategy.descRu,
    descEn: strategy.descEn,
    rateKind: strategy.rateKind,
    rateKindLabel: strategy.rateKindLabel || "сохранённая ставка исходного разбора",
    rateScope: strategy.rateScope || "",
    publishedAt: strategy.publishedAt || "",
    sourceUrl: strategy.sourceUrl,
    maturityAt: strategy.maturityAt,
    maturityKind: strategy.maturityKind || "",
    strategyStatus: labsStrategyStatus(strategy, nowMs),
    marketAddress: strategy.marketAddress,
    tokenAddress: strategy.tokenAddress,
    settlementAsset: strategy.settlementAsset || "",
    skipTvl: true,
    status: labsStrategyStatus(strategy, nowMs),
  };
}

function applyLabsStableCatalog(tools, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const knownIds = new Set(LABS_STABLE_STRATEGIES.map((s) => s.id));
  const knownAddrs = new Set(
    LABS_STABLE_STRATEGIES.map((s) => normalizeAddr(s.marketAddress)).filter(Boolean),
  );
  const base = (tools || []).filter((t) => {
    if (isDisabledCurveMonadPool(t)) return false;
    if (t && t.strategyId && knownIds.has(t.strategyId)) return false;
    const addr = normalizeAddr(t && t.link);
    if (addr && knownAddrs.has(addr)) return false;
    return true;
  });
  LABS_STABLE_STRATEGIES.forEach((s) => {
    if (!isLabsStrategyLive(s, now)) return;
    const row = labsStableToTool(s, now);
    row.savedAprPct = String(s.savedAprPct);
    row.apy = row.savedAprPct;
    row.liveEntryAprPct = s.liveEntryAprPct == null ? null : String(s.liveEntryAprPct);
    base.push(row);
  });
  return base;
}

module.exports = {
  DISABLED_CURVE_MONAD_LP,
  LABS_STABLE_STRATEGIES,
  isDisabledCurveMonadPool,
  labsStrategyStatus,
  isSavedReviewRate,
  isLabsStrategyLive,
  isLabsToolLive,
  labsStableToTool,
  applyLabsStableCatalog,
};
