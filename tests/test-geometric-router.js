/**
 * Geometric Router — unit tests
 *
 * Tests the Gini → tier routing logic, brief building, and fallback narrative generation.
 * No LLM calls — pure deterministic logic.
 *
 * Run: node tests/test-geometric-router.js
 */

import { selectTier, TIER_CONFIG, buildBrief, buildPrompt, routeAndArticulate } from "../src/engine/geometric-router.js";

let pass = 0, fail = 0;
function assert(label, condition) {
  if (condition) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.error(`  FAIL  ${label}`); }
}

console.log("\n=== Geometric Router: Tier Selection ===\n");

// Tier 3: Gini < 0.35 (calibrated for continuous |σ|)
assert("Gini 0.00 → Tier 3", selectTier(0.00) === 3);
assert("Gini 0.20 → Tier 3", selectTier(0.20) === 3);
assert("Gini 0.34 → Tier 3", selectTier(0.34) === 3);

// Tier 2: Gini 0.35-0.55
assert("Gini 0.35 → Tier 2", selectTier(0.35) === 2);
assert("Gini 0.45 → Tier 2", selectTier(0.45) === 2);
assert("Gini 0.54 → Tier 2", selectTier(0.54) === 2);

// Tier 1: Gini >= 0.55
assert("Gini 0.55 → Tier 1", selectTier(0.55) === 1);
assert("Gini 0.70 → Tier 1", selectTier(0.70) === 1);
assert("Gini 1.00 → Tier 1", selectTier(1.00) === 1);

// Edge cases
assert("Gini NaN → Tier 3 (safe default)", selectTier(NaN) === 3);
assert("Gini undefined → Tier 3", selectTier(undefined) === 3);

// Tier config structure
assert("TIER_CONFIG has 3 tiers", Object.keys(TIER_CONFIG).length === 3);
assert("Tier 3 maxTokens = 100", TIER_CONFIG[3].maxTokens === 100);
assert("Tier 2 maxTokens = 200", TIER_CONFIG[2].maxTokens === 200);
assert("Tier 1 maxTokens = 300", TIER_CONFIG[1].maxTokens === 300);
assert("Tier 3 temperature = 0.1", TIER_CONFIG[3].temperature === 0.1);

console.log("\n=== Geometric Router: Brief Builder ===\n");

const mockSignals = [
  { id: "mkt_rsi", sigma: -2.8, category: "condition", severity: "critical" },
  { id: "mkt_volratio", sigma: 1.6, category: "flow", severity: "high" },
  { id: "mkt_sma50", sigma: 0.4, category: "price", severity: "watch" },
  { id: "mkt_atr", sigma: 1.2, category: "capacity", severity: "moderate" },
];

const engineOutput = {
  ticker: "SPY",
  regime: { label: "BOUNDARY LAYER" },
  gini: 0.47,
  mean: 2.41,
  coherence: 72,
  signals: mockSignals,
  entropy: 1.85,
  primeDensity: 0.25,
  dissolutionRate: 0.75,
  propagationRate: 0.25,
};

const brief = buildBrief(engineOutput, { trajectory: "ACCELERATING", rho1: 0.86 });

// Structure checks
assert("brief has ticker", brief.ticker === "SPY");
assert("brief has regime string", brief.regime === "BOUNDARY LAYER");
assert("brief has tier", typeof brief.tier === "number");
assert("brief has metrics object", typeof brief.metrics === "object");
assert("brief.metrics.mean = 2.41", brief.metrics.mean === 2.41);
assert("brief.metrics.gini = 0.47", brief.metrics.gini === 0.47);
assert("brief.metrics.coherence = 72", brief.metrics.coherence === 72);
assert("brief.metrics.rho1 = 0.86", brief.metrics.rho1 === 0.86);

// Top 3 signals sorted by |sigma|
assert("brief has top 3 signals", brief.signals.length === 3);
assert("top signal is mkt_rsi (|σ|=2.8)", brief.signals[0].id === "mkt_rsi");
assert("2nd signal is mkt_volratio (|σ|=1.6)", brief.signals[1].id === "mkt_volratio");

// Narrative fields
assert("brief has fallbackNarrative", typeof brief.fallbackNarrative === "string");
assert("brief.narrative starts null", brief.narrative === null);
assert("brief.narrativeMeta starts null", brief.narrativeMeta === null);
assert("brief has timestamp", typeof brief.timestamp === "string");

// Tier assignment (0.35-0.55 = Tier 2 with calibrated thresholds)
assert("Gini 0.47 → Tier 2", brief.tier === 2);

console.log("\n=== Geometric Router: Prompt Builder ===\n");

const promptResult = buildPrompt(brief);

// Structure
assert("buildPrompt returns { system, user }", typeof promptResult.system === "string" && typeof promptResult.user === "string");

// User prompt contains measured invariants
assert("user prompt contains ticker", promptResult.user.includes("SPY"));
assert("user prompt contains regime", promptResult.user.includes("BOUNDARY LAYER"));
assert("user prompt contains mean", promptResult.user.includes("2.41"));
assert("user prompt contains gini", promptResult.user.includes("0.47"));
assert("user prompt contains 'do not recalculate'", promptResult.user.toLowerCase().includes("do not recalculate"));

// Tier-specific task prompt (Gini 0.47 = Tier 2 after recalibration)
assert("Tier 2 prompt mentions 'signal divergence'", promptResult.user.includes("signal divergence"));

// Tier 3 prompt check
const stableBrief = buildBrief(
  { ...engineOutput, gini: 0.05, regime: { label: "STABLE" } },
  { trajectory: "STABLE", rho1: 0.12 }
);
const tier3Prompt = buildPrompt(stableBrief);
assert("Tier 3 prompt mentions 'plain English'", tier3Prompt.user.includes("plain English"));

// === Cloud Client: Structure ===

import { createCloudClient } from "../src/engine/cloud-client.js";

console.log("\n=== Cloud Client: Structure ===\n");

// Without API key, client should exist but indicate unavailability
const client = createCloudClient();
assert("createCloudClient returns object", typeof client === "object");
assert("client has generate method", typeof client.generate === "function");
assert("client has isAvailable method", typeof client.isAvailable === "function");
assert("client without key is unavailable", client.isAvailable() === false);

// === LM Studio Client: Model Selection ===

import { generateIntelBrief } from "../src/engine/lm-studio-client.js";

console.log("\n=== LM Studio Client: Model Selection ===\n");

assert("generateIntelBrief is exported", typeof generateIntelBrief === "function");
assert("generateIntelBrief accepts options with model param", generateIntelBrief.length <= 2);

console.log("\n=== Geometric Router: Orchestrator ===\n");

// Test with no LLM available (graceful degradation)
const result = await routeAndArticulate(engineOutput, { trajectory: "ACCELERATING", rho1: 0.86 });

assert("routeAndArticulate returns brief", typeof result === "object");
assert("result has fallbackNarrative", typeof result.fallbackNarrative === "string");
assert("result.narrative is string or null", result.narrative === null || typeof result.narrative === "string");
assert("result has narrativeMeta", result.narrativeMeta !== undefined);
assert("fallback contains regime label", result.fallbackNarrative.includes("BOUNDARY LAYER"));
assert("fallback contains mean value", result.fallbackNarrative.includes("2.41"));
assert("fallback contains Gini value", result.fallbackNarrative.includes("0.47"));
assert("fallback contains trajectory", result.fallbackNarrative.includes("ACCELERATING"));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
