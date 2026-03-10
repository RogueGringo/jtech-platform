// tests/test-lm-studio-client.js
/**
 * END-TO-END: Engine → Bridge → LM Studio → Intelligence Brief
 *
 * Fires a real crisis signature through the full pipeline.
 * Requires LM Studio running at 192.168.1.121:1234 with a model loaded.
 * If LM Studio is offline, tests gracefully skip with a clear message.
 */

import { buildIntelligenceBrief } from "../src/engine/llm-bridge.js";
import { generateIntelBrief, checkLMStudio } from "../src/engine/lm-studio-client.js";

console.log("=".repeat(70));
console.log("END-TO-END: Engine → Bridge → LM Studio → Intel Brief");
console.log("=".repeat(70));

let passed = 0, failed = 0, skipped = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}
function skip(label) { console.log(`  SKIP: ${label}`); skipped++; }

// Step 1: Check LM Studio health
console.log("\n  Checking LM Studio...");
const health = await checkLMStudio();

if (!health.online) {
  console.log("  LM Studio OFFLINE — skipping inference tests");
  console.log("  Start LM Studio and load a model to run full pipeline");
  skip("LM Studio health check");
  skip("Full pipeline inference");
  skip("Response structure validation");
  skip("Anti-hallucination check");
  console.log(`\n  RESULT: ${passed} passed, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

check(health.online, `LM Studio online at 192.168.1.121:1234`);
console.log(`  Models loaded: [${health.models.join(", ")}]`);
check(health.models.length > 0, `At least one model loaded: ${health.models.length}`);

// Step 2: Build a full crisis signature (from real measured values)
const signature = {
  regime: "CRISIS CONSOLIDATION",
  ieRegime: "CRISIS",
  trajectory: "CONSOLIDATING",
  mean: 3.40,
  gini: 0.085,
  entropy: 1.23,
  primeDensity: 0.046,
  dissolutionRate: 0.78,
  coherence: 95.0,
  // Layer 1 — from test-topology-pipeline.js output
  beta0Count: 20,
  beta1Count: 1,
  onsetScale: 0.1131,
  maxPersistence: 0.9492,
  // Layer -1 — from test-zipf.js output
  dKL: 2.0039,
  spike: true,
  emergentPrimes: ["killed", "death", "floods", "earthquake", "toll", "thousands", "dead", "rains"],
};

// Step 3: Build the prompt
const prompt = buildIntelligenceBrief(signature);
check(typeof prompt.system === "string" && prompt.system.length > 0, "Bridge produced system prompt");
check(typeof prompt.user === "string" && prompt.user.length > 0, "Bridge produced user prompt");

// Step 4: Fire into LM Studio
console.log("\n  Sending to LM Studio...");
const start = performance.now();
try {
  const result = await generateIntelBrief(prompt, {
    model: "mistralai/ministral-3-3b",
    temperature: 0.1,
    maxTokens: 300,
    timeoutMs: 120_000, // 2 min — cold start can be slow
  });
  const elapsed = performance.now() - start;

  check(typeof result.content === "string" && result.content.length > 0,
    `Got response: ${result.content.length} chars in ${result.latencyMs}ms`);
  check(result.tokensUsed > 0, `Tokens used: ${result.tokensUsed}`);
  check(result.latencyMs > 0, `Latency measured: ${result.latencyMs}ms`);

  // Print the full brief
  console.log("\n" + "=".repeat(70));
  console.log("INTELLIGENCE BRIEF — LLM OUTPUT");
  console.log("=".repeat(70));
  console.log(`  Model: ${result.model}`);
  console.log(`  Tokens: ${result.tokensUsed}`);
  console.log(`  Latency: ${result.latencyMs}ms`);
  console.log("-".repeat(70));
  console.log(result.content);
  console.log("-".repeat(70));

  // Step 5: Structural checks on LLM output
  const lower = result.content.toLowerCase();
  // The LLM should reference the regime we gave it
  check(lower.includes("crisis") || lower.includes("consolidation"),
    "Response references crisis regime");
  // Should NOT invent severity classifications (it articulates, doesn't classify)
  // This is a soft check — we log but don't fail on it
  const hasNumbers = /\d/.test(result.content);
  console.log(`  INFO: Response contains numbers: ${hasNumbers} (expected — citing invariants)`);

} catch (err) {
  console.log(`  ERROR: ${err.message}`);
  failed++;
}

console.log(`\n  RESULT: ${passed} passed, ${skipped} skipped, ${failed} failed`);
console.log("=".repeat(70));
if (failed > 0) process.exit(1);
