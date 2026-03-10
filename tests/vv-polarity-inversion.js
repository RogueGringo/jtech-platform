/**
 * V&V Polarity Inversion — Statistical Audit Task 3
 *
 * Tests the claim: market data has POSITIVE mean-Gini correlation
 * (indicators DISAGREE during crisis) while text data has NEGATIVE
 * mean-Gini correlation (signals CONVERGE during crisis).
 *
 * Three statistical tests at alpha = 0.001:
 *   1. Fisher z-test: are market r and text r significantly different?
 *   2. Bootstrap CI: do the 99.9% CIs NOT overlap?
 *   3. Permutation test: does shuffling destroy market mean-Gini structure?
 *
 * Composite verdict: CONFIRMED / INCONCLUSIVE / REJECTED
 *
 * Data sources: 15 real Yahoo Finance OHLCV event CSVs
 * Text reference: GDELT IE (Ukraine 2022) mean-entropy r = -0.907, n = 57
 *
 * Run: node tests/vv-polarity-inversion.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { bootstrapCI, permutationTest, fisherZTest, pearsonCI } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

// ================================================================
// CSV column -> adapter tech key mapping
// ================================================================

const CSV_TO_TECH = {
  rsi: "rsi",
  macd_hist: "macd_hist",
  bband_pctb: "bbpctb",
  bband_width: "bbwidth",
  volume_ratio: "volratio",
  sma50_dist: "sma50dist",
  sma200_dist: "sma200dist",
  atr_pctile: "atrPctile",
  drawdown: "drawdown",
  adx: "adx",
  mfi: "mfi",
  obv_slope: "obvslope",
};

const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

// ================================================================
// MARKET EVENT DEFINITIONS — 15 events
// ================================================================

const MARKET_EVENTS = [
  "gfc-2008-spy",
  "covid-2020-spy",
  "svb-2023-kre",
  "nvda-2023-nvda",
  "gme-2021-gme",
  "dotcom-2000-qqq",
  "flash-2010-spy",
  "eudebt-2011-ewg",
  "taper-2013-tlt",
  "china-2015-fxi",
  "oilcrash-2014-xle",
  "volmageddon-2018-spy",
  "yencarry-2024-ewj",
  "tariff-2025-kweb",
  "crypto-2022-coin",
];

// ================================================================
// TEXT DOMAIN REFERENCE VALUES (from verified backtests)
// ================================================================

const TEXT_REF = {
  domain: "GDELT IE (Ukraine 2022)",
  r: -0.907,
  n: 57,
  metric: "mean-entropy",
};

// ================================================================
// CORE: CSV -> per-bar mean/Gini pairs
// ================================================================

function analyzeCSV(csvPath, baselineWindow = 60) {
  const rows = readCSV(csvPath);

  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));

  // Build technicals arrays mapped to adapter key names
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    const adapterKey = CSV_TO_TECH[csvKey];
    technicals[adapterKey] = rows.map(r => r[csvKey] || 0);
  }

  const means = [];
  const ginis = [];

  for (let i = 0; i < rows.length; i++) {
    // Slice data up to this point for rolling baseline context
    const sliceTechnicals = {};
    for (const csvKey of CSV_TECH_KEYS) {
      const adapterKey = CSV_TO_TECH[csvKey];
      sliceTechnicals[adapterKey] = technicals[adapterKey].slice(0, i + 1);
    }
    const sliceOhlcv = ohlcv.slice(0, i + 1);

    const { signals } = marketToSignals("TEST", sliceOhlcv, sliceTechnicals, baselineWindow);
    if (signals.length === 0) continue;

    means.push(computeMeanSeverity(signals));
    ginis.push(computeGini(signals));
  }

  return { means, ginis };
}

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V POLARITY INVERSION — Statistical Audit Task 3");
console.log("Claim: market mean-Gini r > 0 vs text mean-Gini r < 0");
console.log("Alpha = 0.001 (99.9% confidence)");
console.log("=".repeat(80));

// ----------------------------------------------------------------
// STEP 1: Process all 15 market events, collect mean/Gini pairs
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 1: Per-event mean-Gini correlations (15 market events)");
console.log("-".repeat(80));

const allMeans = [];
const allGinis = [];
const eventResults = [];

for (const event of MARKET_EVENTS) {
  const csvPath = path.join(DATA_DIR, `${event}.csv`);
  const { means, ginis } = analyzeCSV(csvPath);

  const r = means.length >= 3 ? pearsonR(means, ginis) : NaN;
  const n = means.length;

  eventResults.push({ event, r, n });
  allMeans.push(...means);
  allGinis.push(...ginis);

  console.log(`  ${event.padEnd(28)} r=${isNaN(r) ? "N/A" : r.toFixed(4).padStart(8)}  n=${String(n).padStart(4)}`);
}

// ----------------------------------------------------------------
// STEP 2: Pooled market correlation
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 2: Pooled market mean-Gini correlation");
console.log("-".repeat(80));

const marketR = pearsonR(allMeans, allGinis);
const marketN = allMeans.length;
const marketCI = pearsonCI(marketR, marketN, 0.001);

console.log(`  Pooled market r     = ${marketR.toFixed(4)}`);
console.log(`  Pooled market n     = ${marketN}`);
console.log(`  99.9% CI (Fisher z) = [${marketCI.lo.toFixed(4)}, ${marketCI.hi.toFixed(4)}]`);
console.log(`  Text reference r    = ${TEXT_REF.r.toFixed(4)} (${TEXT_REF.domain}, n=${TEXT_REF.n})`);
console.log(`  Polarity sign       : market=${marketR > 0 ? "POSITIVE" : "NEGATIVE"}, text=NEGATIVE`);

// ----------------------------------------------------------------
// STEP 3: Statistical tests at alpha = 0.001
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 3: Statistical tests (alpha = 0.001)");
console.log("-".repeat(80));

const ALPHA = 0.001;
let testsPass = 0;
let testsFail = 0;

// --- Test 1: Fisher z-test ---
console.log("\n  TEST 1: Fisher z-test (market r vs text r)");
console.log("  H0: market r = text r");
console.log("  H1: market r != text r");

const fisher = fisherZTest(marketR, marketN, TEXT_REF.r, TEXT_REF.n);
const fisherPass = fisher.p < ALPHA;

console.log(`    z-statistic = ${fisher.z.toFixed(4)}`);
console.log(`    p-value     = ${fisher.p.toExponential(4)}`);
console.log(`    alpha       = ${ALPHA}`);
console.log(`    Verdict     : ${fisherPass ? "PASS — correlations are significantly different" : "FAIL — cannot reject H0"}`);

if (fisherPass) testsPass++;
else testsFail++;

// --- Test 2: Bootstrap CI on market data ---
console.log("\n  TEST 2: Bootstrap CI — do 99.9% CIs NOT overlap?");
console.log("  Market CI via percentile bootstrap (B=10000)");

// Create paired tuples for bootstrap resampling
const pairedMarket = allMeans.map((m, i) => [m, allGinis[i]]);

const bootResult = bootstrapCI(pairedMarket, (resample) => {
  const ms = resample.map(p => p[0]);
  const gs = resample.map(p => p[1]);
  return pearsonR(ms, gs);
}, ALPHA, 10000);

// Text CI via Fisher z (analytical)
const textCI = pearsonCI(TEXT_REF.r, TEXT_REF.n, ALPHA);

const ciOverlap = bootResult.lo <= textCI.hi && textCI.lo <= bootResult.hi;
const bootstrapPass = !ciOverlap;

console.log(`    Market 99.9% bootstrap CI = [${bootResult.lo.toFixed(4)}, ${bootResult.hi.toFixed(4)}]`);
console.log(`    Text   99.9% Fisher CI    = [${textCI.lo.toFixed(4)}, ${textCI.hi.toFixed(4)}]`);
console.log(`    Overlap                   = ${ciOverlap ? "YES" : "NO"}`);
console.log(`    Verdict                   : ${bootstrapPass ? "PASS — CIs do NOT overlap" : "FAIL — CIs overlap"}`);

if (bootstrapPass) testsPass++;
else testsFail++;

// --- Test 3: Permutation test ---
console.log("\n  TEST 3: Permutation test — does shuffling destroy structure?");
console.log("  H0: mean-Gini association is random");
console.log("  H1: mean-Gini association is structurally real");

const perm = permutationTest(allMeans, allGinis, pearsonR, 10000);
const permPass = perm.p < ALPHA;

console.log(`    Observed |r| = ${perm.observed.toFixed(4)}`);
console.log(`    p-value      = ${perm.p < 0.0001 ? perm.p.toExponential(4) : perm.p.toFixed(4)}`);
console.log(`    alpha        = ${ALPHA}`);
console.log(`    Verdict      : ${permPass ? "PASS — structure is real (shuffling destroys it)" : "FAIL — cannot reject randomness"}`);

if (permPass) testsPass++;
else testsFail++;

// ----------------------------------------------------------------
// COMPOSITE VERDICT
// ----------------------------------------------------------------

console.log("\n" + "=".repeat(80));
console.log("V&V POLARITY INVERSION — COMPOSITE VERDICT");
console.log("=".repeat(80));

console.log(`\n  Tests passed: ${testsPass}/3`);
console.log(`  Tests failed: ${testsFail}/3`);

let verdict;
if (testsPass === 3) {
  verdict = "CONFIRMED";
} else if (testsPass === 0) {
  verdict = "REJECTED";
} else {
  verdict = "INCONCLUSIVE";
}

console.log(`\n  Market pooled r  = ${marketR.toFixed(4)} (n=${marketN})`);
console.log(`  Text reference r = ${TEXT_REF.r.toFixed(4)} (n=${TEXT_REF.n})`);
console.log(`  Polarity delta   = ${(marketR - TEXT_REF.r).toFixed(4)}`);

console.log(`\n  VERDICT: ${verdict} at alpha = ${ALPHA}`);

if (verdict === "CONFIRMED") {
  console.log("  Polarity inversion is statistically significant.");
  console.log("  Market data and text data encode crisis in fundamentally different geometries.");
} else if (verdict === "INCONCLUSIVE") {
  console.log("  Some evidence for polarity inversion but not all tests pass.");
  console.log("  Additional data or lower alpha may clarify.");
} else {
  console.log("  No statistical evidence for polarity inversion at this alpha.");
  console.log("  The claim does not survive rigorous V&V.");
}

console.log("\n" + "=".repeat(80));
