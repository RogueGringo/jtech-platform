/**
 * Recalibration Grid Search — 16 combos × 3-check gauntlet
 *
 * Sweeps baseline window × σ threshold sets to find the tightest
 * calibration that passes all three V&V checks:
 *   N1: Calendar (SPY 2017 STABLE ≥ 90%)
 *   TP: True Positive (GFC Sep-Nov 2008 detects crisis)
 *   N3: Permutation (shuffled GFC mean |r| < 0.1)
 *
 * Uses real market data only. No synthetic data.
 *
 * Data sources:
 *   - tests/data/market/calm-2017-spy.csv  (Yahoo Finance, 251 trading days)
 *   - tests/data/market/gfc-2008-spy.csv   (Yahoo Finance, 503 trading days)
 */

import {
  readCSV,
  computeGini,
  computeMeanSeverity,
  classifyRegime,
  pearsonR,
} from "./lib/backtest-engine.js";

import { computeTechnicals } from "../src/adapters/market-adapter.js";

// ================================================================
// CSV COLUMN → ADAPTER TECH KEY MAPPING
// ================================================================

const CSV_TO_TECH = {
  rsi:          "rsi",
  macd_hist:    "macd_hist",
  bband_pctb:   "bbpctb",
  bband_width:  "bbwidth",
  volume_ratio: "volratio",
  sma50_dist:   "sma50dist",
  sma200_dist:  "sma200dist",
  atr_pctile:   "atrPctile",
  drawdown:     "drawdown",
  adx:          "adx",
  mfi:          "mfi",
  obv_slope:    "obvslope",
};

// ================================================================
// SIGNAL DEFINITIONS — mirrors src/adapters/market-adapter.js
// ================================================================

const SIGNAL_DEFS = [
  { id: "mkt_rsi",      category: "condition", tech: "rsi",       transform: v => (v - 50) / 50 },
  { id: "mkt_macd",     category: "condition", tech: "macd_hist", transform: v => v },
  { id: "mkt_bbpctb",   category: "condition", tech: "bbpctb",    transform: v => (v - 0.5) / 0.5 },
  { id: "mkt_volratio", category: "flow",      tech: "volratio",  transform: v => v - 1 },
  { id: "mkt_obvslope", category: "flow",      tech: "obvslope",  transform: v => v },
  { id: "mkt_mfi",      category: "flow",      tech: "mfi",       transform: v => (v - 50) / 50 },
  { id: "mkt_sma50",    category: "price",     tech: "sma50dist", transform: v => v },
  { id: "mkt_sma200",   category: "price",     tech: "sma200dist",transform: v => v },
  { id: "mkt_drawdown", category: "price",     tech: "drawdown",  transform: v => v },
  { id: "mkt_atr",      category: "capacity",  tech: "atrPctile", transform: v => (v - 0.5) / 0.5 },
  { id: "mkt_bbwidth",  category: "capacity",  tech: "bbwidth",   transform: v => v },
  { id: "mkt_adx",      category: "capacity",  tech: "adx",       transform: v => (v - 25) / 25 },
];

// ================================================================
// SEARCH SPACE
// ================================================================

const BASELINES = [90, 120, 180, 252];

// Each set: [watch_floor, moderate, high, critical]
// σ < set[0] → watch, ≥ set[1] → moderate, ≥ set[2] → high, ≥ set[3] → critical
const THRESHOLD_SETS = [
  { label: "Set1 [0.0/1.0/1.5/2.0]", thresholds: [0.0, 1.0, 1.5, 2.0] },
  { label: "Set2 [1.0/1.5/2.0/2.5]", thresholds: [1.0, 1.5, 2.0, 2.5] },
  { label: "Set3 [1.5/2.0/2.5/3.0]", thresholds: [1.5, 2.0, 2.5, 3.0] },
  { label: "Set4 [1.0/2.0/3.0/4.0]", thresholds: [1.0, 2.0, 3.0, 4.0] },
];

// ================================================================
// HELPERS
// ================================================================

/** Map |σ| to severity using threshold array [watch_floor, moderate, high, critical] */
function sigmaToSeverityDynamic(sigma, thresholds) {
  const abs = Math.abs(sigma);
  if (abs >= thresholds[3]) return "critical";
  if (abs >= thresholds[2]) return "high";
  if (abs >= thresholds[1]) return "moderate";
  return "watch";
}

/** Rolling mean over window ending at index i. */
function rollingMean(arr, window, i) {
  const start = Math.max(0, i - window + 1);
  const slice = arr.slice(start, i + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Rolling std over window ending at index i (population std). */
function rollingStd(arr, window, i) {
  const start = Math.max(0, i - window + 1);
  const slice = arr.slice(start, i + 1);
  const mu = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((s, v) => s + (v - mu) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}

/**
 * Convert CSV rows into tech arrays keyed by adapter tech name.
 * CSV columns use different names than the adapter's internal keys.
 */
function csvRowsToTechArrays(rows) {
  const techs = {};
  for (const [csvCol, techKey] of Object.entries(CSV_TO_TECH)) {
    techs[techKey] = rows.map(r => r[csvCol] ?? 0);
  }
  return techs;
}

/**
 * Run the dynamic adapter on a set of tech arrays for a given bar index.
 * Returns signals[] with severity set by the given baseline window and thresholds.
 */
function signalsAtBar(techs, barIdx, baseline, thresholds) {
  const signals = [];
  for (const def of SIGNAL_DEFS) {
    const series = techs[def.tech];
    if (!series || series.length === 0) continue;

    // Transform entire series for σ calculation
    const transformed = series.map(v => def.transform(v));
    const currentVal = transformed[barIdx];

    const mu = rollingMean(transformed, baseline, barIdx);
    const std = rollingStd(transformed, baseline, barIdx);
    const sigma = std > 0 ? (currentVal - mu) / std : 0;
    const severity = sigmaToSeverityDynamic(sigma, thresholds);

    signals.push({ id: def.id, category: def.category, severity });
  }
  return signals;
}

/**
 * Analyze every bar in a CSV dataset with given parameters.
 * Returns per-bar { date, mean, gini, regime } arrays.
 */
function analyzeCSV(rows, techs, baseline, thresholds) {
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const signals = signalsAtBar(techs, i, baseline, thresholds);
    const mean = computeMeanSeverity(signals);
    const gini = computeGini(signals);
    const regime = classifyRegime(mean, gini);
    results.push({ date: rows[i].date, mean, gini, regime: regime.label });
  }
  return results;
}

/** Fisher-Yates in-place shuffle. Returns mutated array. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ================================================================
// GAUNTLET CHECKS
// ================================================================

/**
 * Check 1: N1 Calendar — SPY 2017 should be STABLE ≥ 90% of bars.
 */
function checkN1(calmRows, calmTechs, baseline, thresholds) {
  const results = analyzeCSV(calmRows, calmTechs, baseline, thresholds);
  const stableCount = results.filter(r => r.regime === "STABLE").length;
  const stableRate = stableCount / results.length;
  return { pass: stableRate >= 0.90, stableRate, stableCount, totalBars: results.length };
}

/**
 * Check 2: True Positive — GFC Sep-Nov 2008 must detect crisis.
 * At least 1 bar with regime !== "STABLE" AND !== "TRANSIENT SPIKE"
 * (i.e., CRISIS CONSOLIDATION or BOUNDARY LAYER).
 */
function checkTP(gfcRows, gfcTechs, baseline, thresholds) {
  const results = analyzeCSV(gfcRows, gfcTechs, baseline, thresholds);
  const lehmanBars = results.filter(r => r.date >= "2008-09-01" && r.date <= "2008-11-30");
  const crisisBars = lehmanBars.filter(
    r => r.regime !== "STABLE" && r.regime !== "TRANSIENT SPIKE"
  );
  return { pass: crisisBars.length > 0, crisisCount: crisisBars.length, lehmanTotal: lehmanBars.length };
}

/**
 * Check 3: N3 Permutation — shuffled GFC data should destroy mean-Gini correlation.
 * 50 permutations, mean of permuted |r| < 0.1.
 * Only runs if N1 and TP passed.
 */
function checkN3(gfcRows, baseline, thresholds, nPerms = 50) {
  const absCorrs = [];

  for (let p = 0; p < nPerms; p++) {
    // Shuffle a copy of the rows to build new OHLCV
    const shuffled = shuffle([...gfcRows]);

    // Build OHLCV from shuffled rows for computeTechnicals
    const ohlcv = shuffled.map(r => ({
      open: r.Open,
      high: r.High,
      low: r.Low,
      close: r.Close,
      volume: r.Volume,
    }));

    // Compute technicals on shuffled OHLCV
    const techs = computeTechnicals(ohlcv);

    // Build tech arrays from computed technicals (already in adapter key names)
    const means = [];
    const ginis = [];
    for (let i = 0; i < ohlcv.length; i++) {
      const signals = signalsAtBarFromTechs(techs, i, baseline, thresholds);
      means.push(computeMeanSeverity(signals));
      ginis.push(computeGini(signals));
    }

    // Only compute correlation if we have variance
    if (means.length > 2) {
      const r = pearsonR(means, ginis);
      absCorrs.push(Math.abs(r));
    }
  }

  const meanAbsR = absCorrs.length > 0
    ? absCorrs.reduce((a, b) => a + b, 0) / absCorrs.length
    : 0;

  return { pass: meanAbsR < 0.1, meanAbsR, nPerms: absCorrs.length };
}

/**
 * Helper: build signals from computeTechnicals output (already in adapter key names).
 * This is for N3 where we run computeTechnicals on shuffled OHLCV.
 */
function signalsAtBarFromTechs(techs, barIdx, baseline, thresholds) {
  const signals = [];
  for (const def of SIGNAL_DEFS) {
    const series = techs[def.tech];
    if (!series || series.length === 0) continue;

    const transformed = series.map(v => def.transform(v));
    const currentVal = transformed[barIdx];

    const mu = rollingMean(transformed, baseline, barIdx);
    const std = rollingStd(transformed, baseline, barIdx);
    const sigma = std > 0 ? (currentVal - mu) / std : 0;
    const severity = sigmaToSeverityDynamic(sigma, thresholds);

    signals.push({ id: def.id, category: def.category, severity });
  }
  return signals;
}

// ================================================================
// MAIN
// ================================================================

console.log("=" .repeat(80));
console.log("RECALIBRATION GRID SEARCH");
console.log("16 combinations × 3-check gauntlet");
console.log("Data: SPY 2017 (calm), SPY 2007-2009 (GFC)");
console.log("=" .repeat(80));

// Load data
const calmRows = readCSV(new URL("./data/market/calm-2017-spy.csv", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const gfcRows  = readCSV(new URL("./data/market/gfc-2008-spy.csv", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));

console.log(`\nCalm 2017 SPY: ${calmRows.length} bars (${calmRows[0]?.date} → ${calmRows[calmRows.length-1]?.date})`);
console.log(`GFC 2008 SPY:  ${gfcRows.length} bars (${gfcRows[0]?.date} → ${gfcRows[gfcRows.length-1]?.date})`);

// Pre-build tech arrays for calm and GFC CSVs (from CSV column data)
const calmTechs = csvRowsToTechArrays(calmRows);
const gfcTechs  = csvRowsToTechArrays(gfcRows);

// ================================================================
// RUN GRID
// ================================================================

const results = [];

for (const baseline of BASELINES) {
  for (const tset of THRESHOLD_SETS) {
    const combo = { baseline, thresholdLabel: tset.label, thresholds: tset.thresholds };
    const label = `BL=${baseline} | ${tset.label}`;

    process.stdout.write(`\n${label} ... `);

    // Check 1: N1 Calendar
    const n1 = checkN1(calmRows, calmTechs, baseline, tset.thresholds);
    if (!n1.pass) {
      console.log(`N1 FAIL (stable=${(n1.stableRate * 100).toFixed(1)}%)`);
      results.push({ ...combo, score: 0, n1, tp: null, n3: null });
      continue;
    }
    process.stdout.write(`N1 PASS (${(n1.stableRate * 100).toFixed(1)}%) → `);

    // Check 2: True Positive
    const tp = checkTP(gfcRows, gfcTechs, baseline, tset.thresholds);
    if (!tp.pass) {
      console.log(`TP FAIL (crisis bars=0/${tp.lehmanTotal})`);
      results.push({ ...combo, score: 1, n1, tp, n3: null });
      continue;
    }
    process.stdout.write(`TP PASS (${tp.crisisCount}/${tp.lehmanTotal} crisis) → `);

    // Check 3: N3 Permutation (only if N1 + TP passed)
    const n3 = checkN3(gfcRows, baseline, tset.thresholds, 50);
    if (!n3.pass) {
      console.log(`N3 FAIL (mean|r|=${n3.meanAbsR.toFixed(4)})`);
      results.push({ ...combo, score: 2, n1, tp, n3 });
      continue;
    }
    console.log(`N3 PASS (mean|r|=${n3.meanAbsR.toFixed(4)}) ★ WINNER`);
    results.push({ ...combo, score: 3, n1, tp, n3 });
  }
}

// ================================================================
// RESULTS TABLE
// ================================================================

// Sort: score desc → baseline asc → tighter thresholds first
results.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.baseline !== b.baseline) return a.baseline - b.baseline;
  // Tighter thresholds = lower sum of threshold values
  const sumA = a.thresholds.reduce((x, y) => x + y, 0);
  const sumB = b.thresholds.reduce((x, y) => x + y, 0);
  return sumA - sumB;
});

console.log("\n\n" + "=".repeat(100));
console.log("RESULTS TABLE — sorted by score (desc), baseline (asc), tightness (asc)");
console.log("=".repeat(100));
console.log(
  "Score".padEnd(7) +
  "Baseline".padEnd(10) +
  "Thresholds".padEnd(30) +
  "N1 Stable%".padEnd(13) +
  "TP Crisis".padEnd(12) +
  "N3 mean|r|".padEnd(13) +
  "Status"
);
console.log("-".repeat(100));

let winnersFound = 0;

for (const r of results) {
  const isWinner = r.score === 3;
  if (isWinner) winnersFound++;

  const n1Str = r.n1 ? `${(r.n1.stableRate * 100).toFixed(1)}%` : "—";
  const tpStr = r.tp ? `${r.tp.crisisCount}/${r.tp.lehmanTotal}` : "—";
  const n3Str = r.n3 ? r.n3.meanAbsR.toFixed(4) : "—";
  const status = isWinner ? "★ WINNER" : (r.score === 2 ? "▲ CLOSE" : r.score === 1 ? "● PARTIAL" : "✗ FAIL");

  console.log(
    `${r.score}/3`.padEnd(7) +
    `${r.baseline}`.padEnd(10) +
    r.thresholdLabel.padEnd(30) +
    n1Str.padEnd(13) +
    tpStr.padEnd(12) +
    n3Str.padEnd(13) +
    status
  );
}

console.log("-".repeat(100));

// ================================================================
// SUMMARY
// ================================================================

console.log(`\n${"=".repeat(80)}`);
if (winnersFound > 0) {
  const winners = results.filter(r => r.score === 3);
  console.log(`★ ${winnersFound} WINNER(S) FOUND — all 3 checks passed:`);
  for (const w of winners) {
    console.log(`  Baseline: ${w.baseline} bars`);
    console.log(`  Thresholds: ${w.thresholdLabel}`);
    console.log(`  N1 Stable: ${(w.n1.stableRate * 100).toFixed(1)}%`);
    console.log(`  TP Crisis: ${w.tp.crisisCount}/${w.tp.lehmanTotal} bars`);
    console.log(`  N3 Mean|r|: ${w.n3.meanAbsR.toFixed(4)}`);
    console.log();
  }
  console.log("RECOMMENDATION: Use the first winner (shortest baseline, tightest thresholds).");
  const pick = winners[0];
  console.log(`  → baseline = ${pick.baseline}`);
  console.log(`  → thresholds = [${pick.thresholds.join(", ")}]`);
} else {
  console.log("✗ NO COMBINATION PASSED ALL 3 CHECKS");
  const closest = results.filter(r => r.score === 2);
  if (closest.length > 0) {
    console.log(`\nClosest (2/3 — N3 failed):`);
    for (const c of closest) {
      console.log(`  BL=${c.baseline} | ${c.thresholdLabel} → N3 mean|r|=${c.n3?.meanAbsR.toFixed(4)}`);
    }
  }
  const partial = results.filter(r => r.score === 1);
  if (partial.length > 0) {
    console.log(`\nPartial (1/3 — TP failed):`);
    for (const p of partial) {
      console.log(`  BL=${p.baseline} | ${p.thresholdLabel}`);
    }
  }
}
console.log("=".repeat(80));
