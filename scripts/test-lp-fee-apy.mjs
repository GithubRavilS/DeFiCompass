import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  feeApyPct,
  parseKrystalLink,
  parseRevertLink,
  revertFeeApyFromData,
} = require("../lib/lp-fee-apy.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  Math.abs(feeApyPct(0.01015, 0.49981, 156.36) - 4.745) < 0.05,
  "krystal fee APY from commissions",
);
assert(
  Math.abs(feeApyPct(0.023923, 0.464577, 195.965) - 9.59) < 0.05,
  "revert fee APY from fees/deposits",
);
assert(
  feeApyPct(0.18, 0.5, 156) > 80,
  "PnL must not be used: 0.18/0.5 would be ~84% if mistaken for fees",
);
assert(feeApyPct(0, 0.5, 156) === 0, "zero fees → 0%");
assert(feeApyPct(1, 0, 10) == null, "no invest → skip");

const k = parseKrystalLink(
  "https://cloud-ui.krystal.app/positions/8453/0x827922686190790b37229fd06084350e74485b72-71876224",
);
assert(k && k.nft === "71876224" && k.chainId === 8453, "krystal nft parse");

const r = parseRevertLink("https://revert.finance/#/uniswap-position/optimism/1089241");
assert(r && r.nft === "1089241" && r.exchange === "uniswapv3", "revert parse");

const computed = revertFeeApyFromData({
  fees_value: "0.023923457686434176",
  deposits_value: "0.4645768101327963",
  age: "195.9645602",
  performance: { hodl: { apr: "7.07", roi: "3.8", fee_apr: "10", pnl: "0.017" } },
});
assert(
  computed && Math.abs(computed.apy - 9.59) < 0.1,
  "must use fees/deposits, not hodl.apr/roi/pnl",
);

console.log("test-lp-fee-apy: ok");
