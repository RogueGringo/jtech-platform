/**
 * Shared Backtest Engine — extracted from backtest-real-data.js
 * Provides math framework + CSV reader + signal builder + backtest runner.
 * Domain backtests import from here instead of duplicating.
 */

import fs from "fs";
import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../../src/engine/projection.js";

export const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

// ================================================================
// MATHEMATICAL FRAMEWORK
// ================================================================

export function computeSeverity(id, numeric, thresholds) {
  const levels = thresholds[id];
  if (!levels || numeric === null || numeric === undefined) return "watch";
  for (const [level, threshold] of levels) {
    if (numeric >= threshold) return level;
  }
  return "watch";
}

export function computeGini(signals) {
  const ranks = signals.map(s => SEVERITY_RANK[s.severity] || 1);
  const n = ranks.length;
  if (n === 0) return 0;
  const mean = ranks.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sumAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbsDiff += Math.abs(ranks[i] - ranks[j]);
    }
  }
  return sumAbsDiff / (2 * n * n * mean);
}

export function computeMeanSeverity(signals) {
  if (signals.length === 0) return 1;
  const ranks = signals.map(s => SEVERITY_RANK[s.severity] || 1);
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

export function computeCrossCoherence(signals, categoryKeys) {
  if (!categoryKeys || categoryKeys.length === 0) return 100;
  const catMeans = [];
  for (const cat of categoryKeys) {
    const catSignals = signals.filter(s => s.category === cat);
    if (catSignals.length === 0) continue;
    const ranks = catSignals.map(s => SEVERITY_RANK[s.severity] || 1);
    catMeans.push(ranks.reduce((a, b) => a + b, 0) / ranks.length);
  }
  if (catMeans.length <= 1) return 100;
  const mu = catMeans.reduce((a, b) => a + b, 0) / catMeans.length;
  if (mu === 0) return 100;
  const variance = catMeans.reduce((acc, v) => acc + (v - mu) ** 2, 0) / catMeans.length;
  const sigma = Math.sqrt(variance);
  const cv = sigma / mu;
  return Math.round((1 - Math.min(cv, 1)) * 100);
}

export function classifyRegime(meanSeverity, gini) {
  const highMean = meanSeverity >= 2.5;
  const highGini = gini >= 0.2;
  if (!highMean && !highGini) return { label: "STABLE", quadrant: "low-low" };
  if (!highMean && highGini)  return { label: "TRANSIENT SPIKE", quadrant: "low-high" };
  if (highMean && !highGini)  return { label: "CRISIS CONSOLIDATION", quadrant: "high-low" };
  return { label: "BOUNDARY LAYER", quadrant: "high-high" };
}

// ================================================================
// TEMPORAL: Ring buffer + Gini trajectory
// ================================================================

const MAX_SNAPSHOTS = 30;

export function createBuffer() { return { snapshots: [], cursor: 0 }; }

export function pushBuffer(buffer, signals) {
  const ranks = {};
  for (const s of signals) ranks[s.id] = SEVERITY_RANK[s.severity] || 1;
  if (buffer.snapshots.length < MAX_SNAPSHOTS) {
    buffer.snapshots.push({ ranks });
  } else {
    buffer.snapshots[buffer.cursor] = { ranks };
  }
  buffer.cursor = (buffer.cursor + 1) % MAX_SNAPSHOTS;
}

export function getOrdered(buffer) {
  const len = buffer.snapshots.length;
  if (len < MAX_SNAPSHOTS) return buffer.snapshots;
  return [...buffer.snapshots.slice(buffer.cursor), ...buffer.snapshots.slice(0, buffer.cursor)];
}

export function giniFromRanks(ranks) {
  const n = ranks.length;
  if (n === 0) return 0;
  const mean = ranks.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sum += Math.abs(ranks[i] - ranks[j]);
  return sum / (2 * n * n * mean);
}

export function giniTrajectory(buffer) {
  const ordered = getOrdered(buffer);
  if (ordered.length < 3) return { slope: 0, direction: "---" };
  const recent = ordered.slice(-3).map(s => giniFromRanks(Object.values(s.ranks)));
  const slope = (recent[2] - recent[0]) / 2;
  const dir = slope > 0.005 ? "dispersing" : slope < -0.005 ? "concentrating" : "stable";
  return { slope, direction: dir };
}

// ================================================================
// TEMPORAL: Transition intensity
// ================================================================

export function transitionIntensity(signals, baselineSignals) {
  const baseRanks = {};
  for (const s of baselineSignals) baseRanks[s.id] = SEVERITY_RANK[s.severity] || 1;
  const deltas = signals.map(s => {
    const current = SEVERITY_RANK[s.severity] || 1;
    const base = baseRanks[s.id] || 1;
    return current - base;
  });
  const magnitude = Math.sqrt(deltas.reduce((sum, d) => sum + d * d, 0));
  const nonZero = deltas.filter(d => d !== 0);
  if (nonZero.length === 0) return { magnitude: 0, alignment: 0, normalized: 0, label: "STABLE" };
  const pos = nonZero.filter(d => d > 0).length;
  const neg = nonZero.length - pos;
  const alignment = Math.max(pos, neg) / nonZero.length;
  const maxMag = Math.sqrt(signals.length * 9);
  const normalized = maxMag > 0 ? magnitude / maxMag : 0;
  let label;
  if (normalized < 0.2) label = "STABLE";
  else if (alignment >= 0.7) label = "PHASE TRANSITION";
  else label = "TURBULENCE";
  return { magnitude, alignment, normalized, label };
}

// ================================================================
// STATISTICS
// ================================================================

export function rollingAvg(values, window) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function kendallTau(values) {
  let concordant = 0, discordant = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[j] > values[i]) concordant++;
      else if (values[j] < values[i]) discordant++;
    }
  }
  const total = concordant + discordant;
  return total > 0 ? (concordant - discordant) / total : 0;
}

export function pearsonR(xs, ys) {
  const n = xs.length;
  const muX = xs.reduce((a, b) => a + b, 0) / n;
  const muY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - muX) * (ys[i] - muY);
    denX += (xs[i] - muX) ** 2;
    denY += (ys[i] - muY) ** 2;
  }
  return denX > 0 && denY > 0 ? num / (Math.sqrt(denX) * Math.sqrt(denY)) : 0;
}

// ================================================================
// CSV READER
// ================================================================

export function readCSV(filepath) {
  const raw = fs.readFileSync(filepath, "utf-8");
  const lines = raw.trim().split("\n");
  const header = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const row = {};
    header.forEach((col, i) => {
      const v = vals[i]?.trim();
      row[col] = col === "date" ? v : (v === "" || v === undefined ? null : parseFloat(v));
    });
    return row;
  });
}

// ================================================================
// SIGNAL BUILDER — generic for any domain
// ================================================================

/**
 * Build signals from a price row + non-price baseline.
 * @param {Object} priceRow - CSV row with numeric columns
 * @param {Object} nonPriceBaseline - { categoryName: severityLevel } for non-price categories
 * @param {Object} thresholds - severity thresholds per price signal ID
 * @param {Array} priceSignalDefs - [{ id, column, category }] defining how CSV columns map to signals
 * @param {Object} nonPriceCounts - { categoryName: signalCount } for non-price categories
 */
export function buildSignals(priceRow, nonPriceBaseline, thresholds, priceSignalDefs, nonPriceCounts) {
  const priceSignals = priceSignalDefs.map(def => ({
    id: def.id,
    category: def.category,
    severity: priceRow[def.column] !== null && priceRow[def.column] !== undefined
      ? computeSeverity(def.id, def.transform ? def.transform(priceRow) : priceRow[def.column], thresholds)
      : "watch",
  }));

  const nonPriceSignals = [];
  for (const [cat, severity] of Object.entries(nonPriceBaseline)) {
    const count = nonPriceCounts[cat] || 3;
    for (let i = 0; i < count; i++) {
      nonPriceSignals.push({ id: `${cat}_${i}`, category: cat, severity });
    }
  }

  return [...priceSignals, ...nonPriceSignals];
}

// ================================================================
// BACKTEST RUNNER — generic
// ================================================================

/**
 * Run a backtest on a CSV dataset.
 * @param {string} name - Event name for display
 * @param {string} csvPath - Path to CSV file
 * @param {Object} baseline - Non-price severity baseline
 * @param {string[]} keyDates - Dates to highlight
 * @param {Object} thresholds - Severity thresholds
 * @param {string[]} categoryKeys - All category names
 * @param {Array} priceSignalDefs - Price signal definitions
 * @param {Object} nonPriceCounts - Signal counts per non-price category
 * @param {Object} options - { filterRow, phaseBaselines }
 */
export function backtestEvent(name, csvPath, baseline, keyDates, thresholds, categoryKeys, priceSignalDefs, nonPriceCounts, options = {}) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`EVENT: ${name}`);
  console.log(`${"=".repeat(80)}`);

  let rows = readCSV(csvPath);
  if (options.filterRow) rows = rows.filter(options.filterRow);
  console.log(`  ${rows.length} trading days loaded\n`);

  const results = [];
  const buffer = createBuffer();
  const coherenceHistory = [];

  // Phase-based baseline support: switch baselines at specific dates
  const getBaseline = (date) => {
    if (options.phaseBaselines) {
      for (const phase of options.phaseBaselines) {
        if (date >= phase.startDate && date <= phase.endDate) return phase.baseline;
      }
    }
    return baseline;
  };

  const firstDayBaseline = getBaseline(rows[0]?.date || "");
  const firstDaySignals = buildSignals(rows[0], firstDayBaseline, thresholds, priceSignalDefs, nonPriceCounts);

  for (const row of rows) {
    const currentBaseline = getBaseline(row.date);
    const signals = buildSignals(row, currentBaseline, thresholds, priceSignalDefs, nonPriceCounts);
    pushBuffer(buffer, signals);

    const gini = computeGini(signals);
    const mean = computeMeanSeverity(signals);
    const coherence = computeCrossCoherence(signals, categoryKeys);
    const regime = classifyRegime(mean, gini);
    const traj = giniTrajectory(buffer);
    const trans = transitionIntensity(signals, firstDaySignals);

    // Projection layer
    coherenceHistory.push(coherence);
    const prop = computePropagationCapacity(signals, categoryKeys);
    const diss = coherenceHistory.length >= 3
      ? computeDissolutionRate(coherenceHistory.slice(-5))
      : 0;
    const trajectory = classifyTrajectory(prop.aggregate, diss);

    const isKey = keyDates.includes(row.date);
    const marker = isKey ? " <<<" : "";

    results.push({
      date: row.date, ...row,
      gini, mean, coherence, regime: regime.label,
      trajSlope: traj.slope, trajDir: traj.direction,
      transNorm: trans.normalized, transLabel: trans.label,
      propagation: prop.aggregate, dissolution: diss,
      forwardTrajectory: trajectory.label,
    });
  }

  return results;
}

// ================================================================
// CATEGORY PROFILE — 5D structural fingerprint
// ================================================================

export function categoryProfile(baseline, results, nonPriceCounts, priceSignalCount) {
  const nr = {};
  for (const [cat, sev] of Object.entries(baseline)) nr[cat] = SEVERITY_RANK[sev] || 1;
  const nonPriceSum = Object.entries(nr).reduce((s, [cat, rank]) => s + rank * (nonPriceCounts[cat] || 3), 0);
  const totalSignals = Object.values(nonPriceCounts).reduce((a, b) => a + b, 0) + priceSignalCount;
  const avgPriceRank = results.reduce((sum, r) => {
    return sum + (r.mean * totalSignals - nonPriceSum) / priceSignalCount;
  }, 0) / results.length;
  const cats = Object.keys(nr);
  return [...cats.map(c => nr[c]), avgPriceRank];
}
