import { computeGini, computeMeanSeverity, computeCrossCoherence, classifyRegime } from "./dynamics.js";

export function computeSeverity(id, numeric, baseSeverity, thresholds = {}) {
  const levels = thresholds[id];
  if (!levels || numeric === null || numeric === undefined) return baseSeverity;
  for (const [level, threshold] of levels) {
    if (numeric >= threshold) return level;
  }
  return "watch";
}

export function computeCoherence(signals, categoryKeys) {
  const gini = computeGini(signals);
  const meanSeverity = computeMeanSeverity(signals);
  const coherenceScore = computeCrossCoherence(signals, categoryKeys);
  const regime = classifyRegime(meanSeverity, gini);
  const criticalCount = signals.filter(s => s.severity === "critical").length;
  const highCount = signals.filter(s => s.severity === "high").length;
  return {
    gini,
    meanSeverity,
    coherenceScore,
    regime,
    criticalCount,
    highCount,
    // Legacy aliases — UI components read .score and .label
    score: coherenceScore,
    label: regime.label,
  };
}
