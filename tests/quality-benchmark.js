/**
 * QUALITY BENCHMARK — Ground Truth Accuracy
 *
 * The disaster dataset has 36 human-annotated binary labels per message.
 * These are the GROUND TRUTH — created by trained human annotators.
 *
 * This test measures WHO IS RIGHT:
 *   - Engine (prime density → severity) vs ground truth
 *   - LFM2.5-1.2B (LLM classification) vs ground truth
 *
 * Not speed. Not agreement between them. ACCURACY against reality.
 *
 * 300 stratified messages × both approaches × ground truth comparison.
 * Every number measured. Every classification checked against human labels.
 *
 * Run: node tests/quality-benchmark.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { crisisTextToSignals, computeTextPrimeDensity } from "../src/adapters/crisisfacts-adapter.js";
import { computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import config from "../src/domains/crisisfacts-ie/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THRESHOLDS = config.severityThresholds;
const LM_BASE = "http://192.168.1.121:1234";

// ================================================================
// GROUND TRUTH DERIVATION — Human labels → severity level
// ================================================================

/**
 * Convert 36 binary human annotations to a single severity level.
 * This is the OBJECTIVE TRUTH — not a model, not an estimate.
 *
 * Hierarchy (highest match wins):
 *   critical : death=1
 *   high     : search_and_rescue=1, missing_people=1, security=1, military=1, medical_help=1
 *   moderate : floods=1, storm=1, fire=1, earthquake=1, request=1, infrastructure_related=1
 *   low      : related=1 (but no critical/high/moderate flags)
 *   none     : related=0
 */
function groundTruthSeverity(row) {
  if (row.death === "1") return "critical";
  if (row.search_and_rescue === "1" || row.missing_people === "1") return "high";
  if (row.security === "1" || row.military === "1") return "high";
  if (row.medical_help === "1" || row.medical_products === "1") return "high";
  if (row.floods === "1" || row.storm === "1" || row.fire === "1" || row.earthquake === "1") return "moderate";
  if (row.request === "1" || row.infrastructure_related === "1") return "moderate";
  if (row.aid_related === "1" || row.weather_related === "1") return "low";
  if (row.related === "1") return "low";
  return "none";
}

/**
 * Engine severity from prime density + regime classification.
 * Same logic as the engine uses in production.
 */
function engineSeverity(row) {
  const result = crisisTextToSignals([{ text: row.message }], THRESHOLDS);
  const pd = result.primeDensity;
  const dr = result.dissolutionRate;

  let gini = 0, mean = 1, regime = "STABLE";
  if (result.signals.length > 0) {
    gini = computeGini(result.signals);
    mean = computeMeanSeverity(result.signals);
    regime = classifyRegime(mean, gini).label;
  }

  // Map engine output to severity tier
  if (regime === "CRISIS CONSOLIDATION") return { severity: "critical", pd, dr, gini, mean, regime, entropy: result.entropy };
  if (regime === "BOUNDARY LAYER") return { severity: "high", pd, dr, gini, mean, regime, entropy: result.entropy };
  if (regime === "TRANSIENT SPIKE") return { severity: "moderate", pd, dr, gini, mean, regime, entropy: result.entropy };
  // STABLE regime — use PD to differentiate none/low
  if (pd < 0.005) return { severity: "none", pd, dr, gini, mean, regime, entropy: result.entropy };
  if (pd < 0.02) return { severity: "low", pd, dr, gini, mean, regime, entropy: result.entropy };
  if (pd < 0.05) return { severity: "moderate", pd, dr, gini, mean, regime, entropy: result.entropy };
  return { severity: "high", pd, dr, gini, mean, regime, entropy: result.entropy };
}

// ================================================================
// LOAD DATA + STRATIFY
// ================================================================

console.log("=".repeat(80));
console.log("QUALITY BENCHMARK — Ground Truth Accuracy");
console.log("Engine vs LFM2.5-1.2B vs Human Annotations");
console.log("=".repeat(80));

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

// Label all rows with ground truth
for (const row of allRows) {
  row._gt = groundTruthSeverity(row);
}

// Count distribution
const gtCounts = { none: 0, low: 0, moderate: 0, high: 0, critical: 0 };
for (const row of allRows) gtCounts[row._gt]++;

console.log(`\n  Full corpus: ${allRows.length} messages`);
console.log(`  Ground truth distribution:`);
for (const [level, count] of Object.entries(gtCounts)) {
  console.log(`    ${level.padEnd(10)} ${count.toLocaleString().padStart(6)} (${(count/allRows.length*100).toFixed(1)}%)`);
}

// Stratified 300: balanced across severity tiers
const SAMPLE_PER_TIER = 60;
const tiers = ["none", "low", "moderate", "high", "critical"];
const testSet = [];

for (const tier of tiers) {
  const pool = allRows.filter(r => r._gt === tier);
  // Shuffle deterministically (use index-based selection for reproducibility)
  const step = Math.max(1, Math.floor(pool.length / SAMPLE_PER_TIER));
  let count = 0;
  for (let i = 0; i < pool.length && count < SAMPLE_PER_TIER; i += step) {
    testSet.push(pool[i]);
    count++;
  }
  // If not enough, take what we have
  if (count < SAMPLE_PER_TIER) {
    for (let i = 0; i < pool.length && count < SAMPLE_PER_TIER; i++) {
      if (!testSet.includes(pool[i])) {
        testSet.push(pool[i]);
        count++;
      }
    }
  }
}

const testGtCounts = { none: 0, low: 0, moderate: 0, high: 0, critical: 0 };
for (const row of testSet) testGtCounts[row._gt]++;

console.log(`\n  Test set: ${testSet.length} messages (stratified)`);
for (const [level, count] of Object.entries(testGtCounts)) {
  console.log(`    ${level.padEnd(10)} ${String(count).padStart(3)}`);
}

// ================================================================
// PHASE 1: ENGINE — All test messages (deterministic, instant)
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log(`ENGINE: Classifying ${testSet.length} messages against ground truth`);
console.log("=".repeat(80));

const engineStart = performance.now();
const engineResults = [];

for (const row of testSet) {
  const eng = engineSeverity(row);
  engineResults.push({
    gt: row._gt,
    predicted: eng.severity,
    pd: eng.pd,
    gini: eng.gini,
    mean: eng.mean,
    regime: eng.regime,
    entropy: eng.entropy,
    message: row.message.slice(0, 80),
  });
}

const engineMs = performance.now() - engineStart;
console.log(`  Completed in ${engineMs.toFixed(1)}ms (${(engineMs / testSet.length).toFixed(3)}ms/msg)`);

// ================================================================
// PHASE 2: LFM2.5 — Same messages through LLM
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log(`LFM2.5-1.2B: Classifying ${testSet.length} messages against ground truth`);
console.log("=".repeat(80));

const llmResults = [];
let llmErrors = 0;
const llmStart = performance.now();

for (let i = 0; i < testSet.length; i++) {
  const msg = testSet[i].message;
  const gt = testSet[i]._gt;

  try {
    const res = await fetch(`${LM_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "liquid/lfm2.5-1.2b",
        messages: [
          {
            role: "system",
            content: `Classify this disaster message severity. Reply ONLY with one JSON object: {"severity":"none|low|moderate|high|critical"}
Rules:
- none: not crisis-related
- low: related but no immediate danger
- moderate: active weather/infrastructure threat
- high: medical emergency, missing persons, security threat
- critical: confirmed deaths, mass casualties`
          },
          { role: "user", content: msg },
        ],
        temperature: 0.0,
        max_tokens: 30,
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse LLM response
    let predicted = "none";
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      predicted = (parsed.severity || "none").toLowerCase();
      if (!tiers.includes(predicted)) predicted = "none";
    } catch {
      // Try direct extraction
      const match = content.toLowerCase().match(/(none|low|moderate|high|critical)/);
      if (match) predicted = match[1];
      else { llmErrors++; predicted = "PARSE_ERROR"; }
    }

    llmResults.push({ gt, predicted, raw: content.trim().slice(0, 60) });
  } catch (err) {
    llmResults.push({ gt, predicted: "ERROR", raw: err.message.slice(0, 40) });
    llmErrors++;
  }

  // Progress every 30 messages
  if ((i + 1) % 30 === 0 || i === testSet.length - 1) {
    const elapsed = performance.now() - llmStart;
    const rate = (i + 1) / (elapsed / 1000);
    const eta = (testSet.length - i - 1) / rate;
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${testSet.length}] ` +
      `${elapsed.toFixed(0).padStart(6)}ms elapsed, ` +
      `${rate.toFixed(1)} msgs/sec, ` +
      `ETA ${eta.toFixed(0)}s\n`);
  }
}

const llmMs = performance.now() - llmStart;
console.log(`  Completed in ${(llmMs / 1000).toFixed(1)}s (${(llmMs / testSet.length).toFixed(0)}ms/msg)`);
console.log(`  Parse errors: ${llmErrors}`);

// ================================================================
// ACCURACY METRICS
// ================================================================

const SEV_ORDER = ["none", "low", "moderate", "high", "critical"];
const SEV_RANK = { none: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function computeMetrics(results, label) {
  let exact = 0;
  let within1 = 0;
  let valid = 0;
  let totalDist = 0;

  // Per-tier precision/recall
  const tp = {}, fp = {}, fn = {};
  for (const t of SEV_ORDER) { tp[t] = 0; fp[t] = 0; fn[t] = 0; }

  // Confusion matrix
  const confusion = {};
  for (const gt of SEV_ORDER) {
    confusion[gt] = {};
    for (const pred of SEV_ORDER) confusion[gt][pred] = 0;
  }

  for (const r of results) {
    if (r.predicted === "PARSE_ERROR" || r.predicted === "ERROR") continue;
    if (!SEV_ORDER.includes(r.predicted)) continue;
    valid++;

    const gtRank = SEV_RANK[r.gt];
    const predRank = SEV_RANK[r.predicted];
    const dist = Math.abs(gtRank - predRank);

    if (dist === 0) exact++;
    if (dist <= 1) within1++;
    totalDist += dist;

    // Confusion
    confusion[r.gt][r.predicted]++;

    // Per-tier
    if (r.gt === r.predicted) tp[r.gt]++;
    else {
      fp[r.predicted]++;
      fn[r.gt]++;
    }
  }

  // Compute per-tier P/R/F1
  const tierMetrics = {};
  for (const t of SEV_ORDER) {
    const prec = tp[t] + fp[t] > 0 ? tp[t] / (tp[t] + fp[t]) : 0;
    const rec = tp[t] + fn[t] > 0 ? tp[t] / (tp[t] + fn[t]) : 0;
    const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
    tierMetrics[t] = { precision: prec, recall: rec, f1 };
  }

  // Macro F1
  const macroF1 = Object.values(tierMetrics).reduce((s, m) => s + m.f1, 0) / SEV_ORDER.length;

  return {
    label,
    valid,
    exact, exactPct: exact / valid * 100,
    within1, within1Pct: within1 / valid * 100,
    avgDist: totalDist / valid,
    tierMetrics,
    macroF1,
    confusion,
  };
}

const engineMetrics = computeMetrics(engineResults, "JtechAi Engine");
const llmMetrics = computeMetrics(llmResults, "LFM2.5-1.2B");

// ================================================================
// RESULTS TABLE
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("GROUND TRUTH ACCURACY — WHO IS RIGHT?");
console.log("=".repeat(80));

function printMetrics(m) {
  console.log(`\n  ${m.label} (${m.valid} valid classifications):`);
  console.log(`    Exact match:    ${m.exact}/${m.valid} (${m.exactPct.toFixed(1)}%)`);
  console.log(`    Within ±1 tier: ${m.within1}/${m.valid} (${m.within1Pct.toFixed(1)}%)`);
  console.log(`    Avg distance:   ${m.avgDist.toFixed(2)} tiers from ground truth`);
  console.log(`    Macro F1:       ${(m.macroF1 * 100).toFixed(1)}%`);

  console.log(`\n    Per-tier breakdown:`);
  console.log(`    ${"Tier".padEnd(12)} ${"Prec".padStart(7)} ${"Recall".padStart(7)} ${"F1".padStart(7)}`);
  console.log(`    ${"─".repeat(35)}`);
  for (const t of SEV_ORDER) {
    const tm = m.tierMetrics[t];
    console.log(`    ${t.padEnd(12)} ${(tm.precision * 100).toFixed(1).padStart(6)}% ${(tm.recall * 100).toFixed(1).padStart(6)}% ${(tm.f1 * 100).toFixed(1).padStart(6)}%`);
  }
}

printMetrics(engineMetrics);
printMetrics(llmMetrics);

// ================================================================
// CONFUSION MATRICES
// ================================================================

function printConfusion(m) {
  console.log(`\n  ${m.label} — Confusion Matrix (rows=ground truth, cols=predicted):`);
  console.log(`    ${"".padEnd(10)} ${SEV_ORDER.map(t => t.slice(0, 5).padStart(7)).join("")}`);
  for (const gt of SEV_ORDER) {
    const cells = SEV_ORDER.map(pred => {
      const v = m.confusion[gt][pred];
      return (v > 0 ? String(v) : ".").padStart(7);
    }).join("");
    console.log(`    ${gt.padEnd(10)} ${cells}`);
  }
}

console.log(`\n${"=".repeat(80)}`);
console.log("CONFUSION MATRICES");
console.log("=".repeat(80));
printConfusion(engineMetrics);
printConfusion(llmMetrics);

// ================================================================
// HEAD-TO-HEAD: Where they disagree with ground truth
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("HEAD-TO-HEAD — Critical disagreements with ground truth");
console.log("=".repeat(80));

let engineWins = 0, llmWins = 0, bothRight = 0, bothWrong = 0;

const criticalMisses = [];

for (let i = 0; i < testSet.length; i++) {
  const gt = testSet[i]._gt;
  const eng = engineResults[i];
  const llm = llmResults[i];

  if (eng.predicted === "PARSE_ERROR" || eng.predicted === "ERROR") continue;
  if (llm.predicted === "PARSE_ERROR" || llm.predicted === "ERROR") continue;

  const engDist = Math.abs(SEV_RANK[gt] - SEV_RANK[eng.predicted]);
  const llmDist = Math.abs(SEV_RANK[gt] - (SEV_RANK[llm.predicted] ?? 0));

  if (engDist === 0 && llmDist === 0) bothRight++;
  else if (engDist < llmDist) engineWins++;
  else if (llmDist < engDist) llmWins++;
  else bothWrong++;

  // Track critical misses: ground truth is critical/high but classified as none/low
  if (SEV_RANK[gt] >= 3) {
    if (SEV_RANK[eng.predicted] <= 1 || (SEV_RANK[llm.predicted] ?? 0) <= 1) {
      criticalMisses.push({
        message: testSet[i].message.slice(0, 100),
        gt,
        engine: eng.predicted,
        llm: llm.predicted,
        enginePD: eng.pd,
      });
    }
  }
}

console.log(`\n  Both correct:     ${bothRight}`);
console.log(`  Engine closer:    ${engineWins}`);
console.log(`  LLM closer:      ${llmWins}`);
console.log(`  Both wrong:       ${bothWrong}`);

if (criticalMisses.length > 0) {
  console.log(`\n  DANGEROUS MISSES (high/critical ground truth classified as none/low):`);
  for (const miss of criticalMisses.slice(0, 10)) {
    console.log(`    GT=${miss.gt.padEnd(9)} ENG=${miss.engine.padEnd(9)} LLM=${miss.llm.padEnd(9)} PD=${(miss.enginePD * 100).toFixed(1)}%`);
    console.log(`      "${miss.message}"`);
  }
}

// ================================================================
// FINAL SCORECARD
// ================================================================

const engineRate = engineMs / testSet.length;
const llmRate = llmMs / testSet.length;

console.log(`\n${"=".repeat(80)}`);
console.log("EMPIRICAL QUALITY SCORECARD — MEASURED VALUES ONLY");
console.log("=".repeat(80));

console.log(`
  Date:      ${new Date().toISOString()}
  Data:      Real disaster messages with HUMAN ANNOTATIONS (ground truth)
  Messages:  ${testSet.length} (stratified across 5 severity tiers)

  ┌──────────────────────────┬────────────────────┬────────────────────┐
  │                          │ JtechAi Engine     │ LFM2.5-1.2B        │
  ├──────────────────────────┼────────────────────┼────────────────────┤
  │ Exact accuracy           │ ${(engineMetrics.exactPct.toFixed(1) + "%").padStart(18)} │ ${(llmMetrics.exactPct.toFixed(1) + "%").padStart(18)} │
  │ Within ±1 tier           │ ${(engineMetrics.within1Pct.toFixed(1) + "%").padStart(18)} │ ${(llmMetrics.within1Pct.toFixed(1) + "%").padStart(18)} │
  │ Macro F1                 │ ${((engineMetrics.macroF1 * 100).toFixed(1) + "%").padStart(18)} │ ${((llmMetrics.macroF1 * 100).toFixed(1) + "%").padStart(18)} │
  │ Avg tier distance        │ ${engineMetrics.avgDist.toFixed(2).padStart(18)} │ ${llmMetrics.avgDist.toFixed(2).padStart(18)} │
  ├──────────────────────────┼────────────────────┼────────────────────┤
  │ Head-to-head wins        │ ${String(engineWins).padStart(18)} │ ${String(llmWins).padStart(18)} │
  │ Both correct             │ ${String(bothRight).padStart(18)} │ ${String(bothRight).padStart(18)} │
  │ Both wrong               │ ${String(bothWrong).padStart(18)} │ ${String(bothWrong).padStart(18)} │
  ├──────────────────────────┼────────────────────┼────────────────────┤
  │ Speed                    │ ${(engineRate.toFixed(3) + "ms/msg").padStart(18)} │ ${(llmRate.toFixed(0) + "ms/msg").padStart(18)} │
  │ Speed ratio              │ ${"1×".padStart(18)} │ ${(Math.round(llmRate / engineRate).toLocaleString() + "×").padStart(18)} │
  │ Parameters               │ ${"200 words".padStart(18)} │ ${"1.2B".padStart(18)} │
  │ Deterministic            │ ${"YES".padStart(18)} │ ${"NO".padStart(18)} │
  │ Parse errors             │ ${"0".padStart(18)} │ ${String(llmErrors).padStart(18)} │
  └──────────────────────────┴────────────────────┴────────────────────┘

  Ground truth: ${testSet.length} human-annotated disaster messages.
  Every number measured during this run. No estimates. No published benchmarks.
  Run again: engine numbers identical, LLM numbers will vary.
`);

console.log("=".repeat(80));
console.log("QUALITY BENCHMARK COMPLETE");
console.log("=".repeat(80));
