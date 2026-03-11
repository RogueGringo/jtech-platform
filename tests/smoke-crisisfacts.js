/**
 * CrisisFACTS Adapter Smoke Test
 *
 * Simulates three text batches at different crisis levels:
 *   1. Baseline — normal day, no crisis language
 *   2. Moderate Panic — developing situation, some urgency
 *   3. Full Cognitive Breakdown — survival-mode language, loss of agency
 *
 * Validates: the same math engine produces correct severity stratification
 * from raw unstructured text, just as it does from GDELT CAMEO codes.
 *
 * Run: node tests/smoke-crisisfacts.js
 */

import { crisisTextToSignals, computeTextPrimeDensity, computeTextEntropy } from "../src/adapters/crisisfacts-adapter.js";
import { computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import config from "../src/domains/crisisfacts-ie/config.js";

const THRESHOLDS = config.severityThresholds;
const CATEGORY_KEYS = Object.keys(config.categories);

console.log("=".repeat(80));
console.log("CRISISFACTS ADAPTER SMOKE TEST — Semantic Prime Extraction");
console.log("=".repeat(80));

// ================================================================
// TWEET BATCH 1: BASELINE — Normal day, no crisis
// ================================================================

const baseline = [
  { text: "Great weather today in Portland, heading to the farmers market with the family.", timestamp: "2022-01-15T10:00:00Z" },
  { text: "Just saw a beautiful sunset over the river. Love this city.", timestamp: "2022-01-15T18:30:00Z" },
  { text: "Traffic is a bit slow on I-5 but nothing unusual for a Saturday afternoon.", timestamp: "2022-01-15T14:00:00Z" },
  { text: "New coffee shop opened downtown. The latte is amazing. Highly recommend!", timestamp: "2022-01-15T09:00:00Z" },
  { text: "Kids are playing in the park. Perfect spring day for the community.", timestamp: "2022-01-15T11:00:00Z" },
];

// ================================================================
// TWEET BATCH 2: MODERATE PANIC — Developing situation
// ================================================================

const moderate = [
  { text: "Breaking: large fire reported near downtown Portland. Smoke visible from miles away.", timestamp: "2022-03-08T14:00:00Z" },
  { text: "Emergency services responding to fire on 5th street. Ambulance and police arriving.", timestamp: "2022-03-08T14:15:00Z" },
  { text: "People being evacuated from buildings near the fire. Firefighters deployed.", timestamp: "2022-03-08T14:30:00Z" },
  { text: "Update: official reports confirm fire is spreading. Injuries reported. Need blood donors.", timestamp: "2022-03-08T14:45:00Z" },
  { text: "Smoke is thick, hard to breathe. Emergency shelters opening at the convention center.", timestamp: "2022-03-08T15:00:00Z" },
];

// ================================================================
// TWEET BATCH 3: FULL COGNITIVE BREAKDOWN — Survival mode
// ================================================================

const breakdown = [
  { text: "PEOPLE ARE DEAD. Bodies in the street. Building collapsed. Help us please god help.", timestamp: "2022-06-01T08:00:00Z" },
  { text: "Trapped under rubble. Crushed. Can hear screaming. No one is coming. Helpless. Nothing.", timestamp: "2022-06-01T08:05:00Z" },
  { text: "Shooting. People shot dead. Blood everywhere. Panic. Fleeing. Chaos. Nowhere safe.", timestamp: "2022-06-01T08:10:00Z" },
  { text: "Explosion destroyed everything. Bodies. Fire. Burning. Dead. Lost. Gone. Abandoned.", timestamp: "2022-06-01T08:15:00Z" },
  { text: "Help me. Desperate. Trapped. No rescue. No help. Dying. Helpless. Please.", timestamp: "2022-06-01T08:20:00Z" },
];

// ================================================================
// RUN ALL THREE BATCHES
// ================================================================

const batches = [
  { name: "BASELINE (Normal Day)", records: baseline, expected: "STABILITY" },
  { name: "MODERATE (Developing Fire)", records: moderate, expected: "VULNERABILITY" },
  { name: "BREAKDOWN (Cognitive Collapse)", records: breakdown, expected: "CRISIS" },
];

const batchResults = [];

for (const batch of batches) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`  ${batch.name}`);
  console.log("─".repeat(80));

  const result = crisisTextToSignals(batch.records, THRESHOLDS);

  // Individual text analysis
  console.log("\n  Per-text Prime Density:");
  for (const rec of batch.records) {
    const pd = computeTextPrimeDensity(rec.text);
    const preview = rec.text.length > 60 ? rec.text.substring(0, 60) + "..." : rec.text;
    console.log(`    "${preview}"`);
    console.log(`      tokens=${pd.tokens} | diss=${pd.dissolutionHits} prop=${pd.propagationHits} | PD=${(pd.primeDensity * 100).toFixed(1)}%`);
  }

  // Batch-level metrics
  console.log(`\n  Batch Metrics:`);
  console.log(`    Words:         ${result.wordCount}`);
  console.log(`    Prime Density: ${(result.primeDensity * 100).toFixed(1)}%`);
  console.log(`    Dissolution:   ${(result.dissolutionRate * 100).toFixed(1)}%`);
  console.log(`    Propagation:   ${(result.propagationRate * 100).toFixed(1)}%`);
  console.log(`    Entropy:       ${result.entropy.toFixed(3)}`);

  // Run through math engine
  if (result.signals.length > 0) {
    const gini = computeGini(result.signals);
    const mean = computeMeanSeverity(result.signals);
    const regime = classifyRegime(mean, gini);

    console.log(`\n  Engine Output:`);
    console.log(`    Signals: ${result.signals.map(s => `${s.category}=${s.severity}`).join(", ")}`);
    console.log(`    Gini:    ${gini.toFixed(3)}`);
    console.log(`    Mean:    ${mean.toFixed(2)}`);
    console.log(`    Regime:  ${regime.label}`);
    console.log(`    Expected: ${batch.expected}`);

    batchResults.push({ name: batch.name, primeDensity: result.primeDensity, entropy: result.entropy, mean, gini, regime: regime.label, expected: batch.expected });
  } else {
    console.log(`\n  Engine Output: No signals (all watch-level)`);
    batchResults.push({ name: batch.name, primeDensity: result.primeDensity, entropy: result.entropy, mean: 1, gini: 0, regime: "STABLE", expected: batch.expected });
  }
}

// ================================================================
// VALIDATION
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("SMOKE TEST VALIDATION");
console.log("=".repeat(80));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); failed++; }
}

const [bl, md, bd] = batchResults;

// Prime density escalation: baseline < moderate < breakdown
check(bl.primeDensity < md.primeDensity,
  "Prime density: baseline < moderate",
  `baseline=${(bl.primeDensity * 100).toFixed(1)}%, moderate=${(md.primeDensity * 100).toFixed(1)}%`);

check(md.primeDensity < bd.primeDensity,
  "Prime density: moderate < breakdown",
  `moderate=${(md.primeDensity * 100).toFixed(1)}%, breakdown=${(bd.primeDensity * 100).toFixed(1)}%`);

// Mean severity escalation
check(bl.mean < md.mean,
  "Mean severity: baseline < moderate",
  `baseline=${bl.mean.toFixed(2)}, moderate=${md.mean.toFixed(2)}`);

check(md.mean < bd.mean,
  "Mean severity: moderate < breakdown",
  `moderate=${md.mean.toFixed(2)}, breakdown=${bd.mean.toFixed(2)}`);

// Entropy should drop during breakdown (cognitive regression = concentration on few prime categories)
check(bd.entropy < md.entropy || bd.primeDensity > 0.15,
  "Cognitive regression: breakdown entropy <= moderate OR extreme prime density",
  `moderate S=${md.entropy.toFixed(3)}, breakdown S=${bd.entropy.toFixed(3)}, breakdown PD=${(bd.primeDensity * 100).toFixed(1)}%`);

// Breakdown batch must hit critical prime density threshold (>= 15%)
check(bd.primeDensity >= 0.15,
  "Breakdown hits critical threshold (>= 15% dissolution primes)",
  `PD=${(bd.primeDensity * 100).toFixed(1)}%`);

// Baseline must stay below moderate threshold (< 3%)
check(bl.primeDensity < 0.03,
  "Baseline stays below moderate threshold (< 3%)",
  `PD=${(bl.primeDensity * 100).toFixed(1)}%`);

console.log(`\n  ${"=".repeat(50)}`);
console.log(`  SMOKE TEST: ${passed} passed, ${failed} failed`);
console.log(`  ${"=".repeat(50)}`);

console.log(`\n${"=".repeat(80)}`);
console.log(`FINAL: ${passed} passed, ${failed} failed`);
console.log("=".repeat(80));

if (failed > 0) process.exit(1);
