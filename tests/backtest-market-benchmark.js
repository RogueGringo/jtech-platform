/**
 * Market Benchmark Backtest — Layer C
 *
 * Measures whether the topological engine detects regime changes EARLIER
 * or LATER than traditional single-variable quant indicators.
 *
 * Traditional signals compared:
 *   1. RSI < 30        — momentum oversold
 *   2. SMA50 distance  — price below 50-day moving average (sma50_dist < 0)
 *   3. Drawdown > 10%  — 10% off rolling high (drawdown < -10)
 *
 * Engine signal:
 *   First date regime != STABLE (mean >= 2.5 OR gini >= 0.2) after warmup.
 *
 * Lead time = traditional date - engine date (positive = engine was first).
 *
 * Data sources (all Yahoo Finance real OHLCV):
 *   - GFC 2008:   SPY  (503 bars, 2007-07 to 2009-06)
 *   - COVID 2020: SPY  (145 bars, 2019-12 to 2020-06)
 *   - SVB 2023:   KRE  (144 bars, 2022-12 to 2023-06)
 *   - GME 2021:   GME  (145 bars, 2020-12 to 2021-06)
 *
 * Run: node tests/backtest-market-benchmark.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

// ================================================================
// CSV → adapter tech key mapping (same as geometric backtest)
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
// CORE: run engine at each bar and return per-bar regime + raw CSV values
// ================================================================

function analyzeForBenchmark(csvPath, baselineWindow = 60) {
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
      index: i,
      close: rows[i].Close,
      rsi: rows[i].rsi,
      sma50_dist: rows[i].sma50_dist,
      drawdown: rows[i].drawdown,
      mean,
      gini,
      regime: regime.label,
    });
  }
  return results;
}

// ================================================================
// DETECTION: find first date a condition is met after a cutoff
// ================================================================

function firstDateWhere(results, condition, afterDate, afterIndex = 0) {
  for (const r of results) {
    if (r.date <= afterDate) continue;
    if (r.index < afterIndex) continue;
    if (condition(r)) return r;
  }
  return null;
}

// ================================================================
// TRADING DAYS between two dates in the results array
// ================================================================

function tradingDaysBetween(results, dateA, dateB) {
  if (!dateA || !dateB) return null;
  const idxA = results.findIndex(r => r.date === dateA);
  const idxB = results.findIndex(r => r.date === dateB);
  if (idxA === -1 || idxB === -1) return null;
  return idxB - idxA;
}

// ================================================================
// EVENT DEFINITIONS
// ================================================================

const EVENTS = [
  {
    name: "GFC 2008 — SPY",
    csv: "gfc-2008-spy.csv",
    crisisOnset: "2008-06-01",       // look for signals after this date
    warmupBars: 60,                   // engine needs 60 bars for baseline
    rsiWarmup: 14,
    smaWarmup: 50,
  },
  {
    name: "COVID 2020 — SPY",
    csv: "covid-2020-spy.csv",
    crisisOnset: "2020-01-15",
    warmupBars: 60,
    rsiWarmup: 14,
    smaWarmup: 50,
  },
  {
    name: "SVB 2023 — KRE",
    csv: "svb-2023-kre.csv",
    crisisOnset: "2023-02-01",
    warmupBars: 60,
    rsiWarmup: 14,
    smaWarmup: 50,
  },
  {
    name: "GME 2021 — GME",
    csv: "gme-2021-gme.csv",
    crisisOnset: "2021-01-01",
    warmupBars: 60,
    rsiWarmup: 14,
    smaWarmup: 50,
  },
];

// ================================================================
// RUN BENCHMARK
// ================================================================

console.log("=".repeat(80));
console.log("MARKET BENCHMARK — Layer C: Engine vs Traditional Quant Signals");
console.log("Real Yahoo Finance OHLCV data — detection timing comparison");
console.log("=".repeat(80));

const summaryRows = [];
let totalPassed = 0;
let totalFailed = 0;

for (const event of EVENTS) {
  const csvPath = path.join(DATA_DIR, event.csv);
  const results = analyzeForBenchmark(csvPath);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`EVENT: ${event.name}`);
  console.log(`${"=".repeat(80)}`);
  console.log(`  ${results.length} bars analyzed`);
  console.log(`  Crisis onset cutoff: after ${event.crisisOnset}`);
  console.log(`  Engine warmup: ${event.warmupBars} bars | RSI warmup: ${event.rsiWarmup} | SMA warmup: ${event.smaWarmup}`);

  // --- Engine detection: first non-STABLE after onset + warmup ---
  const engineHit = firstDateWhere(
    results,
    r => r.regime !== "STABLE",
    event.crisisOnset,
    event.warmupBars,
  );

  // --- RSI < 30: first oversold after onset + RSI warmup ---
  const rsiHit = firstDateWhere(
    results,
    r => r.rsi !== null && r.rsi !== 0 && r.rsi < 30,
    event.crisisOnset,
    event.rsiWarmup,
  );

  // --- SMA50 dist < 0: first below 50 SMA after onset + SMA warmup ---
  const smaHit = firstDateWhere(
    results,
    r => r.sma50_dist !== null && r.sma50_dist !== 0 && r.sma50_dist < 0,
    event.crisisOnset,
    event.smaWarmup,
  );

  // --- Drawdown > 10%: drawdown column is negative (percent from high) ---
  // CSV stores drawdown as negative values (e.g., -10.5 means 10.5% drawdown)
  const drawdownHit = firstDateWhere(
    results,
    r => r.drawdown !== null && r.drawdown < -10,
    event.crisisOnset,
    0,  // no warmup needed for drawdown
  );

  // --- Print results ---
  console.log();
  if (engineHit) {
    console.log(`  Engine first non-STABLE: ${engineHit.date} (regime: ${engineHit.regime}, mean=${engineHit.mean.toFixed(3)}, gini=${engineHit.gini.toFixed(3)})`);
  } else {
    console.log(`  Engine first non-STABLE: NONE detected after ${event.crisisOnset}`);
  }

  // RSI
  if (rsiHit) {
    const lead = engineHit ? tradingDaysBetween(results, engineHit.date, rsiHit.date) : null;
    const leadStr = lead !== null ? (lead > 0 ? `engine leads by ${lead} days` : lead < 0 ? `engine lags by ${Math.abs(lead)} days` : `same day`) : "N/A";
    console.log(`  RSI < 30 first:          ${rsiHit.date} (RSI=${rsiHit.rsi.toFixed(1)}) — ${leadStr}`);
  } else {
    console.log(`  RSI < 30 first:          NONE detected after ${event.crisisOnset}`);
  }

  // SMA50
  if (smaHit) {
    const lead = engineHit ? tradingDaysBetween(results, engineHit.date, smaHit.date) : null;
    const leadStr = lead !== null ? (lead > 0 ? `engine leads by ${lead} days` : lead < 0 ? `engine lags by ${Math.abs(lead)} days` : `same day`) : "N/A";
    console.log(`  Below 50 SMA first:      ${smaHit.date} (sma50_dist=${smaHit.sma50_dist.toFixed(2)}%) — ${leadStr}`);
  } else {
    console.log(`  Below 50 SMA first:      NONE detected after ${event.crisisOnset}`);
  }

  // Drawdown
  if (drawdownHit) {
    const lead = engineHit ? tradingDaysBetween(results, engineHit.date, drawdownHit.date) : null;
    const leadStr = lead !== null ? (lead > 0 ? `engine leads by ${lead} days` : lead < 0 ? `engine lags by ${Math.abs(lead)} days` : `same day`) : "N/A";
    console.log(`  Drawdown > 10% first:    ${drawdownHit.date} (dd=${drawdownHit.drawdown.toFixed(2)}%) — ${leadStr}`);
  } else {
    console.log(`  Drawdown > 10% first:    NONE detected after ${event.crisisOnset}`);
  }

  // --- Compute leads for summary ---
  const leadVsRsi = (engineHit && rsiHit) ? tradingDaysBetween(results, engineHit.date, rsiHit.date) : null;
  const leadVsSma = (engineHit && smaHit) ? tradingDaysBetween(results, engineHit.date, smaHit.date) : null;
  const leadVsDd  = (engineHit && drawdownHit) ? tradingDaysBetween(results, engineHit.date, drawdownHit.date) : null;

  // Average of traditional signals that fired
  const tradLeads = [leadVsRsi, leadVsSma, leadVsDd].filter(v => v !== null);
  const avgTraditional = tradLeads.length > 0 ? tradLeads.reduce((a, b) => a + b, 0) / tradLeads.length : null;

  summaryRows.push({
    event: event.name,
    engineDate: engineHit?.date || "N/A",
    engineRegime: engineHit?.regime || "N/A",
    leadVsRsi,
    leadVsSma,
    leadVsDd,
    avgTraditional,
  });

  // Per-event check: engine detects at least as early as AVERAGE of traditional signals
  if (avgTraditional !== null) {
    const passCondition = avgTraditional >= 0;
    if (passCondition) {
      console.log(`  CHECK: Engine at least as early as avg traditional (+${avgTraditional.toFixed(1)} days) — PASS`);
      totalPassed++;
    } else {
      console.log(`  CHECK: Engine later than avg traditional (${avgTraditional.toFixed(1)} days) — FAIL`);
      totalFailed++;
    }
  } else {
    console.log(`  CHECK: Insufficient data to compare (engine or all traditional signals missing)`);
    // Count as fail if engine didn't fire
    if (!engineHit) {
      totalFailed++;
    } else {
      // Engine fired but no traditional signals fired — engine is more sensitive, pass
      console.log(`  NOTE: Engine detected regime change but no traditional signal fired — engine is more sensitive`);
      totalPassed++;
    }
  }
}

// ================================================================
// SUMMARY TABLE
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("BENCHMARK SUMMARY — Engine Lead Time (trading days, positive = engine first)");
console.log("=".repeat(80));

function fmtLead(v) {
  if (v === null) return "  N/A ";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v}`.padStart(6);
}

console.log("  Event              | vs RSI<30 | vs SMA50 | vs DD>10% | vs Avg Trad");
console.log("  " + "-".repeat(73));

for (const row of summaryRows) {
  const shortName = row.event.padEnd(20);
  const rsiStr = fmtLead(row.leadVsRsi);
  const smaStr = fmtLead(row.leadVsSma);
  const ddStr = fmtLead(row.leadVsDd);
  const avgStr = row.avgTraditional !== null ? fmtLead(Math.round(row.avgTraditional)) : "  N/A ";
  console.log(`  ${shortName} | ${rsiStr}    | ${smaStr}   | ${ddStr}    | ${avgStr}`);
}

// Compute column averages across events that have data
function colAvg(key) {
  const vals = summaryRows.map(r => r[key]).filter(v => v !== null);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

const avgRsi = colAvg("leadVsRsi");
const avgSma = colAvg("leadVsSma");
const avgDd = colAvg("leadVsDd");
const avgAll = colAvg("avgTraditional");

console.log("  " + "-".repeat(73));
console.log(`  ${"AVG LEAD".padEnd(20)} | ${fmtLead(avgRsi !== null ? Math.round(avgRsi) : null)}    | ${fmtLead(avgSma !== null ? Math.round(avgSma) : null)}   | ${fmtLead(avgDd !== null ? Math.round(avgDd) : null)}    | ${fmtLead(avgAll !== null ? Math.round(avgAll) : null)}`);

// ================================================================
// INTERPRETATION
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("INTERPRETATION");
console.log("=".repeat(80));

console.log(`\n  Traditional quant signals are SINGLE-VARIABLE indicators:`);
console.log(`    - RSI measures momentum alone`);
console.log(`    - SMA50 distance measures trend position alone`);
console.log(`    - Drawdown measures price displacement alone`);
console.log();
console.log(`  The engine combines 12 signals across 4 categories (condition, flow, price, capacity)`);
console.log(`  into a TOPOLOGICAL regime classification. Its advantage is CROSS-SIGNAL COHERENCE:`);
console.log(`  when multiple indicators simultaneously deviate from their rolling baselines,`);
console.log(`  the engine registers a regime change even if no single indicator has crossed`);
console.log(`  a traditional threshold.`);
console.log();

if (avgAll !== null) {
  if (avgAll > 0) {
    console.log(`  RESULT: Engine leads traditional signals by an average of ${Math.abs(avgAll).toFixed(1)} trading days.`);
    console.log(`  The multi-signal topology detects regime shifts BEFORE individual indicators fire.`);
  } else if (avgAll < 0) {
    console.log(`  RESULT: Engine lags traditional signals by an average of ${Math.abs(avgAll).toFixed(1)} trading days.`);
    console.log(`  Single-variable indicators fire earlier, but lack cross-signal confirmation.`);
  } else {
    console.log(`  RESULT: Engine and traditional signals detect regime shifts at the same time on average.`);
  }
}

// ================================================================
// COMPOSITE VALIDATION
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("LAYER C BENCHMARK — COMPOSITE");
console.log("=".repeat(80));

const eventsWhereEngineLeads = summaryRows.filter(r => r.avgTraditional !== null && r.avgTraditional >= 0).length;
const eventsWithData = summaryRows.filter(r => r.avgTraditional !== null).length;

console.log(`  Events where engine >= avg traditional: ${eventsWhereEngineLeads} / ${eventsWithData}`);
console.log(`  Pass condition: engine at least as early as avg traditional in >= 2 of 4 events`);

const total = totalPassed + totalFailed;
const pct = total > 0 ? (totalPassed / total * 100).toFixed(1) : "0.0";
console.log(`  ${totalPassed} passed, ${totalFailed} failed — Composite: ${pct}%`);

if (eventsWhereEngineLeads >= 2) {
  console.log(`\n  BENCHMARK PASSED: Engine detects regime changes at least as early as`);
  console.log(`  the average of traditional quant signals in ${eventsWhereEngineLeads}/${eventsWithData} events.`);
} else {
  console.log(`\n  BENCHMARK RESULT: Engine leads in only ${eventsWhereEngineLeads}/${eventsWithData} events.`);
  console.log(`  Traditional single-variable indicators may fire earlier for some event types.`);
  console.log(`  This is expected — the engine's value is in CROSS-SIGNAL COHERENCE, not raw speed.`);
}

console.log("=".repeat(80));

if (totalFailed > 0 && eventsWhereEngineLeads < 2) {
  process.exit(1);
}
