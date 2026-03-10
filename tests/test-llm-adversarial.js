// tests/test-llm-adversarial.js
/**
 * ADVERSARIAL: Does the LLM obey topology or hallucinate past it?
 *
 * Three signatures through the same model:
 *   A. CRISIS + crisis primes (congruent — easy)
 *   B. STABLE + crisis primes (contradictory — the real test)
 *   C. STABLE + no primes (baseline — should be boring)
 *
 * If the bridge works, B should NOT read like a crisis brief.
 * The LLM must trust the math over its own reading of the primes.
 */

import { buildIntelligenceBrief } from "../src/engine/llm-bridge.js";
import { generateIntelBrief, checkLMStudio } from "../src/engine/lm-studio-client.js";

console.log("=".repeat(70));
console.log("ADVERSARIAL: Does the LLM obey topological ground truth?");
console.log("=".repeat(70));

const health = await checkLMStudio();
if (!health.online) {
  console.log("  LM Studio OFFLINE — cannot run adversarial test");
  process.exit(0);
}
console.log(`  LM Studio online. Models: [${health.models.join(", ")}]\n`);

const OPTIONS = {
  model: "mistralai/ministral-3-3b",
  temperature: 0.1,
  maxTokens: 300,
  timeoutMs: 120_000,
};

// The same scary primes for A and B
const CRISIS_PRIMES = ["killed", "death", "floods", "earthquake", "toll", "thousands", "dead"];

const signatures = {
  A: {
    label: "CRISIS + crisis primes (congruent)",
    sig: {
      regime: "CRISIS CONSOLIDATION",
      ieRegime: "CRISIS",
      trajectory: "CONSOLIDATING",
      mean: 3.40, gini: 0.085, entropy: 1.23,
      primeDensity: 0.046, dissolutionRate: 0.78,
      beta0Count: 20, beta1Count: 1,
      onsetScale: 0.1131, maxPersistence: 0.9492,
      dKL: 2.0039, spike: true,
      emergentPrimes: CRISIS_PRIMES,
    },
  },
  B: {
    label: "STABLE + crisis primes (CONTRADICTORY — the real test)",
    sig: {
      regime: "STABLE",
      ieRegime: "STABILITY",
      trajectory: "RESOLVING",
      mean: 1.10, gini: 0.02, entropy: 0.45,
      primeDensity: 0.003, dissolutionRate: 0.12,
      beta0Count: 20, beta1Count: 0,
      onsetScale: 0.8500, maxPersistence: 0.1200,
      dKL: 0.0300, spike: false,
      emergentPrimes: CRISIS_PRIMES, // SAME scary words, but math says STABLE
    },
  },
  C: {
    label: "STABLE + no primes (baseline)",
    sig: {
      regime: "STABLE",
      ieRegime: "STABILITY",
      trajectory: "RESOLVING",
      mean: 1.05, gini: 0.01, entropy: 0.30,
      primeDensity: 0.002, dissolutionRate: 0.10,
    },
  },
};

const results = {};

for (const [key, { label, sig }] of Object.entries(signatures)) {
  console.log(`${"─".repeat(70)}`);
  console.log(`  SIGNATURE ${key}: ${label}`);
  console.log(`${"─".repeat(70)}`);

  const prompt = buildIntelligenceBrief(sig);
  try {
    const result = await generateIntelBrief(prompt, OPTIONS);
    results[key] = result;
    console.log(`  Model: ${result.model} | ${result.tokensUsed} tokens | ${result.latencyMs}ms`);
    console.log(`${"─".repeat(40)}`);
    console.log(result.content);
    console.log();
  } catch (err) {
    console.log(`  ERROR: ${err.message}\n`);
    results[key] = null;
  }
}

// ================================================================
// VERDICT
// ================================================================

console.log("=".repeat(70));
console.log("ADVERSARIAL VERDICT");
console.log("=".repeat(70));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

if (results.A && results.B && results.C) {
  const aLower = results.A.content.toLowerCase();
  const bLower = results.B.content.toLowerCase();
  const cLower = results.C.content.toLowerCase();

  // A should be a crisis brief
  check(aLower.includes("crisis") || aLower.includes("consolidat"),
    "A (crisis): references crisis/consolidation");

  // B is the real test — math says STABLE, primes say crisis
  // The LLM should trust the regime over the primes
  const bHasStable = bLower.includes("stable") || bLower.includes("stability") || bLower.includes("at rest");
  const bHasCrisis = bLower.includes("crisis consolidation") || bLower.includes("critical regime");
  check(bHasStable,
    "B (contradictory): references stability despite scary primes");
  check(!bHasCrisis,
    "B (contradictory): does NOT escalate to crisis regime");

  // C should be boring
  const cHasStable = cLower.includes("stable") || cLower.includes("stability") || cLower.includes("at rest");
  check(cHasStable,
    "C (baseline): references stable/at rest");

  // Compare lengths — crisis brief should be longer than stable brief
  console.log(`\n  Brief lengths: A=${results.A.content.length} B=${results.B.content.length} C=${results.C.content.length}`);
  console.log(`  Latencies:     A=${results.A.latencyMs}ms B=${results.B.latencyMs}ms C=${results.C.latencyMs}ms`);
}

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
console.log("=".repeat(70));
if (failed > 0) process.exit(1);
