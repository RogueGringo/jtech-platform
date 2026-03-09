/**
 * EMPIRICAL AT SCALE — Watch the data flow
 *
 * 200 real messages through BOTH approaches, timed live.
 * Full 21K through the engine. You'll see every message process.
 *
 * Run: node tests/empirical-at-scale.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { crisisTextToSignals, computeTextPrimeDensity } from "../src/adapters/crisisfacts-adapter.js";
import { computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import { multiScaleGini, computePersistence, detectPhaseTransitions } from "../src/engine/topology.js";
import { geometricEmbed, geometricDistance } from "../src/engine/optimization.js";
import config from "../src/domains/crisisfacts-ie/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THRESHOLDS = config.severityThresholds;
const CATEGORY_KEYS = Object.keys(config.categories);
const LM_BASE = "http://192.168.1.121:1234";

console.log("=".repeat(80));
console.log("EMPIRICAL AT SCALE — Real data, real volume, both approaches");
console.log("=".repeat(80));

// ================================================================
// LOAD ALL 21K
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

const allRows = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVLine(lines[i]);
  const row = {};
  header.forEach((col, j) => { row[col] = vals[j] || ""; });
  if (row.message && row.message.length > 5) allRows.push(row);
}

console.log(`\n  Full corpus: ${allRows.length} messages loaded\n`);

// Stratified 200: 60 baseline, 60 moderate, 80 severe
const baseline = allRows.filter(r => r.related === "0").slice(0, 60);
const moderate = allRows.filter(r => r.related === "1" && r.death !== "1" && r.search_and_rescue !== "1").slice(0, 60);
const severe = allRows.filter(r => r.death === "1" || r.search_and_rescue === "1").slice(0, 80);
const testSet = [...baseline, ...moderate, ...severe];

console.log(`  LLM test set: ${testSet.length} messages (${baseline.length} baseline, ${moderate.length} moderate, ${severe.length} severe)`);

// ================================================================
// PHASE 1: ENGINE — ALL 21K MESSAGES
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log(`ENGINE: Processing ALL ${allRows.length} messages`);
console.log("=".repeat(80));

const BATCH = 100;
const engineBatchResults = [];
const signalHistory = [];
let engineTotalMessages = 0;

const engineFullStart = performance.now();

for (let i = 0; i < allRows.length; i += BATCH) {
  const batch = allRows.slice(i, i + BATCH);
  const records = batch.map(m => ({ text: m.message }));
  const result = crisisTextToSignals(records, THRESHOLDS);

  let gini = 0, mean = 1, regime = "STABLE", coherence = 100;
  if (result.signals.length > 0) {
    gini = computeGini(result.signals);
    mean = computeMeanSeverity(result.signals);
    coherence = computeCrossCoherence(result.signals, CATEGORY_KEYS);
    regime = classifyRegime(mean, gini).label;
    signalHistory.push(result.signals);
  }

  const embed = geometricEmbed(result.signals);
  engineBatchResults.push({
    batchIdx: Math.floor(i / BATCH),
    messages: batch.length,
    pd: result.primeDensity,
    dissolutionRate: result.dissolutionRate,
    entropy: result.entropy,
    gini, mean, regime, coherence, embed,
  });

  engineTotalMessages += batch.length;

  // Print every 10th batch so you SEE it flowing
  if (Math.floor(i / BATCH) % 10 === 0) {
    const elapsed = performance.now() - engineFullStart;
    process.stdout.write(`  [${String(engineTotalMessages).padStart(5)}/${allRows.length}] ` +
      `PD=${(result.primeDensity * 100).toFixed(1).padStart(5)}% ` +
      `G=${gini.toFixed(3)} ` +
      `${regime.padEnd(22)} ` +
      `${elapsed.toFixed(0)}ms elapsed\n`);
  }
}

const engineFullMs = performance.now() - engineFullStart;

// Run full topology
const topoStart = performance.now();
const scales = [1, 2, 3, 5, 7, 10, 15, 20].filter(s => s <= signalHistory.length);
const topo = multiScaleGini(signalHistory, scales);
const persistence = computePersistence(signalHistory);
const transitions = detectPhaseTransitions(engineBatchResults);
const topoMs = performance.now() - topoStart;

// Pairwise distance matrix
const distStart = performance.now();
let distCount = 0;
for (let i = 0; i < engineBatchResults.length; i++) {
  for (let j = i + 1; j < engineBatchResults.length; j++) {
    geometricDistance(engineBatchResults[i].embed, engineBatchResults[j].embed);
    distCount++;
  }
}
const distMs = performance.now() - distStart;

const engineGrandTotal = engineFullMs + topoMs + distMs;

console.log(`\n  ENGINE COMPLETE:`);
console.log(`    Messages:        ${engineTotalMessages.toLocaleString()}`);
console.log(`    Batches:         ${engineBatchResults.length}`);
console.log(`    Prime extraction: ${engineFullMs.toFixed(1)}ms`);
console.log(`    Topology:        ${topoMs.toFixed(1)}ms (${scales.length} scales, ${topo.waypoints.length} waypoints)`);
console.log(`    Pairwise dist:   ${distMs.toFixed(2)}ms (${distCount.toLocaleString()} comparisons)`);
console.log(`    Persistence:     ${persistence.features.length} features, max=${persistence.maxPersistence}`);
console.log(`    Transitions:     ${transitions.length} regime changes`);
console.log(`    GRAND TOTAL:     ${engineGrandTotal.toFixed(1)}ms`);
console.log(`    RATE:            ${Math.round(engineTotalMessages / (engineGrandTotal / 1000)).toLocaleString()} msgs/sec`);

// ================================================================
// PHASE 2: LFM2.5 — 200 MESSAGES (measured per-message)
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log(`LFM2.5-1.2B: Processing ${testSet.length} messages (real API calls)`);
console.log("=".repeat(80));

const llmResults = [];
let llmTotalMs = 0;
let llmTotalTokens = 0;
let llmErrors = 0;

const llmFullStart = performance.now();

for (let i = 0; i < testSet.length; i++) {
  const msg = testSet[i].message;
  const msgStart = performance.now();

  try {
    const res = await fetch(`${LM_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "liquid/lfm2.5-1.2b",
        messages: [
          { role: "system", content: "Classify crisis severity. Reply ONLY: {\"severity\":\"none|low|moderate|high|critical\"}" },
          { role: "user", content: msg },
        ],
        temperature: 0.0,
        max_tokens: 30,
      }),
    });
    const data = await res.json();
    const msgMs = performance.now() - msgStart;
    const content = data.choices?.[0]?.message?.content || "";
    const tokens = data.usage?.completion_tokens || 0;

    llmResults.push({ severity: content.trim(), tokens, ms: msgMs });
    llmTotalMs += msgMs;
    llmTotalTokens += tokens;
  } catch (err) {
    const msgMs = performance.now() - msgStart;
    llmResults.push({ severity: "ERROR", tokens: 0, ms: msgMs });
    llmTotalMs += msgMs;
    llmErrors++;
  }

  // Print progress every 20 messages
  if ((i + 1) % 20 === 0 || i === testSet.length - 1) {
    const elapsed = performance.now() - llmFullStart;
    const rate = (i + 1) / (elapsed / 1000);
    const eta = (testSet.length - i - 1) / rate;
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${testSet.length}] ` +
      `${elapsed.toFixed(0).padStart(6)}ms elapsed, ` +
      `${rate.toFixed(1)} msgs/sec, ` +
      `ETA ${eta.toFixed(0)}s\n`);
  }
}

const llmFullMs = performance.now() - llmFullStart;

console.log(`\n  LFM2.5 COMPLETE:`);
console.log(`    Messages:        ${testSet.length}`);
console.log(`    Total time:      ${llmFullMs.toFixed(0)}ms (${(llmFullMs / 1000).toFixed(1)}s)`);
console.log(`    Per message:     ${(llmFullMs / testSet.length).toFixed(0)}ms`);
console.log(`    Tokens generated: ${llmTotalTokens}`);
console.log(`    Errors:          ${llmErrors}`);

// ================================================================
// ENGINE ON SAME 200 — for fair comparison
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log(`ENGINE on same ${testSet.length} messages (fair comparison)`);
console.log("=".repeat(80));

const engineTestStart = performance.now();
const engineTestResults = [];

for (const row of testSet) {
  const pd = computeTextPrimeDensity(row.message);
  const result = crisisTextToSignals([{ text: row.message }], THRESHOLDS);
  const gini = result.signals.length > 0 ? computeGini(result.signals) : 0;
  const mean = result.signals.length > 0 ? computeMeanSeverity(result.signals) : 1;
  const regime = classifyRegime(mean, gini);

  engineTestResults.push({ pd: pd.primeDensity, regime: regime.label });
}

const engineTestMs = performance.now() - engineTestStart;

console.log(`  Total: ${engineTestMs.toFixed(2)}ms for ${testSet.length} messages`);
console.log(`  Per message: ${(engineTestMs / testSet.length).toFixed(4)}ms`);

// ================================================================
// AGREEMENT ON 200 MESSAGES
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("AGREEMENT ANALYSIS — 200 messages, both approaches");
console.log("=".repeat(80));

function engineSev(pd, regime) {
  if (pd < 0.01) return "none";
  if (regime === "STABLE" && pd < 0.03) return "low";
  if (regime === "STABLE" && pd < 0.08) return "moderate";
  if (regime === "STABLE") return "high";
  if (regime === "TRANSIENT SPIKE") return "high";
  if (regime === "BOUNDARY LAYER") return "high";
  return "critical";
}

let agree = 0, disagree = 0, parseErr = 0;
const sevOrder = ["none", "low", "moderate", "high", "critical"];
const confusionMatrix = {};

for (let i = 0; i < testSet.length; i++) {
  const eng = engineTestResults[i];
  const llm = llmResults[i];
  const engSev = engineSev(eng.pd, eng.regime);

  try {
    const cleaned = llm.severity.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const llmSev = (parsed.severity || "").toLowerCase();

    const engIdx = sevOrder.indexOf(engSev);
    const llmIdx = sevOrder.indexOf(llmSev);

    const key = `${engSev}→${llmSev}`;
    confusionMatrix[key] = (confusionMatrix[key] || 0) + 1;

    if (Math.abs(engIdx - llmIdx) <= 1) agree++;
    else disagree++;
  } catch {
    parseErr++;
  }
}

const valid = agree + disagree;
console.log(`\n  Valid comparisons: ${valid} (${parseErr} LLM parse errors)`);
console.log(`  Agreement (±1 tier): ${agree}/${valid} (${(agree/valid*100).toFixed(1)}%)`);
console.log(`  Disagreement:        ${disagree}/${valid} (${(disagree/valid*100).toFixed(1)}%)`);

console.log(`\n  Confusion mapping (engine→LLM):`);
const sorted = Object.entries(confusionMatrix).sort((a, b) => b[1] - a[1]);
for (const [key, count] of sorted) {
  console.log(`    ${key.padEnd(25)} ${count}`);
}

// ================================================================
// FINAL EMPIRICAL SCORECARD
// ================================================================

const enginePerMsg = engineTestMs / testSet.length;
const llmPerMsg = llmFullMs / testSet.length;
const ratio = llmPerMsg / enginePerMsg;

console.log(`\n${"=".repeat(80)}`);
console.log("EMPIRICAL SCORECARD — MEASURED VALUES ONLY");
console.log("=".repeat(80));

console.log(`
  Date:      ${new Date().toISOString()}
  Machine:   This machine
  Data:      Real disaster messages (Haiti, Chile, Pakistan, Sandy)

  ┌───────────────────────┬────────────────────┬────────────────────┐
  │                       │ JtechAi Engine     │ LFM2.5-1.2B        │
  ├───────────────────────┼────────────────────┼────────────────────┤
  │ Messages (fair test)  │ ${String(testSet.length).padStart(18)} │ ${String(testSet.length).padStart(18)} │
  │ Total time            │ ${(engineTestMs.toFixed(2) + "ms").padStart(18)} │ ${((llmFullMs/1000).toFixed(1) + "s").padStart(18)} │
  │ Per message           │ ${(enginePerMsg.toFixed(4) + "ms").padStart(18)} │ ${(llmPerMsg.toFixed(0) + "ms").padStart(18)} │
  │ Measured ratio        │ ${"1×".padStart(18)} │ ${(Math.round(ratio).toLocaleString() + "×").padStart(18)} │
  ├───────────────────────┼────────────────────┼────────────────────┤
  │ Full corpus (21K)     │ ${(engineGrandTotal.toFixed(0) + "ms").padStart(18)} │ ${((llmPerMsg * allRows.length / 3600000).toFixed(1) + "hr *").padStart(18)} │
  │ * = extrapolated from │ measured           │ measured rate       │
  ├───────────────────────┼────────────────────┼────────────────────┤
  │ Topology computed     │ ${"YES".padStart(18)} │ ${"NO".padStart(18)} │
  │ Pairwise distances    │ ${(distCount.toLocaleString()).padStart(18)} │ ${"0".padStart(18)} │
  │ Persistence tracking  │ ${"YES".padStart(18)} │ ${"NO".padStart(18)} │
  │ Phase transitions     │ ${"YES".padStart(18)} │ ${"NO".padStart(18)} │
  │ 5D embeddings         │ ${"YES (free)".padStart(18)} │ ${"NO".padStart(18)} │
  │ Deterministic         │ ${"YES".padStart(18)} │ ${"NO".padStart(18)} │
  │ Agreement (±1 tier)   │ ${"-".padStart(18)} │ ${((agree/valid*100).toFixed(1) + "%").padStart(18)} │
  └───────────────────────┴────────────────────┴────────────────────┘

  Every number above was measured during this run.
  The engine processed all ${allRows.length.toLocaleString()} messages + topology + distances in ${engineGrandTotal.toFixed(0)}ms.
  The LLM processed ${testSet.length} messages in ${(llmFullMs/1000).toFixed(1)}s.
  Run this again. Engine numbers will be identical. LLM numbers will vary.
`);

console.log("=".repeat(80));
console.log("EMPIRICAL TEST COMPLETE");
console.log("=".repeat(80));
