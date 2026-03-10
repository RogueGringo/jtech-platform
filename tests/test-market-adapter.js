/**
 * Market Adapter — Unit + Integration Tests
 *
 * Tests sigmaToSeverity, computeTechnicals, and marketToSignals using
 * REAL SPY price data from Jan-Feb 2024 (steady uptrend ~472→500).
 *
 * Data source: Yahoo Finance SPY daily OHLCV, Jan 2 - Feb 14 2024
 * Geometric validation: uptrend data should NOT produce crisis-level mean.
 *
 * Run: node tests/test-market-adapter.js
 */

import {
  sigmaToSeverity,
  computeTechnicals,
  marketToSignals,
  MARKET_CATEGORIES,
} from "../src/adapters/market-adapter.js";

import {
  computeGini,
  computeMeanSeverity,
  classifyRegime,
  pearsonR,
} from "./lib/backtest-engine.js";

// ================================================================
// REAL SPY OHLCV DATA — Jan 2 to Feb 14, 2024
// Source: Yahoo Finance daily bars
// Context: Steady uptrend from ~472 to ~500
// ================================================================

const SPY_JAN_FEB_2024 = [
  // Jan 2024
  { date: "2024-01-02", open: 472.65, high: 473.43, low: 468.83, close: 469.50, volume: 55751900 },
  { date: "2024-01-03", open: 468.35, high: 469.43, low: 465.44, close: 467.77, volume: 59302900 },
  { date: "2024-01-04", open: 468.21, high: 469.80, low: 466.50, close: 467.22, volume: 52081400 },
  { date: "2024-01-05", open: 467.22, high: 468.27, low: 465.74, close: 466.29, volume: 48751400 },
  { date: "2024-01-08", open: 468.47, high: 472.12, low: 468.21, close: 471.47, volume: 47751200 },
  { date: "2024-01-09", open: 471.58, high: 472.43, low: 469.12, close: 470.96, volume: 43689600 },
  { date: "2024-01-10", open: 472.07, high: 474.28, low: 471.18, close: 474.13, volume: 45158700 },
  { date: "2024-01-11", open: 473.60, high: 474.96, low: 472.22, close: 474.37, volume: 45414600 },
  { date: "2024-01-12", open: 473.96, high: 475.65, low: 472.91, close: 475.02, volume: 44070000 },
  { date: "2024-01-16", open: 472.61, high: 474.86, low: 471.35, close: 474.09, volume: 63247700 },
  { date: "2024-01-17", open: 473.31, high: 473.66, low: 470.62, close: 470.89, volume: 53655500 },
  { date: "2024-01-18", open: 472.49, high: 476.15, low: 472.06, close: 475.51, volume: 55474200 },
  { date: "2024-01-19", open: 476.47, high: 480.44, low: 476.38, close: 480.06, volume: 66905000 },
  { date: "2024-01-22", open: 480.33, high: 482.65, low: 479.92, close: 481.95, volume: 52722800 },
  { date: "2024-01-23", open: 481.25, high: 482.40, low: 479.80, close: 481.55, volume: 46645200 },
  { date: "2024-01-24", open: 482.83, high: 484.56, low: 482.32, close: 484.35, volume: 47783700 },
  { date: "2024-01-25", open: 484.38, high: 487.26, low: 484.10, close: 486.74, volume: 60895200 },
  { date: "2024-01-26", open: 486.18, high: 487.40, low: 484.48, close: 487.13, volume: 53218400 },
  { date: "2024-01-29", open: 487.82, high: 489.28, low: 487.35, close: 488.62, volume: 42996300 },
  { date: "2024-01-30", open: 487.93, high: 490.20, low: 487.44, close: 489.51, volume: 50135200 },
  { date: "2024-01-31", open: 489.88, high: 490.47, low: 485.27, close: 486.32, volume: 72519000 },
  // Feb 2024
  { date: "2024-02-01", open: 487.85, high: 489.50, low: 486.80, close: 488.42, volume: 54516600 },
  { date: "2024-02-02", open: 492.62, high: 495.99, low: 492.56, close: 493.51, volume: 68461000 },
  { date: "2024-02-05", open: 492.20, high: 494.09, low: 491.17, close: 493.85, volume: 47992800 },
  { date: "2024-02-06", open: 494.14, high: 494.73, low: 492.29, close: 493.03, volume: 42825000 },
  { date: "2024-02-07", open: 494.94, high: 497.40, low: 494.57, close: 497.26, volume: 52155800 },
  { date: "2024-02-08", open: 497.26, high: 498.39, low: 496.10, close: 496.77, volume: 44955300 },
  { date: "2024-02-09", open: 498.64, high: 500.08, low: 497.31, close: 499.97, volume: 52927200 },
  { date: "2024-02-12", open: 499.86, high: 501.43, low: 499.78, close: 500.12, volume: 42738800 },
  { date: "2024-02-13", open: 495.83, high: 496.71, low: 491.34, close: 494.70, volume: 71006200 },
];

// ================================================================
// TEST HARNESS
// ================================================================

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

// ================================================================
// TEST 1: sigmaToSeverity
// ================================================================

console.log("\n=== TEST 1: sigmaToSeverity ===");

assert(sigmaToSeverity(2.5) === "critical", "σ=2.5 → critical");
assert(sigmaToSeverity(1.7) === "high", "σ=1.7 → high");
assert(sigmaToSeverity(1.2) === "moderate", "σ=1.2 → moderate");
assert(sigmaToSeverity(0.5) === "watch", "σ=0.5 → watch");
assert(sigmaToSeverity(-2.5) === "critical", "σ=-2.5 → critical (absolute)");
assert(sigmaToSeverity(0) === "watch", "σ=0 → watch");
assert(sigmaToSeverity(2.0) === "critical", "σ=2.0 → critical (boundary)");
assert(sigmaToSeverity(1.5) === "high", "σ=1.5 → high (boundary)");
assert(sigmaToSeverity(1.0) === "moderate", "σ=1.0 → moderate (boundary)");

// ================================================================
// TEST 2: computeTechnicals on real SPY data
// ================================================================

console.log("\n=== TEST 2: computeTechnicals (SPY Jan-Feb 2024) ===");

const techs = computeTechnicals(SPY_JAN_FEB_2024);

assert(techs.rsi.length === SPY_JAN_FEB_2024.length, `RSI array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.macd_hist.length === SPY_JAN_FEB_2024.length, `MACD hist array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.bbpctb.length === SPY_JAN_FEB_2024.length, `BB%B array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.bbwidth.length === SPY_JAN_FEB_2024.length, `BB width array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.volratio.length === SPY_JAN_FEB_2024.length, `Vol ratio array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.obvslope.length === SPY_JAN_FEB_2024.length, `OBV slope array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.mfi.length === SPY_JAN_FEB_2024.length, `MFI array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.sma50dist.length === SPY_JAN_FEB_2024.length, `SMA50 dist array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.sma200dist.length === SPY_JAN_FEB_2024.length, `SMA200 dist array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.drawdown.length === SPY_JAN_FEB_2024.length, `Drawdown array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.atrPctile.length === SPY_JAN_FEB_2024.length, `ATR percentile array length = ${SPY_JAN_FEB_2024.length}`);
assert(techs.adx.length === SPY_JAN_FEB_2024.length, `ADX array length = ${SPY_JAN_FEB_2024.length}`);

// RSI should be in valid range [0, 100]
const lastRSI = techs.rsi[techs.rsi.length - 1];
assert(lastRSI >= 0 && lastRSI <= 100, `RSI in valid range [0,100]: ${lastRSI.toFixed(2)}`);

// In an uptrend, RSI should generally be above 50
const avgRSI = techs.rsi.reduce((a, b) => a + b, 0) / techs.rsi.length;
assert(avgRSI > 45, `Average RSI > 45 in uptrend: ${avgRSI.toFixed(2)}`);

// BB%B should be approximately [0,1] range (can exceed slightly)
const lastBBPCTB = techs.bbpctb[techs.bbpctb.length - 1];
assert(lastBBPCTB > -1 && lastBBPCTB < 2, `BB%B in reasonable range: ${lastBBPCTB.toFixed(3)}`);

// Drawdown should be non-negative
const allDrawdownNonNeg = techs.drawdown.every(d => d >= -0.0001);
assert(allDrawdownNonNeg, "All drawdowns are non-negative");

// Volume ratio should be positive
const allVolPos = techs.volratio.every(v => v > 0);
assert(allVolPos, "All volume ratios are positive");

// No NaN/Infinity in any series
const allFinite = Object.entries(techs).every(([key, arr]) =>
  arr.every(v => Number.isFinite(v))
);
assert(allFinite, "All technical values are finite (no NaN/Infinity)");

console.log(`\n  RSI last: ${lastRSI.toFixed(2)}, avg: ${avgRSI.toFixed(2)}`);
console.log(`  MACD hist last: ${techs.macd_hist[techs.macd_hist.length - 1].toFixed(4)}`);
console.log(`  BB%B last: ${lastBBPCTB.toFixed(3)}`);
console.log(`  Drawdown last: ${techs.drawdown[techs.drawdown.length - 1].toFixed(4)}`);

// ================================================================
// TEST 3: marketToSignals — output shape
// ================================================================

console.log("\n=== TEST 3: marketToSignals output shape ===");

const result = marketToSignals("SPY", SPY_JAN_FEB_2024, techs);

assert(Array.isArray(result.signals), "signals is an array");
assert(result.signals.length === 12, `12 signals produced: got ${result.signals.length}`);
assert(typeof result.entropy === "number", "entropy is a number");
assert(typeof result.primeDensity === "number", "primeDensity is a number");
assert(typeof result.dissolutionRate === "number", "dissolutionRate is a number");
assert(typeof result.propagationRate === "number", "propagationRate is a number");
assert(typeof result.barCount === "number", "barCount is a number");
assert(result.barCount === SPY_JAN_FEB_2024.length, `barCount = ${SPY_JAN_FEB_2024.length}`);

// Entropy should be in valid range [0, 2] (log2 of 4 categories max)
assert(result.entropy >= 0 && result.entropy <= 2, `entropy in [0,2]: ${result.entropy.toFixed(4)}`);

// Rates should be in [0, 1]
assert(result.primeDensity >= 0 && result.primeDensity <= 1, `primeDensity in [0,1]: ${result.primeDensity.toFixed(4)}`);
assert(result.dissolutionRate >= 0 && result.dissolutionRate <= 1, `dissolutionRate in [0,1]: ${result.dissolutionRate.toFixed(4)}`);
assert(result.propagationRate >= 0 && result.propagationRate <= 1, `propagationRate in [0,1]: ${result.propagationRate.toFixed(4)}`);

// ================================================================
// TEST 4: Signal structure validation
// ================================================================

console.log("\n=== TEST 4: Signal structure validation ===");

const VALID_CATEGORIES = new Set(["condition", "flow", "price", "capacity", "context"]);
const VALID_SEVERITIES = new Set(["critical", "high", "moderate", "watch"]);

let allHaveId = true;
let allHaveCategory = true;
let allHaveSeverity = true;
let allValidCat = true;
let allValidSev = true;

for (const sig of result.signals) {
  if (typeof sig.id !== "string") allHaveId = false;
  if (typeof sig.category !== "string") allHaveCategory = false;
  if (typeof sig.severity !== "string") allHaveSeverity = false;
  if (!VALID_CATEGORIES.has(sig.category)) allValidCat = false;
  if (!VALID_SEVERITIES.has(sig.severity)) allValidSev = false;
}

assert(allHaveId, "All signals have string id");
assert(allHaveCategory, "All signals have string category");
assert(allHaveSeverity, "All signals have string severity");
assert(allValidCat, "All categories from universal set {condition, flow, price, capacity, context}");
assert(allValidSev, "All severities from {critical, high, moderate, watch}");

// Check each signal has numeric + sigma (extended fields)
const allHaveNumeric = result.signals.every(s => typeof s.numeric === "number");
const allHaveSigma = result.signals.every(s => typeof s.sigma === "number");
assert(allHaveNumeric, "All signals have numeric value");
assert(allHaveSigma, "All signals have sigma value");

// Verify signal IDs cover all 12 expected
const expectedIds = new Set([
  "mkt_rsi", "mkt_macd", "mkt_bbpctb",
  "mkt_volratio", "mkt_obvslope", "mkt_mfi",
  "mkt_sma50", "mkt_sma200", "mkt_drawdown",
  "mkt_atr", "mkt_bbwidth", "mkt_adx",
]);
const actualIds = new Set(result.signals.map(s => s.id));
const idsMatch = expectedIds.size === actualIds.size &&
  [...expectedIds].every(id => actualIds.has(id));
assert(idsMatch, "All 12 expected signal IDs present");

// Category distribution: 3 condition, 3 flow, 3 price, 3 capacity
const catCounts = {};
for (const s of result.signals) catCounts[s.category] = (catCounts[s.category] || 0) + 1;
assert(catCounts.condition === 3, `3 condition signals: got ${catCounts.condition}`);
assert(catCounts.flow === 3, `3 flow signals: got ${catCounts.flow}`);
assert(catCounts.price === 3, `3 price signals: got ${catCounts.price}`);
assert(catCounts.capacity === 3, `3 capacity signals: got ${catCounts.capacity}`);

// ================================================================
// TEST 5: Engine integration — signals through math framework
// ================================================================

console.log("\n=== TEST 5: Engine integration ===");

const gini = computeGini(result.signals);
const mean = computeMeanSeverity(result.signals);
const regime = classifyRegime(mean, gini);

assert(typeof gini === "number" && gini >= 0 && gini <= 1, `Gini in [0,1]: ${gini.toFixed(4)}`);
assert(typeof mean === "number" && mean >= 1 && mean <= 4, `Mean severity in [1,4]: ${mean.toFixed(4)}`);
assert(typeof regime.label === "string", `Regime label: ${regime.label}`);
assert(typeof regime.quadrant === "string", `Regime quadrant: ${regime.quadrant}`);

console.log(`\n  Gini: ${gini.toFixed(4)}`);
console.log(`  Mean severity: ${mean.toFixed(4)}`);
console.log(`  Regime: ${regime.label} (${regime.quadrant})`);
console.log(`  Entropy: ${result.entropy.toFixed(4)}`);
console.log(`  Prime density: ${result.primeDensity.toFixed(4)}`);

// ================================================================
// TEST 6: Geometric validation — uptrend geometry
// ================================================================

console.log("\n=== TEST 6: Geometric validation — uptrend topology ===");

// GEOMETRIC VALIDATION (not hardcoded labels):
// A steady uptrend (SPY Jan-Feb 2024, +6%) should NOT produce crisis-level severity.
// The σ-based severity should mostly be "watch" because indicators are near their rolling means.
assert(mean < 2.5, `Uptrend mean < 2.5 (not crisis level): ${mean.toFixed(4)}`);

// In a steady trend, signals should be relatively uniform → Gini should not be extreme
assert(gini < 0.5, `Uptrend Gini < 0.5 (not fully dispersed): ${gini.toFixed(4)}`);

// Sigma values should cluster near 0 in a steady trend (most within ±2σ)
const sigmas = result.signals.map(s => s.sigma);
const meanSigma = sigmas.reduce((a, b) => a + b, 0) / sigmas.length;
const extremeSigmas = sigmas.filter(s => Math.abs(s) > 2.0).length;
assert(extremeSigmas <= 4, `At most 4/12 signals at extreme σ in steady trend: ${extremeSigmas}`);

console.log(`\n  Mean σ across signals: ${meanSigma.toFixed(4)}`);
console.log(`  Extreme σ (>2.0) count: ${extremeSigmas}/12`);
console.log(`  σ values: ${sigmas.map(s => s.toFixed(2)).join(", ")}`);

// ================================================================
// TEST 7: Empty input handling
// ================================================================

console.log("\n=== TEST 7: Edge cases ===");

const emptyResult = marketToSignals("EMPTY", [], null);
assert(emptyResult.signals.length === 0, "Empty OHLCV → empty signals");
assert(emptyResult.entropy === 0, "Empty OHLCV → entropy = 0");
assert(emptyResult.barCount === 0, "Empty OHLCV → barCount = 0");

// Single bar should still work
const singleBar = [SPY_JAN_FEB_2024[0]];
const singleResult = marketToSignals("SPY", singleBar, null);
assert(singleResult.signals.length === 12, `Single bar → 12 signals: got ${singleResult.signals.length}`);
assert(singleResult.barCount === 1, "Single bar → barCount = 1");

// Auto-compute technicals (don't pass pre-computed)
const autoResult = marketToSignals("SPY", SPY_JAN_FEB_2024, null);
assert(autoResult.signals.length === 12, "Auto-compute technicals works");

// ================================================================
// TEST 8: MARKET_CATEGORIES export
// ================================================================

console.log("\n=== TEST 8: MARKET_CATEGORIES export ===");

assert(Array.isArray(MARKET_CATEGORIES), "MARKET_CATEGORIES is an array");
assert(MARKET_CATEGORIES.length === 4, `4 categories: got ${MARKET_CATEGORIES.length}`);
assert(MARKET_CATEGORIES.includes("condition"), "includes condition");
assert(MARKET_CATEGORIES.includes("flow"), "includes flow");
assert(MARKET_CATEGORIES.includes("price"), "includes price");
assert(MARKET_CATEGORIES.includes("capacity"), "includes capacity");

// ================================================================
// RESULTS
// ================================================================

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  console.log("\nFAILURES DETECTED — see above");
  process.exit(1);
} else {
  console.log("\nALL TESTS PASSED");
}
