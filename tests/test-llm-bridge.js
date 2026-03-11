// tests/test-llm-bridge.js
/**
 * Smoke test: LLM Bridge prompt generation
 * Validates prompt structure, not LLM output.
 */

import { buildIntelligenceBrief } from "../src/engine/llm-bridge.js";

console.log("=".repeat(70));
console.log("TEST: LLM Bridge — Prompt Generation");
console.log("=".repeat(70));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// TEST 1: Minimal signature (regime only)
const minimal = buildIntelligenceBrief({ regime: "STABLE" });
check(typeof minimal.system === "string", "Minimal: system prompt is string");
check(typeof minimal.user === "string", "Minimal: user prompt is string");
check(minimal.system.includes("37F"), "Minimal: system prompt includes 37F doctrine");
check(minimal.user.includes("STABLE"), "Minimal: user prompt includes regime");

// TEST 2: Full signature (all layers)
const full = buildIntelligenceBrief({
  regime: "CRISIS CONSOLIDATION",
  ieRegime: "CRISIS",
  trajectory: "CONSOLIDATING",
  mean: 3.40,
  gini: 0.085,
  entropy: 1.23,
  primeDensity: 0.046,
  dissolutionRate: 0.78,
  coherence: 95.0,
  // Layer 1
  beta0Count: 20,
  beta1Count: 1,
  onsetScale: 0.1131,
  maxPersistence: 0.9492,
  // Layer -1
  dKL: 2.0039,
  spike: true,
  emergentPrimes: ["killed", "death", "floods", "earthquake", "toll"],
});
check(full.system.includes("β₁ = 1 cycles"), "Full: system prompt references β₁ count");
check(full.system.includes("YES"), "Full: system prompt notes anomaly spike");
check(full.user.includes("CRISIS CONSOLIDATION"), "Full: user prompt shows regime");
check(full.user.includes("killed"), "Full: user prompt includes emergent primes");
check(full.user.includes("2.0039"), "Full: user prompt shows D_KL value");
check(full.user.includes("0.1131"), "Full: user prompt shows onset scale");
check(full.user.includes("95.0%"), "Full: user prompt shows coherence");
check(full.user.includes("LAYER 1"), "Full: user prompt has Layer 1 section");
check(full.user.includes("LAYER -1"), "Full: user prompt has Layer -1 section");

// TEST 3: Error on missing regime
let threwError = false;
try { buildIntelligenceBrief({}); } catch (e) { threwError = true; }
check(threwError, "Throws on missing regime");

// TEST 4: No hallucination vectors — prompt constrains LLM
check(full.system.includes("Do NOT calculate severity"), "Anti-hallucination: forbids severity calculation");
check(full.system.includes("Do NOT hallucinate"), "Anti-hallucination: forbids data fabrication");
check(full.system.includes("MUST be anchored"), "Anti-hallucination: requires invariant anchoring");

// TEST 5: Geometry — system prompt scales with available data
const noTopo = buildIntelligenceBrief({
  regime: "TRANSIENT SPIKE",
  mean: 1.50,
  gini: 0.45,
});
check(!noTopo.system.includes("β₁"), "Graceful: no β₁ section when Layer 1 absent");
check(!noTopo.user.includes("LAYER 1"), "Graceful: no Layer 1 block when absent");
check(!noTopo.user.includes("LAYER -1"), "Graceful: no Layer -1 block when absent");

// Print full prompt for human inspection
console.log("\n" + "=".repeat(70));
console.log("SAMPLE PROMPT (full crisis signature):");
console.log("=".repeat(70));
console.log("\n--- SYSTEM ---");
console.log(full.system);
console.log("\n--- USER ---");
console.log(full.user);

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
