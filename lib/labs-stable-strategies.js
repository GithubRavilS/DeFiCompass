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
    rateKind: "review-saved",
    rateScope: "pt-only",
    publishedAt: "",
    sourceUrl: "https://t.me/c/2520601362/233/740",
    primaryUrl:
      "https://app.pendle.finance/trade/markets/0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e/swap?chain=ethereum&view=pt&chart=price",
    maturityAt: "2026-12-17T00:00:00.000Z",
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
      {
        labelRu: "Исходный разбор",
        labelEn: "Source review",
        url: "https://t.me/c/2520601362/233/740",
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
    rateKind: "review-saved",
    rateScope: "pt-strcx",
    publishedAt: "2026-10-05",
    sourceUrl: "https://t.me/c/2520601362/292/802",
    primaryUrl:
      "https://app.pendle.finance/trade/markets/0x8ce3a13852d13e0e991c677a8c6137584e2b7635/swap?chain=ethereum&view=pt&chart=price",
    maturityAt: "2026-11-26T00:00:00.000Z",
    maturityKind: "pt-issue",
    descRu:
      "PT на базе токенизированного STRC. Ставка сохранена на момент разбора; долларовый результат зависит также от стоимости расчётного актива. Не подменять эту позицию обычными акциями STRC, YT или LP на Pendle. Не использовать дивидендную ставку STRC 12% вместо ставки PT. Дата 26 ноября относится к PT-выпуску. Самим бессрочным привилегированным акциям STRC не присваивать дату погашения.",
    descEn:
      "PT on tokenized STRC. The rate is saved from the review; dollar outcome also depends on the settlement asset price. This is not ordinary STRC stock, Pendle YT, or LP. Do not use the 12% STRC dividend in place of the PT rate. 26 November is the PT issue expiry. Perpetual preferred STRC has no maturity date.",
    extraLinks: [
      {
        labelRu: "Исходный разбор",
        labelEn: "Source review",
        url: "https://t.me/c/2520601362/292/802",
      },
    ],
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
    rateKind: "review-saved",
    rateScope: "saved-fxb",
    publishedAt: "",
    sourceUrl: "https://t.me/c/2520601362/304/806",
    primaryUrl:
      "https://swap.cow.fi/#/1/limit/0x853d955acef822db058eb8505911ed77f175b99e/0x76237bcfdbe8e06fb774663add96216961df4ff3",
    maturityAt: "2027-01-01T00:00:00.000Z",
    descRu:
      "При погашении 1 FXB конвертируется в 1 Legacy FRAX. 16,0% годовых — сохранённый ориентир исходного разбора, его не пересчитывают ежедневно по уменьшающемуся сроку до погашения. Сохранённая ставка не гарантирует доходность в USDC или долларах. Ориентир цены входа в разборе был около 0,965 — это не сегодняшняя рекомендация и не подставляется в новый ордер.",
    descEn:
      "At maturity 1 FXB converts to 1 Legacy FRAX. The 16.0% APY is the saved review figure and is not recalculated daily as time to maturity shrinks. The saved rate does not guarantee a USDC or dollar yield. The review mentioned an entry around 0.965; that is not today's order and is not pre-filled.",
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

function parseMaturityMs(maturityAt) {
  const n = Date.parse(maturityAt);
  return Number.isFinite(n) ? n : NaN;
}

function isLabsStrategyLive(strategy, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  if (!strategy || strategy.status === "disabled" || strategy.status === "matured") return false;
  const mat = parseMaturityMs(strategy.maturityAt);
  if (Number.isFinite(mat) && now >= mat) return false;
  return true;
}

function isLabsToolLive(tool, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  if (!tool) return false;
  if (isDisabledCurveMonadPool(tool)) return false;
  if (tool.strategyStatus === "disabled" || tool.strategyStatus === "matured") return false;
  const mat = parseMaturityMs(tool.maturityAt);
  if (Number.isFinite(mat) && now >= mat) return false;
  return true;
}

function labsStableToTool(strategy, id) {
  return {
    id,
    strategyId: strategy.id,
    categoryId: "stables",
    name: strategy.title,
    platform: strategy.title,
    protocol: strategy.protocol,
    pair: strategy.pair,
    apy: strategy.savedAprPct,
    chain: strategy.chain,
    link: strategy.primaryUrl,
    extraLinks: strategy.extraLinks,
    desc: strategy.descRu,
    descEn: strategy.descEn,
    rateKind: strategy.rateKind,
    rateScope: strategy.rateScope || "",
    publishedAt: strategy.publishedAt || "",
    sourceUrl: strategy.sourceUrl,
    maturityAt: strategy.maturityAt,
    maturityKind: strategy.maturityKind || "",
    strategyStatus: strategy.status,
    marketAddress: strategy.marketAddress,
    tokenAddress: strategy.tokenAddress,
    skipTvl: true,
    status: "active",
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
  let nextId = 1;
  base.forEach((t) => {
    const n = Number(t && t.id);
    if (Number.isFinite(n) && n >= nextId) nextId = n + 1;
  });
  LABS_STABLE_STRATEGIES.forEach((s) => {
    if (!isLabsStrategyLive(s, now)) return;
    base.push(labsStableToTool(s, nextId++));
  });
  return base;
}

module.exports = {
  DISABLED_CURVE_MONAD_LP,
  LABS_STABLE_STRATEGIES,
  isDisabledCurveMonadPool,
  isLabsStrategyLive,
  isLabsToolLive,
  labsStableToTool,
  applyLabsStableCatalog,
};
