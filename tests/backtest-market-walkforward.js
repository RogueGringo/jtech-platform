/**
 * Market Walk-Forward Backtest — Layer B Predictive Validation
 *
 * Tests whether the engine's trajectory calls have forward-predictive value.
 * At each date, computes regime + trajectory using ONLY data available up to
 * that point (no lookahead), then checks what actually happened in the next
 * N trading days.
 *
 * Bearish trajectories (ACCELERATING, CONSOLIDATING) → expect negative forward return
 * Bullish trajectories (RESOLVING, TURBULENT) → expect positive forward return
 *
 * Data sources (real Yahoo Finance OHLCV):
 *   - GFC 2008:  SPY  (503 bars, 2007-07 to 2009-06)
 *   - COVID 2020: SPY  (145 bars, 2019-12 to 2020-06)
 *   - SVB 2023:   KRE  (144 bars, 2022-12 to 2023-06)
 *   - GME 2021:   GME  (145 bars, 2020-12 to 2021-06)
 *
 * Run: node tests/backtest-market-walkforward.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime, computeCrossCoherence } from "./lib/backtest-engine.js";
import { marketToSignals, MARKET_CATEGORIES } from "../src/adapters/market-adapter.js";
import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../src/engine/projection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

// ================================================================
// CSV column → adapter tech key mapping (same as geometric backtest)
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
// WALK-FORWARD ANALYSIS: per-bar regime + trajectory + forward return
// ================================================================

function walkForward(csvPath, baselineWindow = 60) {
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
    if (i < baselineWindow) continue;

    // Slice data up to this point — NO LOOKAHEAD
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
      close: close_i,
      trajectory: trajectory.label,
      propagation: prop.aggregate,
      dissolution: diss,
      mean,
      gini,
      coherence,
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

/**
 * Score trajectory predictions against actual forward returns.
 * ACCELERATING/CONSOLIDATING → bearish → expect negative return (hit if return < 0)
 * RESOLVING/TURBULENT → bullish/mixed → expect positive return (hit if return >= 0)
 */
function scorePredictions(results, horizon) {
  const key = `fr${horizon}`;
  const valid = results.filter(r => r[key] !== null);
  if (valid.length === 0) return { total: 0, hits: 0, rate: 0, byTrajectory: {} };

  const byTrajectory = {};
  let totalHits = 0;

  for (const r of valid) {
    const traj = r.trajectory;
    if (!byTrajectory[traj]) byTrajectory[traj] = { count: 0, hits: 0 };
    byTrajectory[traj].count++;

    const bearish = traj === "ACCELERATING" || traj === "CONSOLIDATING";
    const actualReturn = r[key];

    // Hit = prediction direction matches actual return sign
    const hit = bearish ? actualReturn < 0 : actualReturn >= 0;
    if (hit) {
      totalHits++;
      byTrajectory[traj].hits++;
    }
  }

  // Compute per-trajectory hit rates
  for (const traj of Object.keys(byTrajectory)) {
    const t = byTrajectory[traj];
    t.rate = t.count > 0 ? (t.hits / t.count * 100) : 0;
  }

  return {
    total: valid.length,
    hits: totalHits,
    rate: valid.length > 0 ? (totalHits / valid.length * 100) : 0,
    byTrajectory,
  };
}

// ================================================================
// EVENT DEFINITIONS
// ================================================================

const EVENTS = [
  { name: "GFC 2008",   file: "gfc-2008-spy.csv",   ticker: "SPY" },
  { name: "COVID 2020", file: "covid-2020-spy.csv",  ticker: "SPY" },
  { name: "SVB 2023",   file: "svb-2023-kre.csv",    ticker: "KRE" },
  { name: "GME 2021",   file: "gme-2021-gme.csv",    ticker: "GME" },
];

const HORIZONS = [5, 10, 20];

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("MARKET WALK-FORWARD BACKTEST — Layer B Predictive Validation");
console.log("Real Yahoo Finance OHLCV data — trajectory prediction scoring");
console.log("=".repeat(80));

const eventScores = [];

for (const event of EVENTS) {
  const csvPath = path.join(DATA_DIR, event.file);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`EVENT: ${event.name} — ${event.ticker} (${event.file})`);
  console.log("=".repeat(80));

  const results = walkForward(csvPath);
  console.log(`  ${results.length} trajectory calls generated (after 60-bar baseline)\n`);

  // Trajectory distribution
  const trajCounts = {};
  for (const r of results) {
    trajCounts[r.trajectory] = (trajCounts[r.trajectory] || 0) + 1;
  }
  console.log("  Trajectory distribution:");
  for (const [traj, count] of Object.entries(trajCounts).sort()) {
    const pct = (count / results.length * 100).toFixed(1);
    console.log(`    ${traj.padEnd(15)} ${count} calls (${pct}%)`);
  }
  console.log();

  // Score each horizon
  const horizonScores = {};
  for (const h of HORIZONS) {
    const score = scorePredictions(results, h);
    horizonScores[h] = score;

    console.log(`  ${h}d forward horizon (${score.total} predictions):`);
    for (const [traj, ts] of Object.entries(score.byTrajectory).sort()) {
      const bearish = traj === "ACCELERATING" || traj === "CONSOLIDATING";
      const direction = bearish ? "bearish" : "bullish";
      console.log(`    ${traj.padEnd(15)} hit=${ts.rate.toFixed(1)}% (${ts.hits}/${ts.count}) [${direction}]`);
    }
    console.log(`    ${"OVERALL".padEnd(15)} hit=${score.rate.toFixed(1)}% (${score.hits}/${score.total})`);
    console.log();
  }

  eventScores.push({ name: event.name, horizonScores });
}

// ================================================================
// WALK-FORWARD SUMMARY TABLE
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("WALK-FORWARD SUMMARY");
console.log("=".repeat(80));

// Table header
const hdr = "  Event".padEnd(20) + HORIZONS.map(h => `${h}d Hit`.padStart(10)).join("") ;
console.log(hdr);
console.log("  " + "-".repeat(hdr.length - 2));

// Accumulate overall across all events per horizon
const overallByHorizon = {};
for (const h of HORIZONS) overallByHorizon[h] = { hits: 0, total: 0 };

for (const es of eventScores) {
  let row = `  ${es.name}`.padEnd(20);
  for (const h of HORIZONS) {
    const s = es.horizonScores[h];
    overallByHorizon[h].hits += s.hits;
    overallByHorizon[h].total += s.total;
    row += `${s.rate.toFixed(1)}%`.padStart(10);
  }
  console.log(row);
}

// Overall row
let overallRow = "  OVERALL".padEnd(20);
const horizonRates = [];
for (const h of HORIZONS) {
  const o = overallByHorizon[h];
  const rate = o.total > 0 ? (o.hits / o.total * 100) : 0;
  horizonRates.push(rate);
  overallRow += `${rate.toFixed(1)}%`.padStart(10);
}
console.log("  " + "-".repeat(hdr.length - 2));
console.log(overallRow);

// ================================================================
// PASS/FAIL per horizon — better than random coin flip (> 50%)
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("HORIZON PASS/FAIL — geometric validation: overall hit rate > 50%");
console.log("=".repeat(80));

let horizonsPassed = 0;
for (let idx = 0; idx < HORIZONS.length; idx++) {
  const h = HORIZONS[idx];
  const rate = horizonRates[idx];
  const pass = rate > 50;
  if (pass) horizonsPassed++;
  const status = pass ? "PASS" : "FAIL";
  console.log(`  ${h}d: ${rate.toFixed(1)}% — ${status}`);
}

console.log(`\n  Horizons passing: ${horizonsPassed}/${HORIZONS.length}`);
console.log(`  Requirement: at least 2 of 3 horizons > 50%`);

if (horizonsPassed >= 2) {
  console.log("\n  RESULT: PASS — trajectory calls have forward-predictive value.");
  console.log("=".repeat(80));
} else {
  console.log("\n  RESULT: FAIL — insufficient predictive signal.");
  console.log("=".repeat(80));
  console.log("\nCALIBRATION NOTE: Walk-forward hit rates below 50% indicate trajectory");
  console.log("classification does not predict forward price direction at these horizons.");
  console.log("Review propagation/dissolution thresholds and coherence window.");
  process.exit(1);
}
