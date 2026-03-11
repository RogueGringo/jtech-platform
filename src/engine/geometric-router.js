/**
 * Geometric Router — Topology Dictates Compute
 *
 * Maps the Gini coefficient (signal disagreement) to an LLM tier:
 *   Tier 3 (Gini < 0.20): Local 3B model — trivial articulation
 *   Tier 2 (Gini 0.20-0.40): Local 8B model — moderate synthesis
 *   Tier 1 (Gini >= 0.40): Cloud API — complex conflict resolution
 *
 * Also builds the deterministic brief object and fallback narrative.
 * The LLM is a progressive enhancement, not a dependency.
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

// ================================================================
// TIER CONFIGURATION
// ================================================================

export const TIER_CONFIG = {
  3: {
    name: "LOCAL_3B",
    giniMin: 0,
    giniMax: 0.20,
    maxTokens: 100,
    temperature: 0.1,
    taskPrompt: "State the regime and trajectory in plain English. One to two sentences maximum.",
  },
  2: {
    name: "LOCAL_8B",
    giniMin: 0.20,
    giniMax: 0.40,
    maxTokens: 200,
    temperature: 0.15,
    taskPrompt: "Synthesize the invariants into a 2-3 sentence assessment. Note any signal divergence between categories.",
  },
  1: {
    name: "CLOUD_API",
    giniMin: 0.40,
    giniMax: 1.0,
    maxTokens: 300,
    temperature: 0.2,
    taskPrompt: "Analyze the conflicting vectors across categories. Explain the tension between diverging signals and assess boundary stability. 2-3 sentences.",
  },
};

// ================================================================
// TIER SELECTION — pure Gini-based routing
// ================================================================

/**
 * Select the LLM tier based on Gini coefficient.
 *
 * @param {number} gini - Gini coefficient (0-1)
 * @returns {number} Tier number (1, 2, or 3)
 */
export function selectTier(gini) {
  if (typeof gini !== "number" || isNaN(gini)) return 3;
  if (gini >= 0.40) return 1;
  if (gini >= 0.20) return 2;
  return 3;
}

// ================================================================
// BRIEF BUILDER — deterministic 90% of the intelligence brief
// ================================================================

/**
 * Build the deterministic brief object from engine output.
 *
 * @param {Object} engineOutput - From market-data.js runPipeline()
 * @param {Object} [extras={}] - Additional fields: { trajectory, rho1 }
 * @returns {Object} Complete brief with fallback narrative
 */
export function buildBrief(engineOutput, extras = {}) {
  const {
    ticker = "UNKNOWN",
    regime,
    gini,
    mean,
    coherence,
    signals,
    entropy,
    primeDensity,
    dissolutionRate,
    propagationRate,
  } = engineOutput;

  const regimeLabel = typeof regime === "object" ? regime.label : regime;
  const tier = selectTier(gini);

  // Top 3 signals by |σ|, sorted descending
  const topSignals = [...signals]
    .filter(s => s.sigma !== undefined)
    .sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma))
    .slice(0, 3);

  const metrics = {
    mean,
    gini,
    coherence,
    rho1: extras.rho1 ?? null,
    entropy,
    propagation: primeDensity,
    dissolution: dissolutionRate,
  };

  const brief = {
    ticker,
    timestamp: new Date().toISOString(),
    regime: regimeLabel,
    trajectory: extras.trajectory || "N/A",
    tier,
    metrics,
    signals: topSignals,
    fallbackNarrative: buildFallbackNarrative(regimeLabel, extras.trajectory || "N/A", metrics, topSignals),
    narrative: null,
    narrativeMeta: null,
  };

  return brief;
}

// ================================================================
// FALLBACK NARRATIVE — pure template, zero LLM dependency
// ================================================================

function buildFallbackNarrative(regime, trajectory, metrics, signals) {
  const top = signals[0];
  const stressLevel = metrics.mean > 1.8 ? "elevated" : "low";
  const disagreement = metrics.gini > 0.4 ? "high" : metrics.gini > 0.2 ? "moderate" : "low";

  let narrative = `${regime} regime detected. Mean |σ| ${metrics.mean.toFixed(2)} `
    + `with Gini ${metrics.gini.toFixed(2)} indicates ${stressLevel} stress `
    + `and ${disagreement} signal disagreement.`;

  if (top) {
    narrative += ` ${top.category} signals ${top.severity}`;
    if (signals[1]) {
      narrative += ` while ${signals[1].category} at ${signals[1].severity}`;
    }
    narrative += ".";
  }

  narrative += ` Forward trajectory: ${trajectory}.`;
  return narrative;
}
