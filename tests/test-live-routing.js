/**
 * Live Routing Test — requires LM Studio at 192.168.1.121:1234
 *
 * Sends 3 representative briefs (one per tier) through the full
 * routing orchestrator and validates LLM output quality.
 *
 * Skip conditions:
 *   - LM Studio offline → prints "SKIPPED" and exits 0
 *   - No cloud API key → Tier 1 test prints "SKIPPED"
 *
 * Run: node tests/test-live-routing.js
 */

import { checkLMStudio } from "../src/engine/lm-studio-client.js";
import { routeAndArticulate } from "../src/engine/geometric-router.js";

let pass = 0, fail = 0, skip = 0;
function assert(label, condition) {
  if (condition) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.error(`  FAIL  ${label}`); }
}

// Check LM Studio availability
const lmStatus = await checkLMStudio();
if (!lmStatus.online) {
  console.log("\nSKIPPED: LM Studio offline — live routing tests require LM Studio");
  console.log("Start LM Studio and load a model, then re-run.");
  process.exit(0);
}
console.log(`\nLM Studio online. Models: ${lmStatus.models.join(", ")}`);

// Representative engine outputs for each tier
// NOTE: Thresholds are calibrated for continuous |σ|: Tier 3 < 0.35, Tier 2 0.35-0.55, Tier 1 >= 0.55
const scenarios = [
  {
    name: "Tier 3 — STABLE regime (Gini 0.10)",
    engine: {
      ticker: "SPY", regime: { label: "STABLE" }, gini: 0.10, mean: 1.2,
      coherence: 95, signals: [
        { id: "mkt_rsi", sigma: 0.3, category: "condition", severity: "watch" },
        { id: "mkt_volratio", sigma: -0.2, category: "flow", severity: "watch" },
        { id: "mkt_sma50", sigma: 0.1, category: "price", severity: "watch" },
      ],
      entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0,
    },
    extras: { trajectory: "STABLE", rho1: 0.12 },
    expectedTier: 3,
  },
  {
    name: "Tier 2 — CRISIS CONSOLIDATION (Gini 0.42)",
    engine: {
      ticker: "SPY", regime: { label: "CRISIS CONSOLIDATION" }, gini: 0.42, mean: 2.8,
      coherence: 88, signals: [
        { id: "mkt_rsi", sigma: -2.5, category: "condition", severity: "critical" },
        { id: "mkt_drawdown", sigma: 2.1, category: "price", severity: "critical" },
        { id: "mkt_atr", sigma: 1.8, category: "capacity", severity: "high" },
      ],
      entropy: 1.2, primeDensity: 0.33, dissolutionRate: 0.8, propagationRate: 0.2,
    },
    extras: { trajectory: "ACCELERATING", rho1: 0.91 },
    expectedTier: 2,
  },
  {
    name: "Tier 1 — BOUNDARY LAYER (Gini 0.62, cloud — may skip)",
    engine: {
      ticker: "SPY", regime: { label: "BOUNDARY LAYER" }, gini: 0.62, mean: 2.1,
      coherence: 61, signals: [
        { id: "mkt_rsi", sigma: -2.8, category: "condition", severity: "critical" },
        { id: "mkt_volratio", sigma: 1.6, category: "flow", severity: "high" },
        { id: "mkt_sma50", sigma: 0.4, category: "price", severity: "watch" },
      ],
      entropy: 1.85, primeDensity: 0.25, dissolutionRate: 0.75, propagationRate: 0.25,
    },
    extras: { trajectory: "TURBULENT", rho1: 0.72 },
    expectedTier: 1,
  },
];

console.log("\n=== Live Routing Tests ===\n");

for (const scenario of scenarios) {
  console.log(`\n--- ${scenario.name} ---`);

  if (scenario.expectedTier === 1 && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log("  SKIPPED (no cloud API key set)");
    skip++;
    continue;
  }

  const result = await routeAndArticulate(scenario.engine, scenario.extras, { timeoutMs: 15_000 });

  assert(`${scenario.name}: correct tier`, result.tier === scenario.expectedTier);
  assert(`${scenario.name}: has fallback`, typeof result.fallbackNarrative === "string");

  if (result.narrative) {
    console.log(`  Narrative: "${result.narrative}"`);
    console.log(`  Meta: tier=${result.narrativeMeta?.tier}, latency=${result.narrativeMeta?.latencyMs}ms`);

    // Validate LLM references measured values
    const hasNumber = /\d+\.?\d*/.test(result.narrative);
    assert(`${scenario.name}: narrative contains a number`, hasNumber);
  } else {
    console.log("  No narrative returned (LLM unavailable — fallback active)");
    assert(`${scenario.name}: fallback is readable`, result.fallbackNarrative.length > 20);
  }
}

console.log(`\n${pass}/${pass + fail} passed, ${skip} skipped`);
process.exit(fail > 0 ? 1 : 0);
