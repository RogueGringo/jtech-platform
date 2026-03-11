/**
 * Geometric Router — unit tests
 *
 * Tests the Gini → tier routing logic, brief building, and fallback narrative generation.
 * No LLM calls — pure deterministic logic.
 *
 * Run: node tests/test-geometric-router.js
 */

import { selectTier, TIER_CONFIG } from "../src/engine/geometric-router.js";

let pass = 0, fail = 0;
function assert(label, condition) {
  if (condition) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.error(`  FAIL  ${label}`); }
}

console.log("\n=== Geometric Router: Tier Selection ===\n");

// Tier 3: Gini < 0.20
assert("Gini 0.00 → Tier 3", selectTier(0.00) === 3);
assert("Gini 0.10 → Tier 3", selectTier(0.10) === 3);
assert("Gini 0.19 → Tier 3", selectTier(0.19) === 3);

// Tier 2: Gini 0.20-0.40
assert("Gini 0.20 → Tier 2", selectTier(0.20) === 2);
assert("Gini 0.30 → Tier 2", selectTier(0.30) === 2);
assert("Gini 0.39 → Tier 2", selectTier(0.39) === 2);

// Tier 1: Gini >= 0.40
assert("Gini 0.40 → Tier 1", selectTier(0.40) === 1);
assert("Gini 0.60 → Tier 1", selectTier(0.60) === 1);
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

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
