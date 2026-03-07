export function computeSeverity(id, numeric, baseSeverity, thresholds = {}) {
  const levels = thresholds[id];
  if (!levels || numeric === null || numeric === undefined) return baseSeverity;
  for (const [level, threshold] of levels) {
    if (numeric >= threshold) return level;
  }
  return "watch";
}

export function computeCoherence(signals) {
  const criticalCount = signals.filter(s => s.severity === "critical").length;
  const highCount = signals.filter(s => s.severity === "high").length;
  const score = Math.round(((criticalCount * 1.0 + highCount * 0.6) / signals.length) * 100);
  const label = score >= 75 ? "CRISIS REGIME" : score >= 50 ? "TRANSITION" : "STABLE";
  return { score, label, criticalCount, highCount };
}
