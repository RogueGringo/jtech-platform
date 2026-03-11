const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

// --- Real Gini Coefficient ---
// G = (sum_i sum_j |x_i - x_j|) / (2 * n^2 * mean(x))
// G near 0: uniform severity (signals agree)
// G near 1: severity concentrated in few signals
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

// --- Mean Severity Rank ---
export function computeMeanSeverity(signals) {
  if (signals.length === 0) return 1;
  const ranks = signals.map(s => SEVERITY_RANK[s.severity] || 1);
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

// --- Cross-Category Coherence via Coefficient of Variation ---
// 1. Compute mean severity rank per category
// 2. CV = sigma / mu across category means
// 3. Coherence = (1 - min(CV, 1)) * 100
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

// --- 2D Regime Classification ---
// Quadrant from (meanSeverity, gini):
//   Low mean + Low gini  = STABLE
//   Low mean + High gini = TRANSIENT SPIKE
//   High mean + Low gini = CRISIS CONSOLIDATION
//   High mean + High gini = BOUNDARY LAYER
export function classifyRegime(meanSeverity, gini) {
  const highMean = meanSeverity >= 2.5;
  const highGini = gini >= 0.2;
  if (!highMean && !highGini) return { label: "STABLE", quadrant: "low-low" };
  if (!highMean && highGini)  return { label: "TRANSIENT SPIKE", quadrant: "low-high" };
  if (highMean && !highGini)  return { label: "CRISIS CONSOLIDATION", quadrant: "high-low" };
  return { label: "BOUNDARY LAYER", quadrant: "high-high" };
}

// --- Signal History Buffer (ring buffer) ---
const MAX_SNAPSHOTS = 30;

export function createHistoryBuffer() {
  return { snapshots: [], cursor: 0 };
}

export function pushSnapshot(buffer, signals) {
  const snapshot = {
    timestamp: Date.now(),
    ranks: {},
  };
  for (const s of signals) {
    snapshot.ranks[s.id] = SEVERITY_RANK[s.severity] || 1;
  }
  if (buffer.snapshots.length < MAX_SNAPSHOTS) {
    buffer.snapshots.push(snapshot);
  } else {
    buffer.snapshots[buffer.cursor] = snapshot;
  }
  buffer.cursor = (buffer.cursor + 1) % MAX_SNAPSHOTS;
  return buffer;
}

// Get snapshots in chronological order
function getOrderedSnapshots(buffer) {
  const len = buffer.snapshots.length;
  if (len < MAX_SNAPSHOTS) return buffer.snapshots;
  return [...buffer.snapshots.slice(buffer.cursor), ...buffer.snapshots.slice(0, buffer.cursor)];
}

// --- Activity:State per Signal ---
// Delta from config baseline severity rank + delta from previous snapshot
export function computeActivityState(signals, buffer, baselineSignals) {
  const ordered = getOrderedSnapshots(buffer);
  const prev = ordered.length >= 2 ? ordered[ordered.length - 2] : null;
  const baseRanks = {};
  for (const s of baselineSignals) {
    baseRanks[s.id] = SEVERITY_RANK[s.severity] || 1;
  }
  return signals.map(s => {
    const currentRank = SEVERITY_RANK[s.severity] || 1;
    const baselineRank = baseRanks[s.id] || 1;
    const deltaFromBaseline = currentRank - baselineRank;
    const deltaFromPrev = prev && prev.ranks[s.id] !== undefined
      ? currentRank - prev.ranks[s.id]
      : 0;
    return {
      id: s.id,
      currentRank,
      baselineRank,
      deltaFromBaseline,
      deltaFromPrev,
      direction: deltaFromBaseline > 0 ? "escalating" : deltaFromBaseline < 0 ? "deescalating" : "stable",
    };
  });
}

// --- Transition Intensity via Change Vector ---
// 1. delta_i = currentRank - baselineRank for each signal
// 2. magnitude = sqrt(sum(delta_i^2))
// 3. alignment = fraction of non-zero deltas sharing the dominant sign
export function computeTransitionIntensity(signals, baselineSignals) {
  const baseRanks = {};
  for (const s of baselineSignals) {
    baseRanks[s.id] = SEVERITY_RANK[s.severity] || 1;
  }
  const deltas = signals.map(s => {
    const current = SEVERITY_RANK[s.severity] || 1;
    const baseline = baseRanks[s.id] || 1;
    return current - baseline;
  });
  const magnitude = Math.sqrt(deltas.reduce((sum, d) => sum + d * d, 0));
  const nonZero = deltas.filter(d => d !== 0);
  if (nonZero.length === 0) return { magnitude: 0, alignment: 0, label: "STABLE", normalized: 0 };
  const positive = nonZero.filter(d => d > 0).length;
  const negative = nonZero.length - positive;
  const alignment = Math.max(positive, negative) / nonZero.length;
  const maxMag = Math.sqrt(signals.length * 9);
  const normalized = maxMag > 0 ? magnitude / maxMag : 0;
  let label;
  if (normalized < 0.2) label = "STABLE";
  else if (alignment >= 0.7) label = "PHASE TRANSITION";
  else label = "TURBULENCE";
  return { magnitude, alignment, normalized, label };
}

// --- Gini Trajectory Slope ---
// Direction of (mean, gini) point over recent history
export function computeGiniTrajectory(buffer, signals) {
  const ordered = getOrderedSnapshots(buffer);
  if (ordered.length < 3) return { slope: 0, direction: "insufficient data" };
  const recentGinis = ordered.slice(-3).map(snap => {
    const ranks = Object.values(snap.ranks);
    if (ranks.length === 0) return 0;
    const n = ranks.length;
    const mean = ranks.reduce((a, b) => a + b, 0) / n;
    if (mean === 0) return 0;
    let sumAbsDiff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sumAbsDiff += Math.abs(ranks[i] - ranks[j]);
      }
    }
    return sumAbsDiff / (2 * n * n * mean);
  });
  const slope = (recentGinis[2] - recentGinis[0]) / 2;
  const direction = slope > 0.01 ? "concentrating" : slope < -0.01 ? "dispersing" : "stable";
  return { slope, direction };
}
