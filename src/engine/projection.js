const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

// Propagation capacity per category:
// P(cat) = max_rank - mean_rank within each category
// High P = crisis hasn't fully propagated; cascades will close the gap
export function computePropagationCapacity(signals, categoryKeys) {
  const perCategory = {};
  let totalP = 0, catCount = 0;
  for (const cat of categoryKeys) {
    const ranks = signals.filter(s => s.category === cat)
      .map(s => SEVERITY_RANK[s.severity] || 1);
    if (ranks.length === 0) { perCategory[cat] = 0; continue; }
    const max = Math.max(...ranks);
    const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    perCategory[cat] = max - mean;
    totalP += perCategory[cat];
    catCount++;
  }
  const aggregate = catCount > 0 ? totalP / catCount : 0;
  return { perCategory, aggregate };
}

// Dissolution rate: -1 * slope of coherence over recent history
// Negative = coherence rising = crisis deepening
// Positive = coherence falling = crisis resolving
export function computeDissolutionRate(coherenceHistory) {
  if (coherenceHistory.length < 2) return 0;
  const n = coherenceHistory.length;
  const last = coherenceHistory[n - 1];
  const first = coherenceHistory[0];
  return -1 * (last - first) / (n - 1);
}

// Forward trajectory from (propagation, dissolution)
// Layer 2 of the regime system
export function classifyTrajectory(propagation, dissolution) {
  const highProp = propagation >= 0.5;
  const negativeDiss = dissolution < 0;
  if (highProp && negativeDiss)   return { label: "ACCELERATING", quadrant: "high-neg" };
  if (!highProp && negativeDiss)  return { label: "CONSOLIDATING", quadrant: "low-neg" };
  if (highProp && !negativeDiss)  return { label: "TURBULENT", quadrant: "high-pos" };
  return { label: "RESOLVING", quadrant: "low-pos" };
}
