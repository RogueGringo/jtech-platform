/**
 * V&V Negative Controls — Statistical Audit Task 7
 *
 * If the engine finds crisis topology in boring data or shuffled noise,
 * the severity thresholds are miscalibrated. This is the null hypothesis battery.
 *
 * Three layers:
 *   N1: Calendar Controls — calm-period SPY data should produce STABLE >= 90%
 *   N2: Volatility Controls — VIX < 15 stretches should include 2017 (lowest VIX year)
 *   N3: Permutation Controls — shuffling GFC data should destroy mean-Gini structure
 *
 * Data sources:
 *   calm-2013-spy.csv, calm-2017-spy.csv, calm-2019-spy.csv (real Yahoo Finance)
 *   vix-2010-2025.csv (real CBOE VIX)
 *   gfc-2008-spy.csv (real Yahoo Finance, 503 bars)
 *
 * Run: node tests/vv-negative-controls.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals, computeTechnicals } from "../src/adapters/market-adapter.js";

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
const BASELINE_WINDOW = 60;

// ================================================================
// SHARED: CSV -> per-bar mean/Gini/regime (same analyzeCSV as other V&V)
// ================================================================

function analyzeCSV(csvPath, baselineWindow = BASELINE_WINDOW) {
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
  const regimes = [];

  for (let i = 0; i < rows.length; i++) {
    const sliceTechnicals = {};
    for (const csvKey of CSV_TECH_KEYS) {
      const adapterKey = CSV_TO_TECH[csvKey];
      sliceTechnicals[adapterKey] = technicals[adapterKey].slice(0, i + 1);
    }
    const sliceOhlcv = ohlcv.slice(0, i + 1);

    const { signals } = marketToSignals("TEST", sliceOhlcv, sliceTechnicals, baselineWindow);
    if (signals.length === 0) continue;

    const mean = computeMeanSeverity(signals);
    const gini = computeGini(signals);
    const regime = classifyRegime(mean, gini);

    means.push(mean);
    ginis.push(gini);
    regimes.push(regime.label);
  }

  return { means, ginis, regimes, rows };
}

// ================================================================
// Fisher-Yates shuffle (in-place, returns same array)
// ================================================================

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V NEGATIVE CONTROLS — Statistical Audit Task 7");
console.log("Null hypothesis battery: calm data, low VIX, permutation noise");
console.log("=".repeat(80));

const verdicts = {};

// ================================================================
// LAYER N1: CALENDAR CONTROLS
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("LAYER N1: CALENDAR CONTROLS");
console.log("Claim: calm-period market data produces STABLE regime >= 90% of bars");
console.log("=".repeat(80));

const CALM_DATASETS = [
  { name: "Calm 2013 SPY", csv: "calm-2013-spy.csv" },
  { name: "Calm 2017 SPY", csv: "calm-2017-spy.csv" },
  { name: "Calm 2019 SPY", csv: "calm-2019-spy.csv" },
];

let n1AllPass = true;

for (const dataset of CALM_DATASETS) {
  const csvPath = path.join(DATA_DIR, dataset.csv);
  const { regimes } = analyzeCSV(csvPath);

  const total = regimes.length;
  const stableCount = regimes.filter(r => r === "STABLE").length;
  const stablePct = total > 0 ? (stableCount / total) * 100 : 0;
  const falsePosPct = 100 - stablePct;

  // Count regime distribution
  const regimeCounts = {};
  for (const r of regimes) {
    regimeCounts[r] = (regimeCounts[r] || 0) + 1;
  }

  const pass = stablePct >= 90;
  if (!pass) n1AllPass = false;

  console.log(`\n  ${dataset.name} (${total} bars):`);
  console.log(`    Regime distribution:`);
  for (const [regime, count] of Object.entries(regimeCounts).sort()) {
    const pct = (count / total * 100).toFixed(1);
    console.log(`      ${regime.padEnd(24)} ${String(count).padStart(4)} bars (${pct}%)`);
  }
  console.log(`    STABLE rate:      ${stablePct.toFixed(1)}% (${stableCount}/${total})`);
  console.log(`    False positive:   ${falsePosPct.toFixed(1)}%`);
  console.log(`    Threshold:        >= 90% STABLE`);
  console.log(`    Verdict:          ${pass ? "PASS" : "FAIL"}`);
}

verdicts.N1 = n1AllPass;
console.log(`\n  N1 OVERALL: ${n1AllPass ? "PASS" : "FAIL"} — all calm datasets >= 90% STABLE`);

// ================================================================
// LAYER N2: VOLATILITY CONTROLS
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("LAYER N2: VOLATILITY CONTROLS");
console.log("Find 5 longest continuous stretches where VIX Close < 15");
console.log("Verify 2017 appears (lowest VIX year in history)");
console.log("=".repeat(80));

const vixPath = path.join(DATA_DIR, "vix-2010-2025.csv");
const vixRows = readCSV(vixPath);

console.log(`\n  VIX dataset: ${vixRows.length} trading days (2010-2025)`);

// Find all continuous stretches where VIX Close < 15
const stretches = [];
let currentStretch = null;

for (let i = 0; i < vixRows.length; i++) {
  const row = vixRows[i];
  if (row.Close < 15) {
    if (!currentStretch) {
      currentStretch = { startIdx: i, startDate: row.date, days: 1, endDate: row.date };
    } else {
      currentStretch.days++;
      currentStretch.endDate = row.date;
    }
  } else {
    if (currentStretch) {
      stretches.push(currentStretch);
      currentStretch = null;
    }
  }
}
// Close any open stretch
if (currentStretch) {
  stretches.push(currentStretch);
}

// Sort by length, take top 5 (minimum 20 days)
const qualifiedStretches = stretches.filter(s => s.days >= 20);
qualifiedStretches.sort((a, b) => b.days - a.days);
const top5 = qualifiedStretches.slice(0, 5);

console.log(`\n  Total VIX < 15 stretches (>= 20 days): ${qualifiedStretches.length}`);
console.log(`\n  Top 5 longest VIX < 15 stretches:`);
console.log(`    ${"Rank".padEnd(6)} ${"Start".padEnd(12)} ${"End".padEnd(12)} ${"Days".padStart(6)}`);
console.log(`    ${"-".repeat(36)}`);

let has2017 = false;
for (let i = 0; i < top5.length; i++) {
  const s = top5[i];
  const year = s.startDate.substring(0, 4);
  const endYear = s.endDate.substring(0, 4);
  const yearRange = year === endYear ? year : `${year}-${endYear}`;
  const marker = (s.startDate.includes("2017") || s.endDate.includes("2017")) ? " <<<" : "";
  if (s.startDate.includes("2017") || s.endDate.includes("2017")) has2017 = true;

  console.log(`    #${String(i + 1).padEnd(5)} ${s.startDate.padEnd(12)} ${s.endDate.padEnd(12)} ${String(s.days).padStart(6)} (${yearRange})${marker}`);
}

// Also check if any stretch spans into/from 2017
for (const s of top5) {
  const startYear = parseInt(s.startDate.substring(0, 4));
  const endYear = parseInt(s.endDate.substring(0, 4));
  if (startYear <= 2017 && endYear >= 2017) has2017 = true;
}

const n2Pass = has2017;
verdicts.N2 = n2Pass;

console.log(`\n  2017 in top-5 stretches: ${has2017 ? "YES" : "NO"}`);
console.log(`  N2 VERDICT: ${n2Pass ? "PASS" : "FAIL"} — 2017 ${has2017 ? "confirmed" : "NOT found"} in top-5 calm stretches`);

if (n1AllPass && n2Pass) {
  console.log(`  N1+N2 CROSS-VALIDATION: Calendar controls + VIX volatility confirm calm periods are boring`);
}

// ================================================================
// LAYER N3: PERMUTATION CONTROLS
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("LAYER N3: PERMUTATION CONTROLS");
console.log("Claim: shuffling GFC 2008 data destroys mean-Gini topology");
console.log("100 permutations of 503-bar dataset (Fisher-Yates shuffle)");
console.log("=".repeat(80));

// Step 1: Compute REAL mean-Gini r from the actual GFC dataset
const gfcPath = path.join(DATA_DIR, "gfc-2008-spy.csv");
const { means: realMeans, ginis: realGinis } = analyzeCSV(gfcPath);
const realR = pearsonR(realMeans, realGinis);

console.log(`\n  REAL GFC 2008 data:`);
console.log(`    Bars analyzed:  ${realMeans.length}`);
console.log(`    Mean-Gini r:    ${realR.toFixed(4)}`);
console.log(`    |r|:            ${Math.abs(realR).toFixed(4)}`);

// Step 2: Run 100 permutations
const NUM_PERMUTATIONS = 100;
const gfcRows = readCSV(gfcPath);

console.log(`\n  Running ${NUM_PERMUTATIONS} permutations...`);

const permutedAbsR = [];
const t0 = Date.now();

for (let perm = 0; perm < NUM_PERMUTATIONS; perm++) {
  // Progress reporting every 25 permutations
  if (perm > 0 && perm % 25 === 0) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`    Permutation ${perm}/${NUM_PERMUTATIONS} (${elapsed}s elapsed)`);
  }

  // Step 2a: Shuffle rows (Fisher-Yates on a copy)
  const shuffled = gfcRows.slice();
  fisherYatesShuffle(shuffled);

  // Step 2b: Build ohlcv from shuffled rows
  const ohlcv = shuffled.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));

  // Step 2c: Compute technicals on shuffled ohlcv
  const techs = computeTechnicals(ohlcv);

  // Step 2d: Run adapter bar-by-bar, collect mean/gini per bar
  const permMeans = [];
  const permGinis = [];

  for (let i = 0; i < ohlcv.length; i++) {
    const sliceOhlcv = ohlcv.slice(0, i + 1);

    // Slice technicals up to bar i+1
    const sliceTechs = {};
    for (const key of Object.keys(techs)) {
      sliceTechs[key] = techs[key].slice(0, i + 1);
    }

    const { signals } = marketToSignals("TEST", sliceOhlcv, sliceTechs, BASELINE_WINDOW);
    if (signals.length === 0) continue;

    permMeans.push(computeMeanSeverity(signals));
    permGinis.push(computeGini(signals));
  }

  // Step 2e: Compute pearsonR on permuted mean/gini arrays
  if (permMeans.length >= 3) {
    const permR = pearsonR(permMeans, permGinis);
    permutedAbsR.push(Math.abs(permR));
  }
}

const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`    Permutation ${NUM_PERMUTATIONS}/${NUM_PERMUTATIONS} (${totalElapsed}s total)`);

// Step 3: Analyze permutation distribution
const meanPermAbsR = permutedAbsR.length > 0
  ? permutedAbsR.reduce((a, b) => a + b, 0) / permutedAbsR.length
  : 0;
const maxPermAbsR = permutedAbsR.length > 0 ? Math.max(...permutedAbsR) : 0;
const minPermAbsR = permutedAbsR.length > 0 ? Math.min(...permutedAbsR) : 0;
const sortedPermAbsR = permutedAbsR.slice().sort((a, b) => a - b);
const medianPermAbsR = sortedPermAbsR.length > 0
  ? sortedPermAbsR[Math.floor(sortedPermAbsR.length / 2)]
  : 0;

// Count how many permuted |r| exceed real |r|
const exceedCount = permutedAbsR.filter(pr => pr >= Math.abs(realR)).length;
const permPValue = exceedCount / permutedAbsR.length;

console.log(`\n  Permutation distribution (${permutedAbsR.length} valid permutations):`);
console.log(`    Mean |r|:       ${meanPermAbsR.toFixed(4)}`);
console.log(`    Median |r|:     ${medianPermAbsR.toFixed(4)}`);
console.log(`    Min |r|:        ${minPermAbsR.toFixed(4)}`);
console.log(`    Max |r|:        ${maxPermAbsR.toFixed(4)}`);
console.log(`    Real |r|:       ${Math.abs(realR).toFixed(4)}`);
console.log(`    Permuted > Real: ${exceedCount}/${permutedAbsR.length} (p = ${permPValue.toFixed(4)})`);

const n3Pass = meanPermAbsR < 0.1;
verdicts.N3 = n3Pass;

console.log(`\n  Threshold:        mean permuted |r| < 0.1`);
console.log(`  Observed:         mean permuted |r| = ${meanPermAbsR.toFixed(4)}`);
console.log(`  N3 VERDICT: ${n3Pass ? "PASS — shuffling destroys topology" : "FAIL — shuffled data retains structure"}`);

if (!n3Pass) {
  console.log(`  RECALIBRATION: mean permuted |r| = ${meanPermAbsR.toFixed(4)} >= 0.1`);
  console.log(`  The sigma-based severity mapping may produce spurious correlations`);
  console.log(`  even on randomized price sequences. Consider tightening sigma thresholds.`);
}

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("V&V NEGATIVE CONTROLS — COMPOSITE VERDICT");
console.log("=".repeat(80));

console.log(`\n  N1 Calendar Controls:    ${verdicts.N1 ? "PASS" : "FAIL"} (calm data >= 90% STABLE)`);
console.log(`  N2 Volatility Controls:  ${verdicts.N2 ? "PASS" : "FAIL"} (2017 in top-5 low-VIX stretches)`);
console.log(`  N3 Permutation Controls: ${verdicts.N3 ? "PASS" : "FAIL"} (mean permuted |r| < 0.1)`);

const allPass = verdicts.N1 && verdicts.N2 && verdicts.N3;
const failures = Object.entries(verdicts).filter(([, v]) => !v).map(([k]) => k);

if (allPass) {
  console.log(`\n  ALL NEGATIVE CONTROLS PASS`);
  console.log(`  The engine correctly produces null topology on boring data,`);
  console.log(`  confirms calm periods via independent volatility measure,`);
  console.log(`  and loses mean-Gini structure when time-series order is destroyed.`);
  console.log(`  False positive rate is within calibration tolerance.`);
} else {
  console.log(`\n  NEGATIVE CONTROL FAILURES: ${failures.join(", ")}`);
  if (!verdicts.N1) {
    console.log(`  N1: Engine produces non-STABLE regimes on calm market data.`);
    console.log(`      Recalibration: raise sigma thresholds in sigmaToSeverity() to reduce`);
    console.log(`      false positive rate. Current threshold: 1.0/1.5/2.0 sigma may be too sensitive.`);
  }
  if (!verdicts.N2) {
    console.log(`  N2: 2017 not found in top-5 low-VIX stretches.`);
    console.log(`      This is unexpected — 2017 was the lowest realized VIX year in history.`);
    console.log(`      Check VIX data integrity and date coverage.`);
  }
  if (!verdicts.N3) {
    console.log(`  N3: Shuffled data retains mean-Gini correlation structure.`);
    console.log(`      Recalibration: the sigma baseline may be too short (${BASELINE_WINDOW} bars),`);
    console.log(`      causing auto-correlation artifacts. Consider increasing baseline window`);
    console.log(`      or adding decorrelation checks to the severity pipeline.`);
  }
}

console.log(`\n${"=".repeat(80)}`);
console.log(`V&V Negative Controls — ${allPass ? "ALL PASS" : "FAILURES: " + failures.join(", ")}`);
console.log("=".repeat(80));
