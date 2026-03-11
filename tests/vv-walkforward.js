/**
 * V&V Walk-Forward — Statistical Audit Task 4
 *
 * Tests the claim: the engine's trajectory calls (ACCELERATING, CONSOLIDATING,
 * RESOLVING, TURBULENT) predict forward price return direction better than a
 * coin flip. Original calibration showed 51.5% at 5d, 50.8% at 10d — barely
 * above chance. This test applies a binomial test at alpha = 0.001 to determine
 * whether the observed hit rate is statistically significant.
 *
 * Walk-forward protocol (NO LOOKAHEAD):
 *   At each bar i (after 60-bar baseline), compute trajectory using ONLY data
 *   [0..i]. Then check if actual forward return matches prediction direction.
 *
 * Scoring:
 *   ACCELERATING / CONSOLIDATING = bearish -> expect negative forward return
 *   RESOLVING / TURBULENT = bullish/mixed -> expect positive forward return
 *   Hit = prediction direction matches actual return sign
 *
 * Statistical tests at alpha = 0.001:
 *   1. Binomial test (one-sided, greater) per horizon — pooled across all events
 *   2. Bootstrap 99.9% CI on pooled hit rate per horizon
 *   3. Stratified binomial test per trajectory type per horizon
 *
 * Composite verdict:
 *   CONFIRMED — >= 2 horizons significant at alpha = 0.001
 *   INCONCLUSIVE — exactly 1 horizon significant
 *   REJECTED — 0 horizons significant
 *
 * Data sources: 15 real Yahoo Finance OHLCV event CSVs
 *
 * Run: node tests/vv-walkforward.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, computeCrossCoherence } from "./lib/backtest-engine.js";
import { marketToSignals, MARKET_CATEGORIES } from "../src/adapters/market-adapter.js";
import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../src/engine/projection.js";
import { binomialTest, bootstrapCI } from "./lib/statistics.js";

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

const HORIZONS = [5, 10, 20];
const BASELINE_WINDOW = 60;
const ALPHA = 0.001;

// ================================================================
// WALK-FORWARD: per-bar trajectory + forward returns (NO LOOKAHEAD)
// ================================================================

function walkForward(csvPath) {
  const rows = readCSV(csvPath);

  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));

  // Build full technicals arrays mapped to adapter key names
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    const adapterKey = CSV_TO_TECH[csvKey];
    technicals[adapterKey] = rows.map(r => r[csvKey] || 0);
  }

  const results = [];
  const coherenceHistory = [];

  for (let i = 0; i < rows.length; i++) {
    // Only start producing trajectory calls once we have enough baseline
    if (i < BASELINE_WINDOW) continue;

    // Slice data up to this point — NO LOOKAHEAD
    const sliceTechnicals = {};
    for (const csvKey of CSV_TECH_KEYS) {
      const adapterKey = CSV_TO_TECH[csvKey];
      sliceTechnicals[adapterKey] = technicals[adapterKey].slice(0, i + 1);
    }
    const sliceOhlcv = ohlcv.slice(0, i + 1);

    const { signals } = marketToSignals("TEST", sliceOhlcv, sliceTechnicals, BASELINE_WINDOW);
    if (signals.length === 0) continue;

    const coherence = computeCrossCoherence(signals, MARKET_CATEGORIES);
    coherenceHistory.push(coherence);

    // Projection layer
    const prop = computePropagationCapacity(signals, MARKET_CATEGORIES);
    const recentCoherence = coherenceHistory.slice(-5);
    const diss = recentCoherence.length >= 2
      ? computeDissolutionRate(recentCoherence)
      : 0;
    const trajectory = classifyTrajectory(prop.aggregate, diss);

    // Forward returns (using actual future close prices)
    const close_i = rows[i].Close;
    const fr5  = (i + 5  < rows.length) ? (rows[i + 5].Close  - close_i) / close_i : null;
    const fr10 = (i + 10 < rows.length) ? (rows[i + 10].Close - close_i) / close_i : null;
    const fr20 = (i + 20 < rows.length) ? (rows[i + 20].Close - close_i) / close_i : null;

    results.push({
      date: rows[i].date,
      trajectory: trajectory.label,
      fr5,
      fr10,
      fr20,
    });
  }

  return results;
}

// ================================================================
// SCORING: trajectory direction vs actual return sign
// ================================================================

function isBearish(traj) {
  return traj === "ACCELERATING" || traj === "CONSOLIDATING";
}

function isHit(trajectory, forwardReturn) {
  if (isBearish(trajectory)) return forwardReturn < 0;
  return forwardReturn >= 0;
}

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V WALK-FORWARD — Binomial Test + Trajectory Stratification");
console.log("Statistical Audit Task 4 — alpha = 0.001 (99.9% confidence)");
console.log("15 real Yahoo Finance OHLCV datasets — NO LOOKAHEAD");
console.log("=".repeat(80));

// Pool all predictions across all events
const pooled = { 5: [], 10: [], 20: [] };
const eventSummaries = [];

for (const eventName of MARKET_EVENTS) {
  const csvPath = path.join(DATA_DIR, `${eventName}.csv`);

  console.log(`\n${"─".repeat(80)}`);
  console.log(`EVENT: ${eventName}`);
  console.log("─".repeat(80));

  const results = walkForward(csvPath);
  console.log(`  ${results.length} trajectory calls (after ${BASELINE_WINDOW}-bar baseline)`);

  // Trajectory distribution for this event
  const trajCounts = {};
  for (const r of results) {
    trajCounts[r.trajectory] = (trajCounts[r.trajectory] || 0) + 1;
  }
  console.log("  Trajectory distribution:");
  for (const [traj, count] of Object.entries(trajCounts).sort()) {
    const pct = (count / results.length * 100).toFixed(1);
    console.log(`    ${traj.padEnd(16)} ${String(count).padStart(4)} calls (${pct}%)`);
  }

  // Pool predictions per horizon
  for (const h of HORIZONS) {
    const key = `fr${h}`;
    for (const r of results) {
      if (r[key] !== null) {
        pooled[h].push({ trajectory: r.trajectory, forwardReturn: r[key] });
      }
    }
  }

  eventSummaries.push({ name: eventName, bars: results.length, trajCounts });
}

// ================================================================
// POOLED ANALYSIS — binomial test per horizon
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("POOLED WALK-FORWARD ANALYSIS — All 15 Events Combined");
console.log("=".repeat(80));

const horizonResults = {};
let significantHorizons = 0;

for (const h of HORIZONS) {
  const predictions = pooled[h];
  const n = predictions.length;
  const hits = predictions.filter(p => isHit(p.trajectory, p.forwardReturn)).length;
  const rate = n > 0 ? hits / n : 0;

  // Binomial test: H0 p = 0.5, one-sided greater
  const pValue = binomialTest(hits, n, 0.5);
  const significant = pValue < ALPHA;
  if (significant) significantHorizons++;

  // Bootstrap 99.9% CI on hit rate
  const hitArray = predictions.map(p => isHit(p.trajectory, p.forwardReturn) ? 1 : 0);
  const ci = bootstrapCI(hitArray, arr => arr.reduce((a, b) => a + b, 0) / arr.length, ALPHA, 10000);

  horizonResults[h] = { n, hits, rate, pValue, significant, ci };

  console.log(`\n  ${h}-day horizon (n = ${n}):`);
  console.log(`    Hit rate:     ${(rate * 100).toFixed(2)}% (${hits}/${n})`);
  console.log(`    99.9% CI:     [${(ci.lo * 100).toFixed(2)}%, ${(ci.hi * 100).toFixed(2)}%]`);
  console.log(`    Binomial p:   ${pValue < 1e-10 ? pValue.toExponential(4) : pValue.toFixed(6)}`);
  console.log(`    Significant:  ${significant ? "YES ***" : "NO"} (alpha = ${ALPHA})`);
}

// ================================================================
// STRATIFIED ANALYSIS — per trajectory type per horizon
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("STRATIFIED BY TRAJECTORY TYPE");
console.log("=".repeat(80));

const ALL_TRAJECTORIES = ["ACCELERATING", "CONSOLIDATING", "RESOLVING", "TURBULENT"];

for (const h of HORIZONS) {
  console.log(`\n  ${h}-day horizon:`);
  console.log(`    ${"Trajectory".padEnd(16)} ${"N".padStart(6)} ${"Hits".padStart(6)} ${"Rate".padStart(8)} ${"p-value".padStart(12)} ${"Sig".padStart(6)}`);
  console.log(`    ${"-".repeat(54)}`);

  for (const traj of ALL_TRAJECTORIES) {
    const subset = pooled[h].filter(p => p.trajectory === traj);
    const n = subset.length;
    if (n === 0) {
      console.log(`    ${traj.padEnd(16)} ${String(0).padStart(6)}      ---      ---          ---    ---`);
      continue;
    }

    const hits = subset.filter(p => isHit(p.trajectory, p.forwardReturn)).length;
    const rate = hits / n;
    const pVal = binomialTest(hits, n, 0.5);
    const sig001 = pVal < 0.001;
    const sig05 = pVal < 0.05;
    const sigMark = sig001 ? "***" : (sig05 ? "  *" : "   ");
    const direction = isBearish(traj) ? "bear" : "bull";

    console.log(
      `    ${traj.padEnd(16)} ${String(n).padStart(6)} ${String(hits).padStart(6)} ${(rate * 100).toFixed(1).padStart(7)}% ${pVal < 1e-10 ? pVal.toExponential(3).padStart(12) : pVal.toFixed(6).padStart(12)} ${sigMark.padStart(5)} [${direction}]`
    );
  }
}

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("COMPOSITE VERDICT");
console.log("=".repeat(80));

console.log(`\n  Horizons significant at alpha = ${ALPHA}:`);
for (const h of HORIZONS) {
  const r = horizonResults[h];
  const mark = r.significant ? "SIGNIFICANT ***" : "not significant";
  console.log(`    ${h}d: ${(r.rate * 100).toFixed(2)}% (p = ${r.pValue < 1e-10 ? r.pValue.toExponential(4) : r.pValue.toFixed(6)}) — ${mark}`);
}
console.log(`\n  Significant horizons: ${significantHorizons} / ${HORIZONS.length}`);

let verdict;
if (significantHorizons >= 2) {
  verdict = "CONFIRMED";
  console.log(`\n  VERDICT: CONFIRMED — trajectory calls predict forward returns`);
  console.log(`  at >= 2 horizons with p < ${ALPHA}. Forward-predictive value is`);
  console.log(`  statistically established beyond coin-flip baseline.`);
} else if (significantHorizons === 1) {
  verdict = "INCONCLUSIVE";
  console.log(`\n  VERDICT: INCONCLUSIVE — only 1 horizon significant.`);
  console.log(`  Weak evidence of predictive signal. May require more data or`);
  console.log(`  trajectory threshold recalibration.`);
} else {
  verdict = "REJECTED";
  console.log(`\n  VERDICT: REJECTED — 0 horizons significant at alpha = ${ALPHA}.`);
  console.log(`  Trajectory calls do not predict forward returns better than`);
  console.log(`  a coin flip at any tested horizon. This is a valid V&V finding —`);
  console.log(`  the engine's trajectory layer does not carry directional signal.`);
}

console.log(`\n${"=".repeat(80)}`);
console.log(`V&V Walk-Forward — ${verdict}`);
console.log("=".repeat(80));
