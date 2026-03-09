// tests/test-zipf.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeZipfBaseline, computeKLDivergence, detectAnomaly } from "../src/engine/zipf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load real disaster messages
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

// Split: baseline (unrelated) vs crisis (death reports)
const baseline = rows.filter(r => r.related === "0").slice(0, 2000);
const crisis = rows.filter(r => r.death === "1");

console.log("=".repeat(70));
console.log("TEST: Layer -1 — Zipf Anomaly Detection");
console.log("=".repeat(70));
console.log(`  Baseline: ${baseline.length} unrelated messages`);
console.log(`  Crisis:   ${crisis.length} death-report messages`);

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// TEST 1: Zipf baseline produces valid frequency distribution
const baselineTokens = baseline.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);
const baseZipf = computeZipfBaseline(baselineTokens);
check(baseZipf.totalTokens > 0, `Baseline has tokens: ${baseZipf.totalTokens}`);
check(baseZipf.uniqueTokens > 0, `Baseline has unique tokens: ${baseZipf.uniqueTokens}`);
check(baseZipf.alpha > 0, `Zipf alpha > 0: ${baseZipf.alpha.toFixed(3)}`);

// TEST 2: KL-divergence of baseline against itself ≈ 0
const baseSelfKL = computeKLDivergence(baselineTokens, baseZipf);
check(baseSelfKL.dKL < 0.1, `Self-KL near zero: ${baseSelfKL.dKL.toFixed(4)}`);

// TEST 3: KL-divergence of crisis text against baseline > 0
const crisisTokens = crisis.map(r => r.message).join(" ").toLowerCase()
  .split(/\s+/).filter(t => t.length > 2);
const crisisKL = computeKLDivergence(crisisTokens, baseZipf);
check(crisisKL.dKL > baseSelfKL.dKL,
  `Crisis KL (${crisisKL.dKL.toFixed(4)}) > baseline self-KL (${baseSelfKL.dKL.toFixed(4)})`);

// TEST 4: Anomaly detection fires on crisis, not on baseline
const baselineAnomaly = detectAnomaly(baselineTokens, baseZipf);
const crisisAnomaly = detectAnomaly(crisisTokens, baseZipf);
check(!baselineAnomaly.spike, `No spike on baseline text`);
check(crisisAnomaly.spike, `Spike detected on crisis text`);

// TEST 5: Emergent primes are real words from crisis domain
check(crisisAnomaly.emergentPrimes.length > 0,
  `Emergent primes discovered: [${crisisAnomaly.emergentPrimes.slice(0, 10).join(", ")}]`);

// TEST 6: Geometric — crisis D_KL > baseline D_KL (directional, no hardcoded value)
check(crisisKL.dKL > baseSelfKL.dKL * 2,
  `Crisis divergence meaningfully exceeds baseline (${crisisKL.dKL.toFixed(4)} vs ${baseSelfKL.dKL.toFixed(4)})`);

console.log(`\n  RESULT: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
