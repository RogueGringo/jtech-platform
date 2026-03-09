// tests/test-topology-pipeline.js
/**
 * INTEGRATION: Full Topological Intelligence Pipeline
 *
 * Real disaster messages -> Layer 0 (feature map) -> Layer 1 (homology)
 * Plus: Layer -1 (Zipf) on raw text
 *
 * Validates:
 * - R^8 feature vectors extracted from real batches
 * - beta_0 and beta_1 computed on the point cloud
 * - Zipf anomaly detects crisis vs baseline
 * - Geometric relationships hold (no hardcoded values)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { crisisTextToSignals } from "../src/adapters/crisisfacts-adapter.js";
import { computeGini, computeMeanSeverity, computeCrossCoherence, classifyRegime } from "./lib/backtest-engine.js";
import { computePropagationCapacity, computeDissolutionRate } from "../src/engine/projection.js";
import { persistentHomology } from "../src/engine/homology.js";
import { computeZipfBaseline, detectAnomaly } from "../src/engine/zipf.js";
import config from "../src/domains/crisisfacts-ie/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THRESHOLDS = config.severityThresholds;
const CATEGORY_KEYS = Object.keys(config.categories);

// ================================================================
// LOAD DATA
// ================================================================

const csvPath = path.join(__dirname, "data", "disaster-response", "messages.csv");
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.trim().split("\n");
const header = lines[0].split(",").map(h => h.trim());

function parseCSVLine(line) {
  const fields = []; let current = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { fields.push(current.trim()); current = ""; continue; }
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

console.log("=".repeat(70));
console.log("INTEGRATION: Full Topological Intelligence Pipeline");
console.log("=".repeat(70));
console.log(`  ${rows.length} real disaster messages loaded`);

// ================================================================
// BUILD R^8 POINT CLOUD FROM BATCHES
// ================================================================

// Create trajectory: baseline -> moderate -> severe -> death reports
const baseline = rows.filter(r => r.related === "0").slice(0, 1000);
const moderate = rows.filter(r => r.floods === "1" || r.storm === "1").slice(0, 1000);
const severe = rows.filter(r => r.search_and_rescue === "1" || r.medical_help === "1").slice(0, 1000);
const critical = rows.filter(r => r.death === "1");

const batchGroups = [
  { label: "baseline", msgs: baseline },
  { label: "moderate", msgs: moderate },
  { label: "severe", msgs: severe },
  { label: "critical", msgs: critical },
];

const BATCH_SIZE = 200;
const featureVectors = [];
const coherenceHistory = [];

console.log("\n  Extracting R^8 feature vectors from real message batches:");

for (const group of batchGroups) {
  for (let i = 0; i < group.msgs.length; i += BATCH_SIZE) {
    const batch = group.msgs.slice(i, i + BATCH_SIZE);
    if (batch.length < 50) continue; // skip tiny batches

    const records = batch.map(m => ({ text: m.message }));
    const result = crisisTextToSignals(records, THRESHOLDS);

    if (result.signals.length === 0) continue;

    const gini = computeGini(result.signals);
    const mean = computeMeanSeverity(result.signals);
    const coherence = computeCrossCoherence(result.signals, CATEGORY_KEYS);
    coherenceHistory.push(coherence);
    const propCap = computePropagationCapacity(result.signals, CATEGORY_KEYS);
    const dissRate = coherenceHistory.length >= 2
      ? computeDissolutionRate(coherenceHistory.slice(-5))
      : 0;

    // R^8 feature vector
    const vec = [
      result.primeDensity,
      result.dissolutionRate,
      result.entropy,
      gini,
      mean,
      coherence / 100, // normalize to [0,1]
      propCap.aggregate,
      dissRate,
    ];

    featureVectors.push({ vec, label: group.label });
    console.log(
      `    ${group.label.padEnd(10)} batch ${Math.floor(i / BATCH_SIZE)}: ` +
      `PD=${(vec[0] * 100).toFixed(1)}% G=${vec[3].toFixed(3)} mean=${vec[4].toFixed(2)}`
    );
  }
}

console.log(`\n  Total R^8 points: ${featureVectors.length}`);

// ================================================================
// LAYER 1: PERSISTENT HOMOLOGY
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log("LAYER 1: Persistent Homology on R^8 Point Cloud");
console.log("=".repeat(70));

const points = featureVectors.map(fv => fv.vec);
const start = performance.now();
const topo = persistentHomology(points, 1);
const topoMs = performance.now() - start;

console.log(`\n  Computed in ${topoMs.toFixed(1)}ms`);
console.log(`  beta_0 barcode: ${topo.b0.length} features`);
console.log(`  beta_1 barcode: ${topo.b1.length} features`);
console.log(`  Onset scale: ${topo.onsetScale.toFixed(4)}`);
console.log(`  Max beta_0 persistence: ${topo.maxPersistence.toFixed(4)}`);

if (topo.b1.length > 0) {
  console.log(`\n  beta_1 cycles detected:`);
  for (const bar of topo.b1.slice(0, 5)) {
    console.log(`    birth=${bar.birth.toFixed(4)} death=${bar.death === Infinity ? "inf" : bar.death.toFixed(4)} persistence=${(bar.death === Infinity ? "inf" : (bar.death - bar.birth).toFixed(4))}`);
  }
}

// ================================================================
// LAYER -1: ZIPF ANOMALY
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log("LAYER -1: Zipf Anomaly Detection");
console.log("=".repeat(70));

const baseTokens = baseline.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);
const crisisTokens = critical.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);

const baseZipf = computeZipfBaseline(baseTokens);
const crisisAnomaly = detectAnomaly(crisisTokens, baseZipf);

console.log(`  Baseline: ${baseTokens.length} tokens, alpha=${baseZipf.alpha.toFixed(3)}`);
console.log(`  Crisis D_KL: ${crisisAnomaly.dKL.toFixed(4)}`);
console.log(`  Spike: ${crisisAnomaly.spike}`);
console.log(`  Emergent primes: [${crisisAnomaly.emergentPrimes.slice(0, 15).join(", ")}]`);

// ================================================================
// GEOMETRIC VALIDATION
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log("GEOMETRIC VALIDATION -- Real Topological Invariants");
console.log("=".repeat(70));

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// beta_0 axioms
check(topo.b0.length === points.length,
  `beta_0 count equals point count: ${topo.b0.length} = ${points.length}`);
check(topo.b0.filter(b => b.death === Infinity).length === 1,
  "Exactly one infinite beta_0 bar (final connected component)");

// beta_1 exists or doesn't -- but report it
console.log(`  INFO: beta_1 features found: ${topo.b1.length}`);

// Speed constraint
check(topoMs < 5000, `Topology computed in < 5s: ${topoMs.toFixed(1)}ms`);

// Onset scale is finite (points DO connect at some epsilon)
check(topo.onsetScale < Infinity, `Onset scale is finite: ${topo.onsetScale.toFixed(4)}`);

// Layer -1: crisis diverges more than baseline
const baselineAnomaly = detectAnomaly(baseTokens, baseZipf);
check(crisisAnomaly.dKL > baselineAnomaly.dKL,
  `Crisis D_KL (${crisisAnomaly.dKL.toFixed(4)}) > baseline D_KL (${baselineAnomaly.dKL.toFixed(4)})`);

// Layer -1: crisis produces emergent primes
check(crisisAnomaly.emergentPrimes.length > 0,
  `Emergent primes discovered: ${crisisAnomaly.emergentPrimes.length} words`);

// Layer -1: spike fires on crisis
check(crisisAnomaly.spike, "Zipf spike fires on death-report text");

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
console.log("=".repeat(70));
if (failed > 0) process.exit(1);
