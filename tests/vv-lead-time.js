/**
 * V&V Lead Time — Statistical Audit Task 5
 *
 * Tests the claim: the topological engine detects regime shifts EARLIER
 * than traditional single-variable quant signals (RSI<30, below SMA50,
 * drawdown>10%). Original calibration showed +6 to +17 day advantage.
 *
 * Method:
 *   1. Run engine at each bar for all 14 market event CSVs
 *   2. For each event: find first non-STABLE regime date after crisis onset
 *   3. Find first dates where: RSI<30, SMA50 distance<0, drawdown<-10%
 *   4. Compute lead times: traditional date - engine date (positive = engine first)
 *   5. Average across traditional signals per event
 *   6. Bootstrap CI at alpha = 0.001 on the lead-time distribution
 *   7. Verdict: CONFIRMED if CI lower bound > 0,
 *              INCONCLUSIVE if mean > 0 but CI includes 0,
 *              REJECTED if mean <= 0
 *
 * Data sources: 14 real Yahoo Finance OHLCV event CSVs (NVDA excluded — sustained uptrend, not crisis onset)
 *
 * Run: node tests/vv-lead-time.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { bootstrapCI } from "./lib/statistics.js";

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
// EVENT DEFINITIONS — 14 crisis onset events (NVDA excluded)
// ================================================================

const EVENTS = [
  { name: "GFC 2008",         csv: "gfc-2008-spy.csv",         onset: "2008-06-01" },
  { name: "COVID 2020",       csv: "covid-2020-spy.csv",        onset: "2020-01-15" },
  { name: "SVB 2023",         csv: "svb-2023-kre.csv",          onset: "2023-02-01" },
  { name: "GME 2021",         csv: "gme-2021-gme.csv",          onset: "2021-01-01" },
  { name: "Dot-com 2000",     csv: "dotcom-2000-qqq.csv",       onset: "2000-03-01" },
  { name: "Flash Crash 2010", csv: "flash-2010-spy.csv",        onset: "2010-04-15" },
  { name: "EU Debt 2011",     csv: "eudebt-2011-ewg.csv",       onset: "2011-07-01" },
  { name: "Taper 2013",       csv: "taper-2013-tlt.csv",        onset: "2013-05-01" },
  { name: "China 2015",       csv: "china-2015-fxi.csv",        onset: "2015-06-01" },
  { name: "Oil Crash 2014",   csv: "oilcrash-2014-xle.csv",     onset: "2014-06-01" },
  { name: "Volmageddon 2018", csv: "volmageddon-2018-spy.csv",  onset: "2018-01-15" },
  { name: "Yen Carry 2024",   csv: "yencarry-2024-ewj.csv",     onset: "2024-07-01" },
  { name: "Tariff 2025",      csv: "tariff-2025-kweb.csv",      onset: "2025-03-01" },
  { name: "Crypto 2022",      csv: "crypto-2022-coin.csv",      onset: "2022-04-01" },
];

// ================================================================
// CORE: run engine at each bar, return per-bar regime + raw CSV values
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
  const idxA = results.findIndex(r => r.date === dateA);
  const idxB = results.findIndex(r => r.date === dateB);
  if (idxA === -1 || idxB === -1) return null;
  return idxB - idxA;
}

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V LEAD TIME — Statistical Audit Task 5");
console.log("Claim: engine detects regime shifts earlier than traditional quant signals");
console.log("Traditional: RSI<30, below SMA50, drawdown>10%");
console.log("Alpha = 0.001 (99.9% confidence)");
console.log("=".repeat(80));

// ----------------------------------------------------------------
// STEP 1: Process all 14 events, compute lead times
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 1: Per-event engine vs traditional detection timing");
console.log("-".repeat(80));

const leadTimes = [];       // per-event average lead (trading days)
const eventSummaries = [];  // for display

for (const event of EVENTS) {
  const csvPath = path.join(DATA_DIR, event.csv);
  const results = analyzeForBenchmark(csvPath);

  console.log(`\n  ${event.name} (${results.length} bars, onset: ${event.onset})`);

  // --- Engine detection: first non-STABLE after onset + 60 bar warmup ---
  const engineHit = firstDateWhere(
    results,
    r => r.regime !== "STABLE",
    event.onset,
    60,
  );

  // --- RSI < 30: after onset + 14 bar warmup ---
  const rsiHit = firstDateWhere(
    results,
    r => r.rsi > 0 && r.rsi < 30,
    event.onset,
    14,
  );

  // --- SMA50 dist < 0: after onset + 50 bar warmup ---
  const smaHit = firstDateWhere(
    results,
    r => r.sma50_dist !== 0 && r.sma50_dist < 0,
    event.onset,
    50,
  );

  // --- Drawdown > 10%: after onset, no warmup ---
  const drawdownHit = firstDateWhere(
    results,
    r => r.drawdown < -10,
    event.onset,
    0,
  );

  // Print detection dates
  if (engineHit) {
    console.log(`    Engine first non-STABLE: ${engineHit.date} (${engineHit.regime})`);
  } else {
    console.log(`    Engine first non-STABLE: NONE — skipping event`);
  }

  // Compute lead times vs each traditional signal
  const leadVsRsi = (engineHit && rsiHit) ? tradingDaysBetween(results, engineHit.date, rsiHit.date) : null;
  const leadVsSma = (engineHit && smaHit) ? tradingDaysBetween(results, engineHit.date, smaHit.date) : null;
  const leadVsDd  = (engineHit && drawdownHit) ? tradingDaysBetween(results, engineHit.date, drawdownHit.date) : null;

  if (rsiHit) {
    const leadStr = leadVsRsi !== null ? `${leadVsRsi >= 0 ? "+" : ""}${leadVsRsi} days` : "N/A";
    console.log(`    RSI<30:                 ${rsiHit.date} (RSI=${rsiHit.rsi.toFixed(1)}) — ${leadStr}`);
  } else {
    console.log(`    RSI<30:                 NONE`);
  }

  if (smaHit) {
    const leadStr = leadVsSma !== null ? `${leadVsSma >= 0 ? "+" : ""}${leadVsSma} days` : "N/A";
    console.log(`    Below SMA50:            ${smaHit.date} (dist=${smaHit.sma50_dist.toFixed(2)}%) — ${leadStr}`);
  } else {
    console.log(`    Below SMA50:            NONE`);
  }

  if (drawdownHit) {
    const leadStr = leadVsDd !== null ? `${leadVsDd >= 0 ? "+" : ""}${leadVsDd} days` : "N/A";
    console.log(`    Drawdown>10%:           ${drawdownHit.date} (dd=${drawdownHit.drawdown.toFixed(2)}%) — ${leadStr}`);
  } else {
    console.log(`    Drawdown>10%:           NONE`);
  }

  // Skip events where engine never left STABLE
  if (!engineHit) {
    eventSummaries.push({ event: event.name, engineDate: "N/A", avgLead: null, skipped: true, reason: "engine stayed STABLE" });
    continue;
  }

  // Average lead across traditional signals that fired (exclude nulls)
  const tradLeads = [leadVsRsi, leadVsSma, leadVsDd].filter(v => v !== null);

  if (tradLeads.length === 0) {
    // Engine fired but no traditional signals fired — cannot compute lead
    eventSummaries.push({ event: event.name, engineDate: engineHit.date, avgLead: null, skipped: true, reason: "no traditional signals fired" });
    console.log(`    Avg lead: N/A — no traditional signals fired`);
    continue;
  }

  const avgLead = tradLeads.reduce((a, b) => a + b, 0) / tradLeads.length;
  leadTimes.push(avgLead);
  eventSummaries.push({ event: event.name, engineDate: engineHit.date, avgLead, skipped: false, leadVsRsi, leadVsSma, leadVsDd });
  console.log(`    Avg lead vs traditional: ${avgLead >= 0 ? "+" : ""}${avgLead.toFixed(1)} trading days`);
}

// ----------------------------------------------------------------
// STEP 2: Summary table
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 2: Lead time summary");
console.log("-".repeat(80));

function fmtLead(v) {
  if (v === null || v === undefined) return "  N/A ";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v}`.padStart(6);
}

console.log("  Event                  | vs RSI<30 | vs SMA50 | vs DD>10% | Avg Lead");
console.log("  " + "-".repeat(73));

for (const row of eventSummaries) {
  const shortName = row.event.padEnd(24);
  if (row.skipped) {
    console.log(`  ${shortName} |   --      |   --     |   --      | SKIP (${row.reason})`);
  } else {
    const rsiStr = fmtLead(row.leadVsRsi);
    const smaStr = fmtLead(row.leadVsSma);
    const ddStr = fmtLead(row.leadVsDd);
    const avgStr = fmtLead(row.avgLead !== null ? Math.round(row.avgLead) : null);
    console.log(`  ${shortName} | ${rsiStr}    | ${smaStr}   | ${ddStr}    | ${avgStr}`);
  }
}

// ----------------------------------------------------------------
// STEP 3: Bootstrap CI on lead-time distribution
// ----------------------------------------------------------------

console.log("\n" + "-".repeat(80));
console.log("STEP 3: Bootstrap CI on lead-time distribution");
console.log("-".repeat(80));

const ALPHA = 0.001;
const n = leadTimes.length;
const sampleMean = n > 0 ? leadTimes.reduce((a, b) => a + b, 0) / n : 0;

console.log(`\n  Events with usable lead times: ${n}`);
console.log(`  Lead times: [${leadTimes.map(v => v.toFixed(1)).join(", ")}]`);
console.log(`  Sample mean: ${sampleMean.toFixed(2)} trading days`);

if (n < 3) {
  console.log(`\n  INSUFFICIENT DATA: need >= 3 lead-time values for meaningful bootstrap CI.`);
  console.log(`  Only ${n} events contributed lead times.`);

  console.log("\n" + "=".repeat(80));
  console.log("V&V LEAD TIME — COMPOSITE VERDICT");
  console.log("=".repeat(80));
  console.log(`\n  VERDICT: INCONCLUSIVE — insufficient data (n=${n})`);
  console.log("\n" + "=".repeat(80));
} else {
  const meanFn = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ci = bootstrapCI(leadTimes, meanFn, ALPHA, 10000);

  console.log(`\n  Bootstrap (B=10000, alpha=${ALPHA}):`);
  console.log(`    99.9% CI for mean lead time = [${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}] trading days`);
  console.log(`    Sample mean                 = ${sampleMean.toFixed(2)} trading days`);

  // ----------------------------------------------------------------
  // STEP 4: Composite verdict
  // ----------------------------------------------------------------

  console.log("\n" + "=".repeat(80));
  console.log("V&V LEAD TIME — COMPOSITE VERDICT");
  console.log("=".repeat(80));

  let verdict;
  if (ci.lo > 0) {
    verdict = "CONFIRMED";
  } else if (sampleMean > 0 && ci.lo <= 0) {
    verdict = "INCONCLUSIVE";
  } else {
    verdict = "REJECTED";
  }

  console.log(`\n  Events analyzed:     ${EVENTS.length}`);
  console.log(`  Events with data:    ${n}`);
  console.log(`  Events skipped:      ${EVENTS.length - n}`);
  console.log(`  Sample mean lead:    ${sampleMean >= 0 ? "+" : ""}${sampleMean.toFixed(2)} trading days`);
  console.log(`  99.9% CI:            [${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}]`);
  console.log(`  CI lower bound > 0:  ${ci.lo > 0 ? "YES" : "NO"}`);
  console.log(`\n  VERDICT: ${verdict} at alpha = ${ALPHA}`);

  if (verdict === "CONFIRMED") {
    console.log("  The engine's lead-time advantage over traditional quant signals is");
    console.log("  statistically significant at the 99.9% confidence level.");
    console.log("  Multi-signal topology detects regime shifts before individual indicators fire.");
  } else if (verdict === "INCONCLUSIVE") {
    console.log("  The engine shows a positive mean lead time, but the 99.9% CI includes zero.");
    console.log("  The advantage is observed but not statistically confirmed at this alpha.");
    console.log("  Additional events or a less stringent alpha may clarify.");
  } else {
    console.log("  No evidence that the engine detects regime shifts earlier than");
    console.log("  traditional single-variable quant signals at this alpha.");
    console.log("  The claim does not survive rigorous V&V.");
  }

  console.log("\n" + "=".repeat(80));
}
