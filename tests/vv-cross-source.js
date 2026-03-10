/**
 * V&V Cross-Source Coherence — Statistical Audit Task 6
 *
 * Tests the claim: GDELT linguistic events and FRED oil prices produce
 * correlated regimes on the same event (Ukraine 2022).
 * Original backtest reported r = 0.802 for mean-Brent correlation.
 *
 * Statistical tests at alpha = 0.001:
 *   1. Pearson CI (Fisher z): does the 99.9% CI exclude 0?
 *   2. Permutation test (B=10000): does shuffling temporal alignment
 *      destroy the correlation? p < 0.001 required.
 *
 * Correlations tested:
 *   - GDELT event volume vs Brent price
 *   - GDELT avg tone vs Brent price
 *   - GDELT event volume vs OVX (oil volatility index)
 *
 * Data sources:
 *   - GDELT: tests/data/2022-gdelt-ukraine/ukraine-events.csv
 *   - FRED:  tests/data/2022-russia-ukraine.csv
 *
 * Composite verdict: CONFIRMED / INCONCLUSIVE / REJECTED
 * All outcomes are valid V&V — never exit(1).
 *
 * Run: node tests/vv-cross-source.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readCSV, pearsonR } from "./lib/backtest-engine.js";
import { pearsonCI, permutationTest } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALPHA = 0.001;
const PERM_B = 10000;

const GDELT_PATH = path.join(__dirname, "data", "2022-gdelt-ukraine", "ukraine-events.csv");
const FRED_PATH = path.join(__dirname, "data", "2022-russia-ukraine.csv");

// ================================================================
// GUARD: Check data files exist
// ================================================================

if (!fs.existsSync(GDELT_PATH)) {
  console.log("SKIP: GDELT data not found at", GDELT_PATH);
  process.exit(0);
}
if (!fs.existsSync(FRED_PATH)) {
  console.log("SKIP: FRED data not found at", FRED_PATH);
  process.exit(0);
}

console.log("=".repeat(80));
console.log("V&V CROSS-SOURCE COHERENCE — Statistical Audit Task 6");
console.log("Claim: GDELT linguistic events and FRED oil prices produce");
console.log("       correlated regimes on Ukraine 2022 (original r = 0.802)");
console.log("Alpha = 0.001 (99.9% confidence)");
console.log("=".repeat(80));

// ================================================================
// STEP 1: Load and parse both datasets
// ================================================================

console.log("\n" + "-".repeat(80));
console.log("STEP 1: Load data sources");
console.log("-".repeat(80));

const gdeltRows = readCSV(GDELT_PATH);
const fredRows = readCSV(FRED_PATH);

console.log(`  GDELT: ${gdeltRows.length} daily records (date, volume, avg_tone)`);
console.log(`  FRED:  ${fredRows.length} trading day records (date, brent, wti, ovx)`);

// ================================================================
// STEP 2: Find overlapping dates and build aligned arrays
// ================================================================

console.log("\n" + "-".repeat(80));
console.log("STEP 2: Date alignment");
console.log("-".repeat(80));

const gdeltByDate = new Map();
for (const row of gdeltRows) {
  if (row.date) gdeltByDate.set(row.date, row);
}

const fredByDate = new Map();
for (const row of fredRows) {
  if (row.date && row.brent !== null) fredByDate.set(row.date, row);
}

const overlapDates = [...gdeltByDate.keys()]
  .filter(d => fredByDate.has(d))
  .sort();

console.log(`  GDELT unique dates: ${gdeltByDate.size}`);
console.log(`  FRED unique dates:  ${fredByDate.size}`);
console.log(`  Overlapping dates:  ${overlapDates.length}`);
console.log(`  Date range:         ${overlapDates[0]} to ${overlapDates[overlapDates.length - 1]}`);

if (overlapDates.length < 20) {
  console.log(`\n  INCONCLUSIVE: Only ${overlapDates.length} overlapping dates (need >= 20)`);
  console.log("  Insufficient data for meaningful cross-source correlation.");
  process.exit(0);
}

// Build aligned arrays, filtering out rows with null/zero/missing values
const aligned = { dates: [], gdeltVolume: [], gdeltTone: [], fredBrent: [], fredOvx: [] };

for (const d of overlapDates) {
  const g = gdeltByDate.get(d);
  const f = fredByDate.get(d);

  // Skip rows with missing values in core fields
  if (g.volume === null || g.volume === 0) continue;
  if (g.avg_tone === null) continue;
  if (f.brent === null || f.brent === 0) continue;

  aligned.dates.push(d);
  aligned.gdeltVolume.push(g.volume);
  aligned.gdeltTone.push(g.avg_tone);
  aligned.fredBrent.push(f.brent);
  aligned.fredOvx.push(f.ovx !== null ? f.ovx : NaN);
}

const n = aligned.dates.length;
console.log(`  Valid aligned pairs: ${n} (after filtering nulls/zeros)`);

if (n < 20) {
  console.log(`\n  INCONCLUSIVE: Only ${n} valid aligned pairs (need >= 20)`);
  process.exit(0);
}

// Build OVX-aligned arrays (may have NaN entries)
const ovxValid = { xs: [], ys: [] };
for (let i = 0; i < n; i++) {
  if (!isNaN(aligned.fredOvx[i]) && aligned.fredOvx[i] !== 0) {
    ovxValid.xs.push(aligned.gdeltVolume[i]);
    ovxValid.ys.push(aligned.fredOvx[i]);
  }
}

// ================================================================
// STEP 3: Compute raw correlations
// ================================================================

console.log("\n" + "-".repeat(80));
console.log("STEP 3: Raw correlations");
console.log("-".repeat(80));

const volBrentR = pearsonR(aligned.gdeltVolume, aligned.fredBrent);
const toneBrentR = pearsonR(aligned.gdeltTone, aligned.fredBrent);

console.log(`  GDELT volume vs Brent:   r = ${volBrentR.toFixed(4)}  (n=${n})`);
console.log(`  GDELT tone vs Brent:     r = ${toneBrentR.toFixed(4)}  (n=${n})`);

const hasOvx = ovxValid.xs.length >= 20;
let volOvxR = NaN;
if (hasOvx) {
  volOvxR = pearsonR(ovxValid.xs, ovxValid.ys);
  console.log(`  GDELT volume vs OVX:     r = ${volOvxR.toFixed(4)}  (n=${ovxValid.xs.length})`);
} else {
  console.log(`  GDELT volume vs OVX:     SKIP (only ${ovxValid.xs.length} valid OVX values)`);
}

// ================================================================
// STEP 4: Statistical tests — volume vs Brent
// ================================================================

console.log("\n" + "-".repeat(80));
console.log("STEP 4: Statistical tests — GDELT volume vs Brent");
console.log("-".repeat(80));

let totalTests = 0;
let totalPass = 0;

function testCorrelation(label, xs, ys, r, sampleN) {
  console.log(`\n  --- ${label} (r=${r.toFixed(4)}, n=${sampleN}) ---`);

  // Test A: Pearson CI via Fisher z-transform
  console.log("  Test A: Fisher z 99.9% CI");
  const ci = pearsonCI(r, sampleN, ALPHA);
  const ciExcludes0 = (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0);

  console.log(`    99.9% CI = [${ci.lo.toFixed(4)}, ${ci.hi.toFixed(4)}]`);
  console.log(`    Excludes 0: ${ciExcludes0 ? "YES" : "NO"}`);
  console.log(`    Verdict: ${ciExcludes0 ? "PASS" : "FAIL"}`);

  totalTests++;
  if (ciExcludes0) totalPass++;

  // Test B: Permutation test
  console.log("  Test B: Permutation test (B=10000)");
  console.log("    H0: temporal alignment is irrelevant (shuffled r ~ observed r)");
  console.log("    H1: temporal alignment encodes real structure");

  const perm = permutationTest(xs, ys, pearsonR, PERM_B);
  const permPass = perm.p < ALPHA;

  console.log(`    Observed |r|  = ${perm.observed.toFixed(4)}`);
  console.log(`    p-value       = ${perm.p < 0.0001 ? perm.p.toExponential(4) : perm.p.toFixed(4)}`);
  console.log(`    alpha         = ${ALPHA}`);
  console.log(`    Verdict: ${permPass ? "PASS — shuffling destroys coherence" : "FAIL — cannot reject random alignment"}`);

  totalTests++;
  if (permPass) totalPass++;

  // Combined per-pair verdict
  const pairVerdict = ciExcludes0 && permPass ? "CONFIRMED" : !ciExcludes0 && !permPass ? "REJECTED" : "INCONCLUSIVE";
  console.log(`  Pair verdict: ${pairVerdict}`);

  return { ciExcludes0, permPass, pairVerdict, ci, perm };
}

// --- Correlation 1: GDELT volume vs Brent ---
const volBrentResult = testCorrelation(
  "GDELT volume vs Brent",
  aligned.gdeltVolume, aligned.fredBrent,
  volBrentR, n
);

// ================================================================
// STEP 5: Statistical tests — tone vs Brent
// ================================================================

console.log("\n" + "-".repeat(80));
console.log("STEP 5: Statistical tests — GDELT tone vs Brent");
console.log("-".repeat(80));

const toneBrentResult = testCorrelation(
  "GDELT tone vs Brent",
  aligned.gdeltTone, aligned.fredBrent,
  toneBrentR, n
);

// ================================================================
// STEP 6: Statistical tests — volume vs OVX (if data sufficient)
// ================================================================

let volOvxResult = null;
if (hasOvx) {
  console.log("\n" + "-".repeat(80));
  console.log("STEP 6: Statistical tests — GDELT volume vs OVX");
  console.log("-".repeat(80));

  volOvxResult = testCorrelation(
    "GDELT volume vs OVX",
    ovxValid.xs, ovxValid.ys,
    volOvxR, ovxValid.xs.length
  );
} else {
  console.log("\n" + "-".repeat(80));
  console.log("STEP 6: SKIP — insufficient OVX data");
  console.log("-".repeat(80));
}

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("V&V CROSS-SOURCE COHERENCE — COMPOSITE VERDICT");
console.log("=".repeat(80));

console.log(`\n  Tests passed: ${totalPass}/${totalTests}`);

// Summary table
console.log("\n  Pair results:");
console.log(`    GDELT volume vs Brent:  ${volBrentResult.pairVerdict}`);
console.log(`      CI=[${volBrentResult.ci.lo.toFixed(4)}, ${volBrentResult.ci.hi.toFixed(4)}]  p=${volBrentResult.perm.p < 0.0001 ? volBrentResult.perm.p.toExponential(4) : volBrentResult.perm.p.toFixed(4)}`);
console.log(`    GDELT tone vs Brent:    ${toneBrentResult.pairVerdict}`);
console.log(`      CI=[${toneBrentResult.ci.lo.toFixed(4)}, ${toneBrentResult.ci.hi.toFixed(4)}]  p=${toneBrentResult.perm.p < 0.0001 ? toneBrentResult.perm.p.toExponential(4) : toneBrentResult.perm.p.toFixed(4)}`);
if (volOvxResult) {
  console.log(`    GDELT volume vs OVX:    ${volOvxResult.pairVerdict}`);
  console.log(`      CI=[${volOvxResult.ci.lo.toFixed(4)}, ${volOvxResult.ci.hi.toFixed(4)}]  p=${volOvxResult.perm.p < 0.0001 ? volOvxResult.perm.p.toExponential(4) : volOvxResult.perm.p.toFixed(4)}`);
}

// Verdict logic: volume-Brent is the primary claim (r=0.802)
// CONFIRMED = primary pair CI excludes 0 AND permutation p < 0.001
// REJECTED = primary pair fails both tests
// INCONCLUSIVE = mixed results
let verdict;
if (volBrentResult.ciExcludes0 && volBrentResult.permPass) {
  verdict = "CONFIRMED";
} else if (!volBrentResult.ciExcludes0 && !volBrentResult.permPass) {
  verdict = "REJECTED";
} else {
  verdict = "INCONCLUSIVE";
}

console.log(`\n  Primary claim: GDELT volume vs Brent r = ${volBrentR.toFixed(4)} (original = 0.802)`);
console.log(`  Aligned sample size: n = ${n}`);
console.log(`\n  VERDICT: ${verdict} at alpha = ${ALPHA}`);

if (verdict === "CONFIRMED") {
  console.log("  Cross-source temporal coherence is statistically real.");
  console.log("  GDELT linguistic events and FRED oil prices encode the same crisis structure.");
  console.log("  Shuffling temporal alignment destroys the correlation — it is not a statistical artifact.");
} else if (verdict === "INCONCLUSIVE") {
  console.log("  Partial evidence for cross-source coherence but not all tests pass.");
  console.log("  Temporal alignment may contain real signal that needs more data to confirm.");
} else {
  console.log("  No statistical evidence for cross-source coherence at this alpha.");
  console.log("  The original r = 0.802 claim does not survive rigorous V&V.");
}

console.log("\n" + "=".repeat(80));
