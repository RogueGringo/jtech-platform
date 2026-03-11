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
