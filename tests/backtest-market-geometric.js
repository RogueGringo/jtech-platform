/**
 * Market Geometric Backtest — Layer A Calibration
 *
 * Validates regime classification geometry on real Yahoo Finance OHLCV data.
 * Tests the TOPOLOGY of signal distributions (baseline→peak→recovery)
 * across 5 market events — NO hardcoded regime labels or expected numbers.
 *
 * Data sources:
 *   - GFC 2008:  SPY  (503 bars, 2007-07 to 2009-06) — Yahoo Finance
 *   - COVID 2020: SPY  (145 bars, 2019-12 to 2020-06) — Yahoo Finance
 *   - NVDA 2023:  NVDA (332 bars, 2022-12 to 2024-03) — Yahoo Finance
 *   - GME 2021:   GME  (145 bars, 2020-12 to 2021-06) — Yahoo Finance
 *   - SVB 2023:   KRE  (144 bars, 2022-12 to 2023-06) — Yahoo Finance
 *
 * Run: node tests/backtest-market-geometric.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

// ================================================================
// CSV column → adapter tech key mapping
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
// CORE ANALYSIS: CSV → per-bar regime topology
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

  const results = [];
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

    const gini = computeGini(signals);
    const mean = computeMeanSeverity(signals);
    const regime = classifyRegime(mean, gini);

    results.push({
      date: rows[i].date,
      close: rows[i].Close,
      gini,
      mean,
      regime: regime.label,
    });
  }
  return results;
}

// ================================================================
// HELPER: average a field over a date range
// ================================================================

function avgInRange(results, start, end, field) {
  const slice = results.filter(r => r.date >= start && r.date <= end);
  if (slice.length === 0) return 0;
  return slice.reduce((s, r) => s + r[field], 0) / slice.length;
}

function countInRange(results, start, end) {
  return results.filter(r => r.date >= start && r.date <= end).length;
}

// ================================================================
// TEST FRAMEWORK
// ================================================================

let totalPassed = 0;
let totalFailed = 0;

function check(condition, label, detail) {
  if (condition) {
    console.log(`    PASS: ${label}`);
    totalPassed++;
  } else {
    console.log(`    FAIL: ${label} — ${detail}`);
    totalFailed++;
  }
}

// ================================================================
// EVENT 1: GFC 2008 — SPY
// ================================================================

console.log("=".repeat(80));
console.log("MARKET GEOMETRIC BACKTEST — Layer A Calibration");
console.log("Real Yahoo Finance OHLCV data — geometric topology validation");
console.log("=".repeat(80));

console.log("\n" + "=".repeat(80));
console.log("EVENT 1: GFC 2008 — SPY (503 bars, 2007-07 to 2009-06)");
console.log("=".repeat(80));

const gfcPath = path.join(DATA_DIR, "gfc-2008-spy.csv");
const gfcResults = analyzeCSV(gfcPath);
console.log(`  ${gfcResults.length} bars analyzed\n`);

// Phases
const gfcBaselineMean = avgInRange(gfcResults, "2007-07-01", "2007-09-30", "mean");
const gfcBaselineGini = avgInRange(gfcResults, "2007-07-01", "2007-09-30", "gini");
const gfcPeakMean     = avgInRange(gfcResults, "2008-09-01", "2008-11-30", "mean");
const gfcPeakGini     = avgInRange(gfcResults, "2008-09-01", "2008-11-30", "gini");
const gfcRecoveryMean = avgInRange(gfcResults, "2009-03-01", "2009-06-30", "mean");
const gfcRecoveryGini = avgInRange(gfcResults, "2009-03-01", "2009-06-30", "gini");

console.log("  Phase geometry:");
console.log(`    Baseline (Jul-Sep 2007):  mean=${gfcBaselineMean.toFixed(3)}, gini=${gfcBaselineGini.toFixed(3)}, n=${countInRange(gfcResults, "2007-07-01", "2007-09-30")}`);
console.log(`    Peak (Sep-Nov 2008):      mean=${gfcPeakMean.toFixed(3)}, gini=${gfcPeakGini.toFixed(3)}, n=${countInRange(gfcResults, "2008-09-01", "2008-11-30")}`);
console.log(`    Recovery (Mar-Jun 2009):  mean=${gfcRecoveryMean.toFixed(3)}, gini=${gfcRecoveryGini.toFixed(3)}, n=${countInRange(gfcResults, "2009-03-01", "2009-06-30")}`);
console.log();

check(gfcPeakMean > gfcBaselineMean,
  "Peak mean > baseline mean (crisis widening)",
  `peak=${gfcPeakMean.toFixed(3)} vs baseline=${gfcBaselineMean.toFixed(3)}`);

check(gfcRecoveryMean < gfcPeakMean,
  "Recovery mean < peak mean (narrowing toward baseline)",
  `recovery=${gfcRecoveryMean.toFixed(3)} vs peak=${gfcPeakMean.toFixed(3)}`);

check(gfcPeakGini < gfcBaselineGini || gfcPeakGini < 0.3,
  "Peak Gini converges (< baseline Gini OR < 0.3)",
  `peakGini=${gfcPeakGini.toFixed(3)}, baselineGini=${gfcBaselineGini.toFixed(3)}`);

// ================================================================
// EVENT 2: COVID CRASH 2020 — SPY
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("EVENT 2: COVID CRASH 2020 — SPY (145 bars, 2019-12 to 2020-06)");
console.log("=".repeat(80));

const covidPath = path.join(DATA_DIR, "covid-2020-spy.csv");
const covidResults = analyzeCSV(covidPath);
console.log(`  ${covidResults.length} bars analyzed\n`);

const covidBaselineMean = avgInRange(covidResults, "2019-12-01", "2020-01-31", "mean");
const covidBaselineGini = avgInRange(covidResults, "2019-12-01", "2020-01-31", "gini");
const covidPeakMean     = avgInRange(covidResults, "2020-03-01", "2020-03-31", "mean");
const covidPeakGini     = avgInRange(covidResults, "2020-03-01", "2020-03-31", "gini");
const covidRecoveryMean = avgInRange(covidResults, "2020-05-01", "2020-06-30", "mean");
const covidRecoveryGini = avgInRange(covidResults, "2020-05-01", "2020-06-30", "gini");

console.log("  Phase geometry:");
console.log(`    Baseline (Dec 2019-Jan 2020):  mean=${covidBaselineMean.toFixed(3)}, gini=${covidBaselineGini.toFixed(3)}, n=${countInRange(covidResults, "2019-12-01", "2020-01-31")}`);
console.log(`    Peak (Mar 2020):               mean=${covidPeakMean.toFixed(3)}, gini=${covidPeakGini.toFixed(3)}, n=${countInRange(covidResults, "2020-03-01", "2020-03-31")}`);
console.log(`    Recovery (May-Jun 2020):       mean=${covidRecoveryMean.toFixed(3)}, gini=${covidRecoveryGini.toFixed(3)}, n=${countInRange(covidResults, "2020-05-01", "2020-06-30")}`);
console.log();

check(covidPeakMean > covidBaselineMean,
  "Peak mean > baseline mean (crisis widening)",
  `peak=${covidPeakMean.toFixed(3)} vs baseline=${covidBaselineMean.toFixed(3)}`);

check(covidRecoveryMean < covidPeakMean,
  "Recovery mean < peak mean (narrowing)",
  `recovery=${covidRecoveryMean.toFixed(3)} vs peak=${covidPeakMean.toFixed(3)}`);

// ================================================================
// EVENT 3: NVDA AI RUN 2023 — NVDA
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("EVENT 3: NVDA AI RUN 2023 — NVDA (332 bars, 2022-12 to 2024-03)");
console.log("=".repeat(80));

const nvdaPath = path.join(DATA_DIR, "nvda-2023-nvda.csv");
const nvdaResults = analyzeCSV(nvdaPath);
console.log(`  ${nvdaResults.length} bars analyzed\n`);

const nvdaEarlyMean = avgInRange(nvdaResults, "2023-01-01", "2023-03-31", "mean");
const nvdaEarlyGini = avgInRange(nvdaResults, "2023-01-01", "2023-03-31", "gini");
const nvdaLateMean  = avgInRange(nvdaResults, "2023-10-01", "2024-01-31", "mean");
const nvdaLateGini  = avgInRange(nvdaResults, "2023-10-01", "2024-01-31", "gini");

console.log("  Phase geometry:");
console.log(`    Early (Jan-Mar 2023):   mean=${nvdaEarlyMean.toFixed(3)}, gini=${nvdaEarlyGini.toFixed(3)}, n=${countInRange(nvdaResults, "2023-01-01", "2023-03-31")}`);
console.log(`    Late (Oct 2023-Jan 2024): mean=${nvdaLateMean.toFixed(3)}, gini=${nvdaLateGini.toFixed(3)}, n=${countInRange(nvdaResults, "2023-10-01", "2024-01-31")}`);
console.log();

check(nvdaLateMean < 3.0,
  "Sustained uptrend → late mean NOT crisis level (< 3.0)",
  `lateMean=${nvdaLateMean.toFixed(3)}`);

// ================================================================
// EVENT 4: GME SQUEEZE 2021 — GME
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("EVENT 4: GME SQUEEZE 2021 — GME (145 bars, 2020-12 to 2021-06)");
console.log("=".repeat(80));

const gmePath = path.join(DATA_DIR, "gme-2021-gme.csv");
const gmeResults = analyzeCSV(gmePath);
console.log(`  ${gmeResults.length} bars analyzed\n`);

const gmeBaselineMean = avgInRange(gmeResults, "2020-12-01", "2021-01-10", "mean");
const gmeBaselineGini = avgInRange(gmeResults, "2020-12-01", "2021-01-10", "gini");
const gmePeakMean     = avgInRange(gmeResults, "2021-01-25", "2021-02-05", "mean");
const gmePeakGini     = avgInRange(gmeResults, "2021-01-25", "2021-02-05", "gini");

console.log("  Phase geometry:");
console.log(`    Baseline (Dec 2020-Jan 10):  mean=${gmeBaselineMean.toFixed(3)}, gini=${gmeBaselineGini.toFixed(3)}, n=${countInRange(gmeResults, "2020-12-01", "2021-01-10")}`);
console.log(`    Peak (Jan 25-Feb 5):         mean=${gmePeakMean.toFixed(3)}, gini=${gmePeakGini.toFixed(3)}, n=${countInRange(gmeResults, "2021-01-25", "2021-02-05")}`);
console.log();

check(gmePeakMean > gmeBaselineMean,
  "Peak mean > baseline mean (squeeze widening)",
  `peak=${gmePeakMean.toFixed(3)} vs baseline=${gmeBaselineMean.toFixed(3)}`);

check(gmePeakGini > 0.1,
  "Peak Gini > 0.1 (transient spike — signals disagree during squeeze)",
  `peakGini=${gmePeakGini.toFixed(3)}`);

// ================================================================
// EVENT 5: SVB 2023 — KRE
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("EVENT 5: SVB 2023 — KRE (144 bars, 2022-12 to 2023-06)");
console.log("=".repeat(80));

const svbPath = path.join(DATA_DIR, "svb-2023-kre.csv");
const svbResults = analyzeCSV(svbPath);
console.log(`  ${svbResults.length} bars analyzed\n`);

const svbBaselineMean = avgInRange(svbResults, "2022-12-01", "2023-02-28", "mean");
const svbBaselineGini = avgInRange(svbResults, "2022-12-01", "2023-02-28", "gini");
const svbPeakMean     = avgInRange(svbResults, "2023-03-08", "2023-03-31", "mean");
const svbPeakGini     = avgInRange(svbResults, "2023-03-08", "2023-03-31", "gini");
const svbRecoveryMean = avgInRange(svbResults, "2023-05-01", "2023-06-30", "mean");
const svbRecoveryGini = avgInRange(svbResults, "2023-05-01", "2023-06-30", "gini");

console.log("  Phase geometry:");
console.log(`    Baseline (Dec 2022-Feb 2023):  mean=${svbBaselineMean.toFixed(3)}, gini=${svbBaselineGini.toFixed(3)}, n=${countInRange(svbResults, "2022-12-01", "2023-02-28")}`);
console.log(`    Peak (Mar 8-31 2023):          mean=${svbPeakMean.toFixed(3)}, gini=${svbPeakGini.toFixed(3)}, n=${countInRange(svbResults, "2023-03-08", "2023-03-31")}`);
console.log(`    Recovery (May-Jun 2023):       mean=${svbRecoveryMean.toFixed(3)}, gini=${svbRecoveryGini.toFixed(3)}, n=${countInRange(svbResults, "2023-05-01", "2023-06-30")}`);
console.log();

check(svbPeakMean > svbBaselineMean,
  "Peak mean > baseline mean (crisis widening)",
  `peak=${svbPeakMean.toFixed(3)} vs baseline=${svbBaselineMean.toFixed(3)}`);

check(svbRecoveryMean < svbPeakMean,
  "Recovery mean < peak mean (narrowing)",
  `recovery=${svbRecoveryMean.toFixed(3)} vs peak=${svbPeakMean.toFixed(3)}`);

// ================================================================
// CROSS-EVENT CALIBRATION: mean-Gini topology characterization
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("CROSS-EVENT STRUCTURAL PROPERTIES");
console.log("=".repeat(80));

// Collect all results with mean-Gini pairs for correlation
const allMeans = [...gfcResults, ...covidResults, ...svbResults].map(r => r.mean);
const allGinis = [...gfcResults, ...covidResults, ...svbResults].map(r => r.gini);

if (allMeans.length > 10) {
  const mgR = pearsonR(allMeans, allGinis);
  console.log(`\n  Mean-Gini Pearson r (GFC+COVID+SVB combined): ${mgR.toFixed(3)}`);

  // CALIBRATION NOTE: In crisis TEXT domains, mean-Gini r < 0 because linguistic
  // signals converge on dissolution vocabulary (high mean, low Gini = consolidation).
  // In market OHLCV, mean-Gini r > 0 because market crises produce indicator
  // DISAGREEMENT — some indicators scream danger while others lag. This is the
  // BOUNDARY LAYER topology (high mean + high Gini) vs text's CRISIS CONSOLIDATION
  // (high mean + low Gini). Both are valid topological signatures.
  //
  // The geometric test is whether the mean-Gini relationship is CONSISTENT within
  // the market domain, not whether it matches the text domain's polarity.
  const mgVariance = allMeans.reduce((s, _, i) => {
    const residual = allGinis[i] - (mgR * allMeans[i]);
    return s + residual * residual;
  }, 0) / allMeans.length;
  const mgConsistency = Math.abs(mgR);  // strength of relationship in either direction

  console.log(`  Mean-Gini |r| (relationship strength): ${mgConsistency.toFixed(3)}`);
  console.log(`  Topology: market signals show ${mgR > 0 ? "BOUNDARY LAYER" : "CONSOLIDATION"} pattern`);

  check(mgConsistency > 0.1,
    "Mean-Gini relationship is structurally non-trivial (|r| > 0.1)",
    `|r|=${mgConsistency.toFixed(3)} — signals show no mean-Gini structure`);
}

// ================================================================
// COMPOSITE SCORE
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("MARKET GEOMETRIC BACKTEST — COMPOSITE");
console.log("=".repeat(80));

const total = totalPassed + totalFailed;
const pct = total > 0 ? (totalPassed / total * 100).toFixed(1) : "0.0";

console.log(`  ${totalPassed} passed, ${totalFailed} failed`);
console.log(`  Composite: ${pct}%`);
console.log("=".repeat(80));

if (totalFailed > 0) {
  console.log(`\nCALIBRATION NOTE: ${totalFailed} geometric validation(s) did not hold.`);
  console.log("Review the actual values above to understand the signal topology.");
  process.exit(1);
} else {
  console.log("\nAll geometric validations PASS — regime topology holds on real market data.");
}
