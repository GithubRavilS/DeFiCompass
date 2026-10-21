import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  DISABLED_CURVE_MONAD_LP,
  LABS_STABLE_STRATEGIES,
  isDisabledCurveMonadPool,
  isLabsStrategyLive,
  applyLabsStableCatalog,
  labsStrategyStatus,
} = require("../lib/labs-stable-strategies.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const curve = {
  categoryId: "stables",
  platform: "Curve",
  pair: "AUSD + USDC + USDT0",
  chain: "Monad",
  apy: "14.3",
  link: `https://curve.finance/#/monad/pools/${DISABLED_CURVE_MONAD_LP}/deposit`,
};

assert(isDisabledCurveMonadPool(curve), "curve pool must match by address");
assert(
  !isDisabledCurveMonadPool({
    link: "https://curve.fi/#/ethereum/pools/0x1111111111111111111111111111111111111111/deposit",
  }),
  "other curve pools stay",
);

const beforeMat = Date.parse("2026-11-25T23:59:59.000Z");
const afterStrc = Date.parse("2026-11-26T00:00:00.000Z");
const strc = LABS_STABLE_STRATEGIES.find((s) => s.id === "labs-pt-strcx");
assert(isLabsStrategyLive(strc, beforeMat), "STRCx live before expiry");
assert(!isLabsStrategyLive(strc, afterStrc), "STRCx hidden at expiry");
assert(labsStrategyStatus(strc, beforeMat) === "active", "STRCx active before expiry");
assert(labsStrategyStatus(strc, afterStrc) === "matured", "STRCx matured at expiry");
assert(
  labsStrategyStatus({ ...strc, status: "disabled" }, beforeMat) === "disabled",
  "disabled stays disabled",
);
assert(
  labsStrategyStatus({ ...strc, status: "matured" }, beforeMat) === "matured",
  "catalog matured stays matured",
);

const usd3 = LABS_STABLE_STRATEGIES.find((s) => s.id === "labs-pt-usd3");
assert(usd3.maturityAt === "2026-12-17T00:00:00.000Z", "USD3 uses 17DEC contract expiry");
const primaryUrls = {
  "labs-pt-usd3":
    "https://app.pendle.finance/trade/markets/0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e/swap?chain=ethereum&view=pt&chart=price",
  "labs-pt-strcx":
    "https://app.pendle.finance/trade/markets/0x8ce3a13852d13e0e991c677a8c6137584e2b7635/swap?chain=ethereum&view=pt&chart=price",
  "labs-fxb-20261231":
    "https://swap.cow.fi/#/1/limit/0x853d955acef822db058eb8505911ed77f175b99e/0x76237bcfdbe8e06fb774663add96216961df4ff3",
};
assert(usd3.primaryUrl === primaryUrls["labs-pt-usd3"], "USD3 primary open URL");
assert(usd3.primaryUrl.includes("view=pt"), "USD3 opens PT view");

const fxb = LABS_STABLE_STRATEGIES.find((s) => s.id === "labs-fxb-20261231");
assert(fxb.maturityAt === "2027-01-01T00:00:00.000Z", "FXB uses contract MATURITY_TIMESTAMP");
assert(
  strc.maturityAt === "2026-11-26T00:00:00.000Z",
  "STRCx uses contract PT expiry, not the 25 Nov UI label",
);
assert(
  Date.parse(usd3.maturityAt) === Date.UTC(2026, 11, 17),
  "USD3 maturityAt is 17 Dec 2026 00:00 UTC",
);
assert(
  Date.parse(strc.maturityAt) === Date.UTC(2026, 10, 26),
  "STRCx maturityAt is 26 Nov 2026 00:00 UTC",
);
assert(
  Date.parse(fxb.maturityAt) === Date.UTC(2027, 0, 1),
  "FXB maturityAt is 1 Jan 2027 00:00 UTC",
);
LABS_STABLE_STRATEGIES.forEach((s) => {
  assert(s.maturityAt.endsWith("Z"), `${s.id} maturityAt is UTC`);
  assert(!s.maturityAt.includes("+"), `${s.id} maturityAt has no local offset`);
});
assert(
  fxb.primaryUrl.includes("0x853d955acef822db058eb8505911ed77f175b99e"),
  "Cowswap sells Legacy FRAX",
);
assert(
  fxb.primaryUrl.toLowerCase().includes("0x76237bcfdbe8e06fb774663add96216961df4ff3"),
  "Cowswap buys FXB",
);

const merged = applyLabsStableCatalog(
  [curve, { id: 1, categoryId: "stables", name: "Keep", apy: "5" }],
  beforeMat,
);
assert(!merged.some((t) => isDisabledCurveMonadPool(t)), "curve monad excluded from catalog apply");
assert(merged.filter((t) => t.strategyId).length === 3, "three live labs rows before STRCx expiry");
assert(
  merged.some((t) => t.name === "Keep"),
  "unrelated stables remain",
);

const after = applyLabsStableCatalog([curve], afterStrc);
assert(
  after
    .filter((t) => t.strategyId)
    .map((t) => t.strategyId)
    .join(",") === "labs-pt-usd3,labs-fxb-20261231",
  "STRCx dropped after maturity, others remain",
);

const rates = Object.fromEntries(
  merged.filter((t) => t.strategyId).map((t) => [t.strategyId, t.apy]),
);
assert(rates["labs-pt-usd3"] === "14.0", "saved 14.0");
assert(rates["labs-pt-strcx"] === "22.1", "saved 22.1");
assert(rates["labs-fxb-20261231"] === "16.0", "saved 16.0");
merged
  .filter((t) => t.strategyId)
  .forEach((t) => {
    assert(t.apy === t.savedAprPct, `${t.strategyId} APY is the stored annual rate`);
  });
assert(
  merged
    .filter((t) => t.strategyId)
    .sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy))
    .map((t) => t.apy)
    .join(",") === "22.1,16.0,14.0",
  "sort uses saved annual rates",
);

const requiredKeys = [
  "id",
  "protocol",
  "chain",
  "marketAddress",
  "tokenAddress",
  "savedAprPct",
  "rateKind",
  "publishedAt",
  "sourceUrl",
  "primaryUrl",
  "extraLinks",
  "maturityAt",
  "status",
];
const allowedStatus = new Set(["active", "matured", "disabled"]);
LABS_STABLE_STRATEGIES.forEach((s) => {
  requiredKeys.forEach((k) => {
    assert(Object.prototype.hasOwnProperty.call(s, k), `${s.id} missing ${k}`);
  });
  assert(s.rateKind === "review-saved", `${s.id} rateKind`);
  assert(
    s.rateKindLabel === "сохранённая ставка исходного разбора",
    `${s.id} rate type is the original review rate`,
  );
  assert(allowedStatus.has(s.status), `${s.id} status`);
  assert(typeof s.publishedAt === "string", `${s.id} publishedAt stored, not invented`);
  assert(s.liveEntryAprPct == null, `${s.id} live entry stays a separate empty field`);
  assert(Array.isArray(s.extraLinks), `${s.id} extraLinks`);
  assert(/\.\d{3}Z$/.test(s.maturityAt) || /T.*Z$/.test(s.maturityAt), `${s.id} maturityAt UTC`);
});

assert(strc.publishedAt === "2026-10-05", "STRCx stores the 5 Oct workshop date");
const publicationUrls = {
  "labs-pt-usd3": "https://t.me/c/2520601362/233/740",
  "labs-pt-strcx": "https://t.me/c/2520601362/292/802",
  "labs-fxb-20261231": "https://t.me/c/2520601362/304/806",
};
LABS_STABLE_STRATEGIES.forEach((s) => {
  assert(s.sourceUrl === publicationUrls[s.id], `${s.id} publication URL`);
  assert(!s.sourceUrl.endsWith("."), `${s.id} publication URL has no trailing period`);
  assert(
    s.extraLinks.some((item) => item.url === s.sourceUrl),
    `${s.id} extra links include the publication`,
  );
});
assert(
  merged.find((t) => t.strategyId === "labs-pt-usd3").sourceUrl === publicationUrls["labs-pt-usd3"],
  "live USD3 row stores the publication URL",
);
assert(
  merged.find((t) => t.strategyId === "labs-pt-strcx").sourceUrl ===
    publicationUrls["labs-pt-strcx"],
  "live STRCx row stores the publication URL",
);
assert(
  merged.find((t) => t.strategyId === "labs-fxb-20261231").sourceUrl ===
    publicationUrls["labs-fxb-20261231"],
  "live FXB row stores the publication URL, not the 808 entry guide",
);
assert(usd3.publishedAt === "", "USD3 has no publication date in the source");
assert(fxb.publishedAt === "", "FXB has no publication date in the source");
assert(
  merged.find((t) => t.strategyId === "labs-pt-strcx").publishedAt === "2026-10-05",
  "live STRCx row carries publishedAt",
);
assert(
  merged.find((t) => t.strategyId === "labs-pt-usd3").publishedAt === "",
  "live USD3 row does not invent publishedAt",
);

const stored = merged.find((t) => t.strategyId === "labs-pt-usd3");
assert(usd3.id === "labs-pt-usd3", "catalog id is stable");
assert(stored.id === "labs-pt-usd3", "live row id is the catalog id");
assert(stored.strategyId === "labs-pt-usd3", "stable id on live row");
const shifted = applyLabsStableCatalog(
  [
    { id: 1, categoryId: "stables", name: "A", apy: "1" },
    { id: 40, categoryId: "stables", name: "B", apy: "2" },
  ],
  beforeMat,
);
assert(
  shifted.find((t) => t.strategyId === "labs-pt-usd3").id === "labs-pt-usd3",
  "sheet refresh must not mint a new numeric id",
);
const identity = {
  "labs-pt-usd3": {
    protocol: "Pendle",
    chain: "Ethereum",
    marketAddress: "0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e",
    tokenAddress: "0x7f47c3e6b2c00fc4eb4d5ae50d0ab0ab6888eb4d",
  },
  "labs-pt-strcx": {
    protocol: "Pendle",
    chain: "Ethereum",
    marketAddress: "0x8ce3a13852d13e0e991c677a8c6137584e2b7635",
    tokenAddress: "0x599ef448e1d3378ed2dd7982d4b00615d9e5bf77",
  },
  "labs-fxb-20261231": {
    protocol: "Frax Finance",
    chain: "Ethereum",
    marketAddress: "0x76237bcfdbe8e06fb774663add96216961df4ff3",
    tokenAddress: "0x76237bcfdbe8e06fb774663add96216961df4ff3",
  },
};
Object.keys(identity).forEach((id) => {
  const row = merged.find((t) => t.strategyId === id);
  const exp = identity[id];
  assert(row.protocol === exp.protocol, `${id} protocol`);
  assert(row.chain === exp.chain, `${id} chain`);
  assert(row.chainId === 1, `${id} chainId`);
  assert(row.marketAddress === exp.marketAddress, `${id} market address`);
  assert(row.tokenAddress === exp.tokenAddress, `${id} token address`);
});
assert(
  merged.find((t) => t.strategyId === "labs-fxb-20261231").settlementAsset ===
    "0x853d955acef822db058eb8505911ed77f175b99e",
  "FXB stores Legacy FRAX separately from the FXB token",
);
assert(stored.savedAprPct === "14.0", "saved annual rate on live row");
assert(stored.rateKind === "review-saved", "rate kind is original review");
assert(
  stored.rateKindLabel === "сохранённая ставка исходного разбора",
  "live row stores the original-review rate type",
);
assert(stored.sourceUrl === usd3.sourceUrl, "publication URL on live row");
assert(stored.primaryUrl === usd3.primaryUrl, "primary open URL on live row");
LABS_STABLE_STRATEGIES.forEach((s) => {
  const row = merged.find((t) => t.strategyId === s.id);
  assert(s.primaryUrl === primaryUrls[s.id], `${s.id} catalog primary URL`);
  assert(row.primaryUrl === s.primaryUrl, `${s.id} live primaryUrl`);
  assert(row.link === s.primaryUrl, `${s.id} card CTA uses primary URL`);
  assert(s.primaryUrl !== s.sourceUrl, `${s.id} open URL is not the publication`);
  assert(!s.primaryUrl.endsWith("."), `${s.id} primary URL has no trailing period`);
  assert(
    !s.extraLinks.some((item) => item.url === s.primaryUrl),
    `${s.id} extra links stay off the main open URL`,
  );
});
assert(strc.primaryUrl.includes("view=pt"), "STRCx opens PT view");
const extraUrls = {
  "labs-pt-usd3": [
    "https://app.morpho.org/ethereum/variable/0xf8c5aa31ea6b2a068a9eddb46dd110cae57bf0f12be9583a3f9a818effecba89/pt-usd3-17dec2026-usdc#market",
    "https://fluid.io/1/lite/usdc?mode=deposit",
    "https://t.me/c/2520601362/233/740",
  ],
  "labs-pt-strcx": ["https://t.me/c/2520601362/292/802"],
  "labs-fxb-20261231": [
    "https://www.geckoterminal.com/eth/pools/0xe035e27a8ed6842b478933820f90093d205f7098",
    "https://app.frax.finance/fxb/bonds",
    "https://t.me/c/2520601362/304/806",
    "https://t.me/c/2520601362/304/808",
  ],
};
LABS_STABLE_STRATEGIES.forEach((s) => {
  const urls = s.extraLinks.map((item) => item.url);
  const row = merged.find((t) => t.strategyId === s.id);
  assert(urls.join("\n") === extraUrls[s.id].join("\n"), `${s.id} extra links`);
  assert(
    row.extraLinks.map((item) => item.url).join("\n") === extraUrls[s.id].join("\n"),
    `${s.id} live extra links`,
  );
  urls.forEach((url) => {
    assert(!url.endsWith("."), `${s.id} extra URL has no trailing period: ${url}`);
    assert(url !== s.primaryUrl, `${s.id} extra URL is not the main CTA`);
  });
});
assert(fxb.primaryUrl.includes("/1/limit/"), "FXB opens Cowswap limit");
assert(
  Array.isArray(stored.extraLinks) && stored.extraLinks.length >= 3,
  "extra links on live row",
);
assert(stored.maturityAt === "2026-12-17T00:00:00.000Z", "maturityAt UTC on live row");
assert(
  merged.find((t) => t.strategyId === "labs-pt-strcx").maturityAt === "2026-11-26T00:00:00.000Z",
  "live STRCx maturityAt UTC",
);
assert(
  merged.find((t) => t.strategyId === "labs-fxb-20261231").maturityAt ===
    "2027-01-01T00:00:00.000Z",
  "live FXB maturityAt UTC",
);
assert(stored.status === "active", "lifecycle status on live row");
assert(stored.strategyStatus === "active", "strategyStatus on live row");
merged
  .filter((t) => t.strategyId)
  .forEach((t) => {
    assert(t.status === "active" && t.strategyStatus === "active", `${t.strategyId} live status`);
  });
const maturedNow = applyLabsStableCatalog([], afterStrc);
assert(
  !maturedNow.some((t) => t.strategyId === "labs-pt-strcx"),
  "matured STRCx is not injected into the live list",
);

const sheetOverwrite = applyLabsStableCatalog(
  [
    {
      categoryId: "stables",
      name: "Pendle PT-USD3 live",
      apy: "99.9",
      chain: "Ethereum",
      link: "https://app.pendle.finance/trade/markets/0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e/swap?chain=ethereum",
    },
  ],
  beforeMat,
);
const usd3Row = sheetOverwrite.find((t) => t.strategyId === "labs-pt-usd3");
assert(
  usd3Row.apy === "14.0" && usd3Row.savedAprPct === "14.0",
  "sheet APY must not overwrite saved 14.0",
);
assert(
  !sheetOverwrite.some((t) => String(t.apy) === "99.9"),
  "live sheet duplicate of known market dropped from card APY",
);
assert(usd3Row.liveEntryAprPct === "99.9", "sheet live APY is stored as a separate entry rate");
assert(
  usd3Row.liveEntryAprPct !== usd3Row.savedAprPct,
  "live entry must not replace the saved rate",
);

console.log("test-labs-stables: ok");
