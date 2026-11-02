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
  {
    id: "labs-pendle-lp-apxusd-20270210",
    status: "active",
    protocol: "Pendle",
    title: "Pendle LP · apxUSD",
    pair: "LP-apxUSD-10FEB2027",
    chain: "Ethereum",
    chainId: 1,
    marketAddress: "0x99f8c4d0038cda3adcbcd78eb37fcb5916d23e7a",
    tokenAddress: "0x99f8c4d0038cda3adcbcd78eb37fcb5916d23e7a",
    wallet: "0x1fb07ac5643428710ee3bf5a73a4a66d0762f355",
    costBasisUsd: 3512.69,
    openDateMs: Date.parse("2026-10-28T15:44:28.534Z"),
    deposits: [
      {
        usd: 2010.32,
        at: "2026-10-28T13:27:47.000Z",
        tx: "0x1f47756f5f24739f2e53f3500056fa6a5b9ffcfaf32f70d6089b33d1a26c7be0",
      },
      {
        usd: 1502.37,
        at: "2026-10-28T18:47:23.000Z",
        tx: "0x8f837ff4b12b2415c591ba7b8abbb9dc41cbb1ed8994c6d6f5e7b9f652be065c",
      },
    ],
    savedAprPct: "214.0",
    liveEntryAprPct: null,
    rateKind: "wallet-live",
    rateKindLabel: "фактическая доходность позиции",
    rateScope: "pendle-lp-no-il",
    publishedAt: "",
    sourceUrl: "",
    primaryUrl:
      "https://app.pendle.finance/trade/pools/0x99f8c4d0038cda3adcbcd78eb37fcb5916d23e7a/zap/in?chain=ethereum",
    maturityAt: "2027-02-11T00:00:00.000Z",
    descRu:
      "Pendle LP без IL: SY + PT apxUSD до 10 февраля 2027. Ставка на карточке — фактическая с двух входов (2010,32 + 1502,37) плюс несклейменный PENDLE, пересчитанная в год. Это не 244% с экрана Pendle: там форвард пула.",
    descEn:
      "Pendle LP with no IL: SY + PT apxUSD to 10 Feb 2027. The card rate is realized from two entries (2010.32 + 1502.37) plus unclaimed PENDLE, annualized. It is not the 244% pool forward APY on Pendle.",
    extraLinks: [
      {
        labelRu: "PT apxUSD",
        labelEn: "PT apxUSD",
        url: "https://app.pendle.finance/trade/markets/0x99f8c4d0038cda3adcbcd78eb37fcb5916d23e7a/swap?chain=ethereum&view=pt",
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

function isWalletLiveRate(tool) {
  return !!(tool && tool.rateKind === "wallet-live");
}

function computeWalletLiveApy(costUsd, currentUsd, openDateMs, nowMs) {
  const cost = Number(costUsd);
  const current = Number(currentUsd);
  const open = Number(openDateMs);
  const now = nowMs == null ? Date.now() : nowMs;
  if (!(cost > 0) || !Number.isFinite(current) || !(open > 0)) return null;
  const days = Math.max((now - open) / 86400000, 1 / 24);
  const retPct = ((current - cost) / cost) * 100;
  return retPct * (365 / days);
}

function formatApyOneDecimal(n) {
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10) / 10);
}

function labsStableToTool(strategy, nowMs) {
  const live = isWalletLiveRate(strategy);
  return {
    id: strategy.id,
    strategyId: strategy.id,
    categoryId: "stables",
    name: strategy.title,
    platform: strategy.title,
    protocol: strategy.protocol,
    pair: strategy.pair,
    savedAprPct: live ? "" : strategy.savedAprPct,
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
    wallet: strategy.wallet || "",
    costBasisUsd: strategy.costBasisUsd == null ? "" : strategy.costBasisUsd,
    openDateMs: strategy.openDateMs || 0,
    skipTvl: true,
    status: labsStrategyStatus(strategy, nowMs),
  };
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

function claimUsdFromPendleLp(lp, market) {
  const claims = (lp && lp.claimTokenAmounts) || [];
  const rewards = (market && market.rewardTokens) || [];
  const priceByAddr = {};
  rewards.forEach(function (tok) {
    const addr = normalizeAddr(tok && tok.address);
    const px = Number(tok && tok.price && tok.price.usd);
    if (addr && Number.isFinite(px)) priceByAddr[addr] = px;
  });
  let usd = 0;
  claims.forEach(function (c) {
    const addr = normalizeAddr(c && (c.token || c.address));
    const amount = Number(c && c.amount) / 1e18;
    const px = priceByAddr[addr];
    if (Number.isFinite(amount) && Number.isFinite(px)) usd += amount * px;
  });
  return usd;
}

async function refreshLabsLiveWalletRates(tools, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const list = tools || [];
  const jobs = list.filter(isWalletLiveRate);
  if (!jobs.length) return list;
  await Promise.all(
    jobs.map(async function (tool) {
      const wallet = String(tool.wallet || "").toLowerCase();
      const market = normalizeAddr(tool.marketAddress);
      const chainId = tool.chainId || 1;
      if (!wallet || !market) return;
      const posUrl = `https://api-v2.pendle.finance/core/v1/dashboard/positions/database/${wallet}`;
      const mktUrl = `https://api-v2.pendle.finance/core/v1/${chainId}/markets/${market}`;
      const [pos, mkt] = await Promise.all([fetchJsonOk(posUrl, 8000), fetchJsonOk(mktUrl, 8000)]);
      let lp = null;
      for (const chainEntry of (pos && pos.positions) || []) {
        for (const op of chainEntry.openPositions || []) {
          const id = String(op.marketId || "").toLowerCase();
          if (id.indexOf(market) >= 0) {
            lp = op.lp;
            break;
          }
        }
      }
      if (!lp) return;
      const lpUsd = Number(lp.valuation || 0);
      const claimUsd = claimUsdFromPendleLp(lp, mkt);
      const current = lpUsd + claimUsd;
      const apy = computeWalletLiveApy(tool.costBasisUsd, current, tool.openDateMs, now);
      if (apy == null) return;
      tool.apy = formatApyOneDecimal(apy);
      tool.currentValueUsd = current;
      tool.claimUsd = claimUsd;
      tool.daysWorked = Math.max((now - Number(tool.openDateMs)) / 86400000, 0);
      const daysFloor = Math.floor(tool.daysWorked);
      const hours = Math.floor(tool.daysWorked * 24);
      tool.period = hours < 72 ? hours + " ч" : daysFloor + " дн";
      const marketApy = Number(mkt && mkt.aggregatedApy);
      if (Number.isFinite(marketApy)) {
        tool.liveEntryAprPct = formatApyOneDecimal(marketApy * 100);
      }
    }),
  );
  return list;
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
    if (isWalletLiveRate(s)) {
      row.savedAprPct = "";
      row.apy = String(s.savedAprPct || "0");
    } else {
      row.savedAprPct = String(s.savedAprPct);
      row.apy = row.savedAprPct;
    }
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
  isWalletLiveRate,
  isLabsStrategyLive,
  isLabsToolLive,
  labsStableToTool,
  applyLabsStableCatalog,
  computeWalletLiveApy,
  refreshLabsLiveWalletRates,
};
