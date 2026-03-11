/**
 * Geometric Router — Topology Dictates Compute
 *
 * Maps the Gini coefficient (signal disagreement) to an LLM tier:
 *   Tier 3 (Gini < 0.35): Local 3B model — trivial articulation
 *   Tier 2 (Gini 0.35-0.55): Local 8B model — moderate synthesis
 *   Tier 1 (Gini >= 0.55): Cloud API — complex conflict resolution
 *
 * Thresholds calibrated for continuous |σ| severity scale (Cycle 6).
 * With 12 continuous indicators, ambient Gini centers ~0.30-0.40,
 * so boundaries are shifted up from the original discrete-rank values.
 *
 * Also builds the deterministic brief object and fallback narrative.
 * The LLM is a progressive enhancement, not a dependency.
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

import { TOPO_TIER3, TOPO_BRIEFING, TOPO_ANALYST } from "./system-prompts.js";
import { generateIntelBrief } from "./lm-studio-client.js";
import { createCloudClient } from "./cloud-client.js";

// ================================================================
// TIER CONFIGURATION
// ================================================================

export const TIER_CONFIG = {
  3: {
    name: "LOCAL_3B",
    giniMin: 0,
    giniMax: 0.35,
    maxTokens: 100,
    temperature: 0.1,
    taskPrompt: "State the regime and trajectory in plain English. One to two sentences maximum.",
  },
  2: {
    name: "LOCAL_8B",
    giniMin: 0.35,
    giniMax: 0.55,
    maxTokens: 200,
    temperature: 0.15,
    taskPrompt: "Synthesize the invariants into a 2-3 sentence assessment. Note any signal divergence between categories.",
  },
  1: {
    name: "CLOUD_API",
    giniMin: 0.55,
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
  if (gini >= 0.55) return 1;
  if (gini >= 0.35) return 2;
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
  const disagreement = metrics.gini > 0.55 ? "high" : metrics.gini > 0.35 ? "moderate" : "low";

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

// ================================================================
// PROMPT BUILDER — Fill-in-the-Blank constraint prompts
// ================================================================

const SYSTEM_PROMPTS = {
  3: TOPO_TIER3,
  2: TOPO_BRIEFING,
  1: TOPO_ANALYST,
};

/**
 * Build the tier-specific { system, user } prompt from a brief.
 *
 * @param {Object} brief - From buildBrief()
 * @returns {{ system: string, user: string }}
 */
export function buildPrompt(brief) {
  const system = SYSTEM_PROMPTS[brief.tier] || SYSTEM_PROMPTS[3];
  const config = TIER_CONFIG[brief.tier] || TIER_CONFIG[3];

  const top = brief.signals[0];
  const lines = [
    "MEASURED INVARIANTS (do not recalculate, do not contradict):",
    `  Ticker:       ${brief.ticker}`,
    `  Regime:       ${brief.regime}`,
    `  Trajectory:   ${brief.trajectory}`,
    `  Mean |σ|:     ${brief.metrics.mean.toFixed(2)}`,
    `  Gini:         ${brief.metrics.gini.toFixed(2)}`,
    `  Coherence:    ${brief.metrics.coherence}%`,
  ];

  if (brief.metrics.rho1 !== null) {
    lines.push(`  Lag-1 ρ₁:     ${brief.metrics.rho1.toFixed(2)}`);
  }

  if (top) {
    lines.push(`  Top Signal:   ${top.category} (${top.severity}, σ=${top.sigma.toFixed(1)})`);
  }

  if (brief.signals.length > 1) {
    lines.push("");
    lines.push("ALL REPORTED SIGNALS:");
    for (const s of brief.signals) {
      lines.push(`  ${s.id}: σ=${s.sigma.toFixed(2)}, ${s.category}, ${s.severity}`);
    }
  }

  lines.push("");
  lines.push(`YOUR TASK: ${config.taskPrompt}`);
  lines.push("You must reference at least 2 measured values. Do not speculate beyond the data above.");

  return { system, user: lines.join("\n") };
}

// ================================================================
// MODEL MAPPING — tier to LM Studio model identifier
// ================================================================

const LOCAL_MODELS = {
  3: "lmstudio-community/ministral-3b",
  2: "lmstudio-community/qwen3-8b",
};

// ================================================================
// ROUTING ORCHESTRATOR — deterministic brief + async LLM enhancement
// ================================================================

/**
 * Build brief, route to LLM tier, attempt narrative generation.
 * Returns immediately with fallback; narrative populated if LLM responds.
 *
 * @param {Object} engineOutput - From market-data.js pipeline
 * @param {Object} [extras] - { trajectory, rho1 }
 * @param {Object} [options] - { lmStudioHost, timeoutMs, cloudClient }
 * @returns {Promise<Object>} Brief with narrative (or fallback)
 */
export async function routeAndArticulate(engineOutput, extras = {}, options = {}) {
  const brief = buildBrief(engineOutput, extras);
  const prompt = buildPrompt(brief);
  const config = TIER_CONFIG[brief.tier];

  // Attempt LLM articulation based on tier
  try {
    let llmResult;

    if (brief.tier === 1) {
      // Tier 1: Cloud API
      const cloud = options.cloudClient || createCloudClient();
      if (cloud.isAvailable()) {
        llmResult = await cloud.generate(prompt, config);
      }
    } else {
      // Tier 2/3: Local LM Studio
      const model = LOCAL_MODELS[brief.tier] || "local-model";
      llmResult = await generateIntelBrief(prompt, {
        model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeoutMs: options.timeoutMs || 5000,
        host: options.lmStudioHost,
      });
    }

    if (llmResult && llmResult.content && !llmResult.error) {
      brief.narrative = llmResult.content;
      brief.narrativeMeta = {
        tier: brief.tier,
        model: llmResult.model || LOCAL_MODELS[brief.tier] || "cloud",
        provider: llmResult.provider || "lm-studio",
        latencyMs: llmResult.latencyMs || 0,
        tokensUsed: llmResult.tokensUsed || llmResult.tokens || 0,
      };
    }
  } catch {
    // Graceful degradation — fallback narrative stays
  }

  return brief;
}
