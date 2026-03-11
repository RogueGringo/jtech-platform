/**
 * V&V Power Analysis — Statistical Audit Task 8
 *
 * Adaptive sample sizing for V&V claims. Reports whether current sample sizes
 * produce sufficiently narrow 99.9% CIs (target width < 0.15) for two primary
 * claims:
 *
 *   Claim 1: Pooled mean-Gini correlation (bootstrap on paired tuples)
 *   Claim 2: Per-event correlation consistency (bootstrap on per-event r values)
 *
 * If CI width >= 0.15, recommends additional N and lists reserve events.
 *
 * Data sources: 15 real Yahoo Finance OHLCV event CSVs
 *
 * Run: node tests/vv-power-analysis.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { powerAnalysis } from "./lib/statistics.js";

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
// RESERVE EVENTS — for recommendation if N is insufficient
// ================================================================

const RESERVE_EVENTS = [
  "LTCM 1998 (SPY)",
  "Brexit 2016 (EWU)",
  "Turkey 2018 (TUR)",
  "Archegos 2021 (VIAC)",
  "Meme 2024 (RDDT)",
];

// ================================================================
// CONSTANTS
// ================================================================

const BASELINE_WINDOW = 60;
const TARGET_WIDTH = 0.15;
const ALPHA = 0.001;
const BOOTSTRAP_B = 5000;

// ================================================================
// CORE: CSV -> per-bar mean/Gini pairs
// ================================================================

function analyzeCSV(csvPath) {
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

    const { signals } = marketToSignals("TEST", sliceOhlcv, sliceTechnicals, BASELINE_WINDOW);
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
console.log("V&V POWER ANALYSIS — Adaptive Sample Sizing");
console.log("Statistical Audit Task 8 — 99.9% CI target width < 0.15");
console.log("15 real Yahoo Finance OHLCV datasets");
console.log("=".repeat(80));

// ----------------------------------------------------------------
// STEP 1: Process all 15 market events, collect per-event r values
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 1: Per-event mean-Gini correlations");
console.log("-".repeat(80));

const allMeans = [];
const allGinis = [];
const perEventCorrelations = [];
const eventResults = [];

for (const event of MARKET_EVENTS) {
  const csvPath = path.join(DATA_DIR, `${event}.csv`);
  const { means, ginis } = analyzeCSV(csvPath);

  const r = means.length >= 3 ? pearsonR(means, ginis) : NaN;
  const n = means.length;

  eventResults.push({ event, r, n });

  if (!isNaN(r)) {
    perEventCorrelations.push(r);
  }

  allMeans.push(...means);
  allGinis.push(...ginis);

  console.log(`  ${event.padEnd(28)} r=${isNaN(r) ? "  N/A   " : r.toFixed(4).padStart(8)}  n=${String(n).padStart(4)}`);
}

// ----------------------------------------------------------------
// STEP 2: Pooled mean-Gini correlation
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 2: Pooled mean-Gini correlation");
console.log("-".repeat(80));

const pooledR = pearsonR(allMeans, allGinis);
const pooledN = allMeans.length;

console.log(`  Pooled r = ${pooledR.toFixed(4)}`);
console.log(`  Pooled n = ${pooledN}`);

// ----------------------------------------------------------------
// STEP 3: Power analysis — Claim 1 (pooled correlation)
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("CLAIM 1: Pooled mean-Gini correlation");
console.log("  Bootstrap on paired (mean, Gini) tuples");
console.log("-".repeat(80));

const pairedData = allMeans.map((m, i) => [m, allGinis[i]]);

const corrFn = pairs => {
  const ms = pairs.map(p => p[0]);
  const gs = pairs.map(p => p[1]);
  return pearsonR(ms, gs);
};

const pa1 = powerAnalysis(pairedData, corrFn, TARGET_WIDTH, ALPHA, BOOTSTRAP_B);

console.log(`  Point estimate r  = ${pooledR.toFixed(4)}`);
console.log(`  99.9% CI          = [${pa1.ci.lo.toFixed(4)}, ${pa1.ci.hi.toFixed(4)}]`);
console.log(`  CI width          = ${pa1.width.toFixed(4)}`);
console.log(`  Target width      = ${TARGET_WIDTH}`);
console.log(`  Sufficient        : ${pa1.sufficient ? "YES" : "NO"}`);

if (!pa1.sufficient) {
  console.log(`  Recommended N     = ${pa1.recommendedN} paired tuples`);
  console.log(`  Current N         = ${pooledN}`);
  console.log(`  Deficit           = ${pa1.recommendedN - pooledN} additional bars needed`);
}

// ----------------------------------------------------------------
// STEP 4: Power analysis — Claim 2 (per-event correlation consistency)
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("CLAIM 2: Per-event correlation consistency");
console.log("  Bootstrap on per-event r values");
console.log("-".repeat(80));

const meanFn = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

const pa2 = powerAnalysis(perEventCorrelations, meanFn, TARGET_WIDTH, ALPHA, BOOTSTRAP_B);

const meanPerEventR = perEventCorrelations.length > 0
  ? perEventCorrelations.reduce((a, b) => a + b, 0) / perEventCorrelations.length
  : NaN;

console.log(`  Events with valid r = ${perEventCorrelations.length}`);
console.log(`  Mean per-event r    = ${isNaN(meanPerEventR) ? "N/A" : meanPerEventR.toFixed(4)}`);
console.log(`  99.9% CI            = [${pa2.ci.lo.toFixed(4)}, ${pa2.ci.hi.toFixed(4)}]`);
console.log(`  CI width            = ${pa2.width.toFixed(4)}`);
console.log(`  Target width        = ${TARGET_WIDTH}`);
console.log(`  Sufficient          : ${pa2.sufficient ? "YES" : "NO"}`);

if (!pa2.sufficient) {
  console.log(`  Recommended N       = ${pa2.recommendedN} events`);
  console.log(`  Current N           = ${perEventCorrelations.length}`);
  console.log(`  Deficit             = ${pa2.recommendedN - perEventCorrelations.length} additional events needed`);
}

// ----------------------------------------------------------------
// STEP 5: Reserve event recommendations (if either claim insufficient)
// ----------------------------------------------------------------

if (!pa1.sufficient || !pa2.sufficient) {
  console.log("\n" + "-".repeat(80));
  console.log("RESERVE EVENTS — candidates to narrow CI");
  console.log("-".repeat(80));

  for (let i = 0; i < RESERVE_EVENTS.length; i++) {
    console.log(`  ${i + 1}. ${RESERVE_EVENTS[i]}`);
  }

  if (!pa2.sufficient) {
    const deficit = pa2.recommendedN - perEventCorrelations.length;
    const available = RESERVE_EVENTS.length;
    if (deficit <= available) {
      console.log(`\n  ${deficit} additional events needed; ${available} reserve events available — ACHIEVABLE`);
    } else {
      console.log(`\n  ${deficit} additional events needed; only ${available} reserve events listed`);
      console.log(`  Consider adding more historical events (e.g., Asian 1997, Peso 1994, Barings 1995)`);
    }
  }
}

// ================================================================
// OVERALL VERDICT
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("V&V POWER ANALYSIS — OVERALL VERDICT");
console.log("=".repeat(80));

console.log("\n  Per-event correlations:");
for (const er of eventResults) {
  const rStr = isNaN(er.r) ? "  N/A   " : er.r.toFixed(4).padStart(8);
  console.log(`    ${er.event.padEnd(28)} r=${rStr}  n=${String(er.n).padStart(4)}`);
}

console.log(`\n  Claim 1 (pooled r):         CI width = ${pa1.width.toFixed(4)}  ${pa1.sufficient ? "SUFFICIENT" : "INSUFFICIENT"}`);
console.log(`  Claim 2 (per-event r mean): CI width = ${pa2.width.toFixed(4)}  ${pa2.sufficient ? "SUFFICIENT" : "INSUFFICIENT"}`);

const overallSufficient = pa1.sufficient && pa2.sufficient;

if (overallSufficient) {
  console.log("\n  VERDICT: SUFFICIENT");
  console.log("  Both claims have 99.9% CI width < 0.15.");
  console.log("  Current sample sizes support V&V claims at the target precision.");
} else {
  console.log("\n  VERDICT: INSUFFICIENT");
  if (!pa1.sufficient) {
    console.log(`  Claim 1 needs ${pa1.recommendedN} paired tuples (have ${pooledN})`);
  }
  if (!pa2.sufficient) {
    console.log(`  Claim 2 needs ${pa2.recommendedN} events (have ${perEventCorrelations.length})`);
  }
  console.log("  Expand dataset with reserve events to achieve target CI width.");
}

console.log(`\n${"=".repeat(80)}`);
console.log(`V&V Power Analysis — ${overallSufficient ? "SUFFICIENT" : "INSUFFICIENT"}`);
console.log("=".repeat(80));
