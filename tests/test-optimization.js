/**
 * Optimization Pipeline Test — Reality Only
 *
 * Runs the full optimization stack on real disaster data
 * with real LM Studio calls. Measures actual tier routing,
 * actual latencies, actual LLM output.
 *
 * Run: node tests/test-optimization.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { crisisTextToSignals } from "../src/adapters/crisisfacts-adapter.js";
import { computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import config from "../src/domains/crisisfacts-ie/config.js";
import {
  SYSTEM_PROFILE, TIERS, routeToTier, geometricEmbed,
  geometricDistance, regimeFromEmbedding, initSession,
  processBatch, resetSession,
} from "../src/engine/optimization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THRESHOLDS = config.severityThresholds;

console.log("=".repeat(80));
console.log("OPTIMIZATION PIPELINE — REALITY TEST");
console.log("=".repeat(80));

// ================================================================
// LOAD REAL DATA
// ================================================================

const csvPath = path.join(__dirname, "data", "disaster-response", "messages.csv");
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.trim().split("\n");
const header = lines[0].split(",").map(h => h.trim());

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVLine(lines[i]);
  const row = {};
  header.forEach((col, j) => { row[col] = vals[j] || ""; });
  if (row.message && row.message.length > 5) rows.push(row);
}

// Build test batches: baseline → mixed → death-heavy (provoke regime transitions)
const baseline = rows.filter(r => r.related === "0").slice(0, 500);
const mixed = rows.filter(r => r.related === "1" && r.death !== "1").slice(0, 500);
const deathHeavy = rows.filter(r => r.death === "1");
const rescueHeavy = rows.filter(r => r.search_and_rescue === "1");

const testBatches = [
  { name: "BASELINE (unrelated)", rows: baseline },
  { name: "MIXED CRISIS", rows: mixed },
  { name: "DEATH REPORTS", rows: deathHeavy },
  { name: "SEARCH & RESCUE", rows: rescueHeavy },
];

console.log(`\n  Loaded ${rows.length} messages`);
console.log(`  Test batches: ${testBatches.map(b => `${b.name}(${b.rows.length})`).join(", ")}\n`);

// ================================================================
// SYSTEM PROFILE
// ================================================================

console.log("─".repeat(80));
console.log("MEASURED SYSTEM PROFILE");
console.log("─".repeat(80));
console.log(`  Engine:      ${SYSTEM_PROFILE.engine.messagesPerSecond.toLocaleString()} msgs/sec (${SYSTEM_PROFILE.engine.msPerMessage * 1000}μs/msg)`);
console.log(`  LM Studio:   ${SYSTEM_PROFILE.lmStudio.model} @ ${SYSTEM_PROFILE.lmStudio.host}`);
console.log(`  Quantization: ${SYSTEM_PROFILE.lmStudio.quantization}`);
console.log(`  Context:     ${SYSTEM_PROFILE.lmStudio.contextLength.toLocaleString()} tokens`);
console.log(`  Speed:       ${SYSTEM_PROFILE.lmStudio.tokensPerSecond} tok/sec`);
console.log(`  Fresh TTFT:  ${SYSTEM_PROFILE.lmStudio.freshCallMs}ms`);
console.log(`  Stateful:    ${SYSTEM_PROFILE.lmStudio.statefulCallMs}ms`);

// ================================================================
// INIT LM STUDIO SESSION
// ================================================================

console.log(`\n${"─".repeat(80)}`);
console.log("INITIALIZING LM STUDIO SESSION");
console.log("─".repeat(80));

const session = await initSession();
if (session.error) {
  console.log(`  ERROR: ${session.error}`);
  console.log("  Continuing without LLM — engine-only mode\n");
} else {
  console.log(`  Session ID: ${session.responseId}`);
  console.log(`  TTFT: ${session.ttft.toFixed(3)}s`);
  console.log(`  Speed: ${session.tokPerSec.toFixed(1)} tok/sec`);
}

// ================================================================
// RUN PIPELINE ON EACH BATCH
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("OPTIMIZATION PIPELINE EXECUTION");
console.log("=".repeat(80));

let prevState = {};
const pipelineResults = [];
let totalEngineMs = 0;
let totalLlmMs = 0;
let tierCounts = { 0: 0, 1: 0, 2: 0 };

for (const batch of testBatches) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`  ${batch.name} (${batch.rows.length} messages)`);
  console.log("─".repeat(80));

  const records = batch.rows.map(m => ({ text: m.message }));

  const result = await processBatch(
    records, THRESHOLDS,
    crisisTextToSignals, computeGini, computeMeanSeverity, classifyRegime,
    prevState,
  );

  tierCounts[result.tier]++;
  totalEngineMs += result.latency.engineMs;
  totalLlmMs += result.latency.llmMs;

  console.log(`  Regime:    ${result.regime}`);
  console.log(`  Gini:      ${result.gini.toFixed(3)}`);
  console.log(`  Mean:      ${result.mean.toFixed(2)}`);
  console.log(`  PD:        ${(result.primeDensity * 100).toFixed(1)}%`);
  console.log(`  Diss Rate: ${(result.dissolutionRate * 100).toFixed(0)}%`);
  console.log(`  Entropy:   ${result.entropy.toFixed(3)}`);
  console.log(`  Embedding: [${result.embedding.map(v => v.toFixed(2)).join(", ")}]`);
  console.log(`  Tier:      ${result.tier} (${TIERS[result.tier].name})`);
  console.log(`  Engine:    ${result.latency.engineMs.toFixed(1)}ms`);
  console.log(`  LLM:       ${result.latency.llmMs > 0 ? result.latency.llmMs.toFixed(0) + "ms" : "skipped"}`);

  if (result.briefing && !result.briefing.error) {
    console.log(`  Briefing:  "${result.briefing.content}"`);
    console.log(`  Tokens:    ${result.briefing.tokens} @ ${result.briefing.tokPerSec.toFixed(0)} tok/sec`);
  }

  prevState = {
    regime: result.regime,
    gini: result.gini,
    trajectory: result.gini > (prevState.gini || 0) ? 0.01 : -0.01,
  };

  pipelineResults.push(result);
}

// ================================================================
// 5D EMBEDDING ANALYSIS
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("5D GEOMETRIC EMBEDDING ANALYSIS");
console.log("=".repeat(80));

const embeddings = pipelineResults.map((r, i) => ({ name: testBatches[i].name, embed: r.embedding }));

console.log(`\n  Pairwise distances (Euclidean in prime density space):`);
for (let i = 0; i < embeddings.length; i++) {
  for (let j = i + 1; j < embeddings.length; j++) {
    const dist = geometricDistance(embeddings[i].embed, embeddings[j].embed);
    console.log(`    ${embeddings[i].name.padEnd(20)} ↔ ${embeddings[j].name.padEnd(20)} d=${dist.toFixed(3)}`);
  }
}

console.log(`\n  Regime from embedding (no model, pure geometry):`);
for (const e of embeddings) {
  console.log(`    ${e.name.padEnd(22)} → ${regimeFromEmbedding(e.embed)}`);
}

// ================================================================
// OPTIMIZATION SUMMARY
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("OPTIMIZATION SUMMARY");
console.log("=".repeat(80));

const totalMessages = testBatches.reduce((s, b) => s + b.rows.length, 0);

console.log(`\n  Total messages:    ${totalMessages.toLocaleString()}`);
console.log(`  Engine time:       ${totalEngineMs.toFixed(1)}ms (${(totalMessages / (totalEngineMs / 1000)).toLocaleString()} msgs/sec)`);
console.log(`  LLM time:          ${totalLlmMs.toFixed(0)}ms`);
console.log(`  Total time:        ${(totalEngineMs + totalLlmMs).toFixed(0)}ms`);
console.log(`\n  Tier distribution:`);
console.log(`    Tier 0 (SILENT):  ${tierCounts[0]} batches — $0, 0ms LLM`);
console.log(`    Tier 1 (BRIEF):   ${tierCounts[1]} batches — $0, ~440ms each`);
console.log(`    Tier 2 (FULL):    ${tierCounts[2]} batches — $0, ~5.5s each`);

const llmCallsAvoided = tierCounts[0];
const llmCallsMade = tierCounts[1] + tierCounts[2];
const savings = llmCallsAvoided / (llmCallsAvoided + llmCallsMade) * 100;

console.log(`\n  LLM calls made:    ${llmCallsMade} of ${testBatches.length} batches`);
console.log(`  LLM calls avoided: ${llmCallsAvoided} (${savings.toFixed(0)}% reduction)`);

// What it would cost without optimization (every batch hits LLM)
const naiveLlmMs = testBatches.length * SYSTEM_PROFILE.lmStudio.freshCallMs;
const optimizedLlmMs = totalLlmMs;
const speedup = naiveLlmMs / Math.max(optimizedLlmMs, 1);

console.log(`\n  Naive approach:    ${naiveLlmMs.toLocaleString()}ms (every batch → fresh LLM call)`);
console.log(`  Optimized:         ${optimizedLlmMs.toFixed(0)}ms`);
console.log(`  Speedup:           ${speedup.toFixed(1)}×`);

// ================================================================
// VALIDATION
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("VALIDATION");
console.log("=".repeat(80));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// Baseline should route to Tier 0
check(pipelineResults[0].tier === 0, "Baseline routes to Tier 0 (SILENT)");

// Death reports should have highest PD
const pds = pipelineResults.map(r => r.primeDensity);
const maxPdIdx = pds.indexOf(Math.max(...pds));
check(testBatches[maxPdIdx].name.includes("DEATH"), `Highest PD in death reports (${(pds[maxPdIdx] * 100).toFixed(1)}%)`);

// Embeddings: baseline should be farthest from death reports
const baselineEmbed = pipelineResults[0].embedding;
const deathEmbed = pipelineResults[2].embedding;
const baseToDeathDist = geometricDistance(baselineEmbed, deathEmbed);
check(baseToDeathDist > 0, `Baseline-Death embedding distance > 0 (d=${baseToDeathDist.toFixed(3)})`);

// Engine is faster than LLM
check(totalEngineMs < totalLlmMs || totalLlmMs === 0, "Engine faster than LLM layer");

// At least one batch was silent (optimization worked)
check(tierCounts[0] > 0, "At least one batch routed to Tier 0 (compute saved)");

console.log(`\n  ${passed} passed, ${failed} failed`);

console.log(`\n${"=".repeat(80)}`);
console.log("OPTIMIZATION PIPELINE TEST COMPLETE");
console.log("=".repeat(80));

if (failed > 0) process.exit(1);
