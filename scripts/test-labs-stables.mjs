import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  DISABLED_CURVE_MONAD_LP,
  LABS_STABLE_STRATEGIES,
  isDisabledCurveMonadPool,
  isLabsStrategyLive,
  applyLabsStableCatalog,
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

const usd3 = LABS_STABLE_STRATEGIES.find((s) => s.id === "labs-pt-usd3");
assert(usd3.maturityAt === "2026-12-17T00:00:00.000Z", "USD3 uses 17DEC contract expiry");
assert(usd3.primaryUrl.includes("view=pt"), "USD3 opens PT view");

const fxb = LABS_STABLE_STRATEGIES.find((s) => s.id === "labs-fxb-20261231");
assert(fxb.maturityAt === "2027-01-01T00:00:00.000Z", "FXB uses contract MATURITY_TIMESTAMP");
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
  assert(allowedStatus.has(s.status), `${s.id} status`);
  assert(typeof s.publishedAt === "string", `${s.id} publishedAt stored, not invented`);
  assert(s.liveEntryAprPct == null, `${s.id} live entry stays a separate empty field`);
  assert(Array.isArray(s.extraLinks), `${s.id} extraLinks`);
  assert(/\.\d{3}Z$/.test(s.maturityAt) || /T.*Z$/.test(s.maturityAt), `${s.id} maturityAt UTC`);
});

const stored = merged.find((t) => t.strategyId === "labs-pt-usd3");
assert(stored.strategyId === "labs-pt-usd3", "stable id on live row");
assert(stored.protocol === "Pendle", "protocol on live row");
assert(stored.chain === "Ethereum", "chain on live row");
assert(stored.marketAddress === "0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e", "market on live row");
assert(stored.tokenAddress === "0x7f47c3e6b2c00fc4eb4d5ae50d0ab0ab6888eb4d", "token on live row");
assert(stored.savedAprPct === "14.0", "saved annual rate on live row");
assert(stored.rateKind === "review-saved", "rate kind is original review");
assert(stored.sourceUrl === usd3.sourceUrl, "publication URL on live row");
assert(stored.primaryUrl === usd3.primaryUrl, "primary open URL on live row");
assert(
  Array.isArray(stored.extraLinks) && stored.extraLinks.length >= 3,
  "extra links on live row",
);
assert(stored.maturityAt === "2026-12-17T00:00:00.000Z", "maturityAt UTC on live row");
assert(stored.status === "active", "lifecycle status on live row");

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
  "live sheet duplicate of known market dropped",
);
assert(
  usd3Row.liveEntryAprPct == null,
  "future live entry rate is a separate field, not the card APY",
);

console.log("test-labs-stables: ok");
