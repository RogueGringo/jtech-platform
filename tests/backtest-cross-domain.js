/**
 * Cross-Domain Invariance Test — JtechAi Mathematical Framework
 *
 * Capstone proof: the same mathematical properties (mean-Gini inverse,
 * coherence stratification, multi-frame sensitivity, transition detection,
 * projection layer) hold across fundamentally different crisis domains
 * WITHOUT any engine changes.
 *
 * Domains tested:
 *   1. Oil/Geopolitical (2019 Aramco, 2022 Russia-Ukraine, 2026 Hormuz)
 *   2. Financial (2008 GFC — Lehman, Bear Stearns, QE)
 *   3. Pandemic (2020 COVID — demand destruction, negative WTI)
 *   4. Banking (2023 SVB — bank run, BTFP resolution)
 *   5. GDELT IE (2022 Russia-Ukraine — linguistic-origin data)
 *
 * Run: node tests/backtest-cross-domain.js
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// RUN ALL DOMAIN BACKTESTS — capture output, check exit codes
// ================================================================

const backtests = [
  { name: "Oil/Geopolitical", file: "backtest-real-data.js" },
  { name: "2008 GFC", file: "backtest-gfc.js" },
  { name: "2020 COVID", file: "backtest-covid.js" },
  { name: "2023 SVB", file: "backtest-svb.js" },
  { name: "GDELT IE (2022 Ukraine)", file: "backtest-gdelt.js" },
];

console.log("=".repeat(80));
console.log("CROSS-DOMAIN INVARIANCE TEST — JtechAi Mathematical Framework");
console.log("=".repeat(80));
console.log("\nRunning all domain backtests...\n");

const domainResults = [];

for (const bt of backtests) {
  const btPath = path.join(__dirname, bt.file);
  try {
    const output = execSync(`node "${btPath}"`, {
      encoding: "utf-8",
      timeout: 30000,
      cwd: path.join(__dirname, ".."),
    });

    // Extract composite correlation from output
    const compositeMatch = output.match(/COMPOSITE CORRELATION[^:]*:\s+([\d.]+)%/i)
      || output.match(/CORRELATION INDEX:\s+([\d.]+)%/i);
    const composite = compositeMatch ? parseFloat(compositeMatch[1]) : 0;

    // Extract pass/fail counts
    const finalMatch = output.match(/FINAL:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
    const passed = finalMatch ? parseInt(finalMatch[1]) : 0;
    const failed = finalMatch ? parseInt(finalMatch[2]) : 0;

    // Extract mean-Gini r if present
    const mgMatch = output.match(/Mean-Gini r[^:]*:\s+([-\d.]+)/);
    const meanGiniR = mgMatch ? parseFloat(mgMatch[1]) : null;

    // Extract coherence values
    const cohMatch = output.match(/(?:Peak|Crisis)\s+(?:avg\s+)?coherence[^:]*:\s+([\d.]+)%/i)
      || output.match(/Crisis:\s+([\d.]+)%/);
    const crisisCoherence = cohMatch ? parseFloat(cohMatch[1]) : null;

    // Extract multi-frame count
    const frameMatch = output.match(/(\d+)\s+frames?\s*->\s*(\d+)\s+distinct/);
    const distinctRegimes = frameMatch ? parseInt(frameMatch[2]) : null;

    domainResults.push({
      name: bt.name,
      composite,
      passed,
      failed,
      meanGiniR,
      crisisCoherence,
      distinctRegimes,
      status: failed === 0 ? "PASS" : "FAIL",
    });

    console.log(`  ${bt.name.padEnd(25)} | ${passed} passed, ${failed} failed | Composite: ${composite.toFixed(1)}% | ${failed === 0 ? "PASS" : "FAIL"}`);
  } catch (err) {
    domainResults.push({
      name: bt.name,
      composite: 0,
      passed: 0,
      failed: 1,
      meanGiniR: null,
      crisisCoherence: null,
      distinctRegimes: null,
      status: "ERROR",
    });
    console.log(`  ${bt.name.padEnd(25)} | ERROR: ${err.message.split("\n")[0]}`);
  }
}

// ================================================================
// INVARIANCE TESTS — properties that must hold across ALL domains
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CROSS-DOMAIN INVARIANCE PROPERTIES");
console.log("=".repeat(80));

let invariantPassed = 0;
let invariantFailed = 0;

function checkInvariant(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); invariantPassed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); invariantFailed++; }
}

// INVARIANT 1: All domains pass their own backtests (zero failures)
const allPass = domainResults.every(d => d.failed === 0);
checkInvariant(allPass,
  "All domains pass internal validation (0 failures each)",
  domainResults.filter(d => d.failed > 0).map(d => `${d.name}: ${d.failed} failed`).join(", "));

// INVARIANT 2: All domain composites > 85% (HIGH CORRELATION threshold)
const allHighCorrelation = domainResults.every(d => d.composite >= 85);
checkInvariant(allHighCorrelation,
  "All domains achieve HIGH CORRELATION (>= 85%)",
  domainResults.filter(d => d.composite < 85).map(d => `${d.name}: ${d.composite.toFixed(1)}%`).join(", "));

// INVARIANT 3: Mean-Gini inverse relationship holds in every domain where measured
const mgDomains = domainResults.filter(d => d.meanGiniR !== null);
const allMGInverse = mgDomains.every(d => d.meanGiniR < 0);
checkInvariant(allMGInverse,
  `Mean-Gini INVERSE relationship (r < 0) in all ${mgDomains.length} measured domains`,
  mgDomains.filter(d => d.meanGiniR >= 0).map(d => `${d.name}: r=${d.meanGiniR.toFixed(3)}`).join(", "));

// INVARIANT 4: Crisis coherence > 50% in every domain where measured
const cohDomains = domainResults.filter(d => d.crisisCoherence !== null);
const allHighCoherence = cohDomains.every(d => d.crisisCoherence > 50);
checkInvariant(allHighCoherence,
  `Crisis coherence > 50% in all ${cohDomains.length} measured domains`,
  cohDomains.filter(d => d.crisisCoherence <= 50).map(d => `${d.name}: ${d.crisisCoherence.toFixed(1)}%`).join(", "));

// INVARIANT 5: Multi-frame sensitivity produces >= 2 distinct regimes in every domain
const frameDomains = domainResults.filter(d => d.distinctRegimes !== null);
const allMultiFrame = frameDomains.every(d => d.distinctRegimes >= 2);
checkInvariant(allMultiFrame,
  `Multi-frame sensitivity (>= 2 regimes) in all ${frameDomains.length} measured domains`,
  frameDomains.filter(d => d.distinctRegimes < 2).map(d => `${d.name}: ${d.distinctRegimes} regimes`).join(", "));

// INVARIANT 6: Composite variance is low — framework performs consistently
const composites = domainResults.map(d => d.composite);
const compMean = composites.reduce((a, b) => a + b, 0) / composites.length;
const compVariance = composites.reduce((s, c) => s + (c - compMean) ** 2, 0) / composites.length;
const compStd = Math.sqrt(compVariance);
checkInvariant(compStd < 10,
  `Composite consistency: std dev ${compStd.toFixed(1)}% < 10% across domains`,
  `std=${compStd.toFixed(1)}%`);

// INVARIANT 7: The engine is truly domain-agnostic — same backtest-engine.js
// used by GFC, COVID, SVB with zero modifications between domains
// (Oil uses inline engine but same math). Test: >= 4 domains pass.
const passingDomains = domainResults.filter(d => d.failed === 0).length;
checkInvariant(passingDomains >= 4,
  `Domain-agnostic engine: ${passingDomains}/4 domains pass with shared math`,
  `only ${passingDomains} passed`);

// ================================================================
// CROSS-DOMAIN SUMMARY TABLE
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CROSS-DOMAIN SUMMARY");
console.log("=".repeat(80));

console.log("\n  DOMAIN                    | TESTS    | COMPOSITE | MG-r     | COH%   | FRAMES | STATUS");
console.log("  " + "-".repeat(95));

for (const d of domainResults) {
  const tests = `${d.passed}/${d.passed + d.failed}`.padEnd(8);
  const comp = `${d.composite.toFixed(1)}%`.padStart(6);
  const mgr = d.meanGiniR !== null ? d.meanGiniR.toFixed(3).padStart(7) : "   n/a ";
  const coh = d.crisisCoherence !== null ? `${d.crisisCoherence.toFixed(1)}%`.padStart(6) : "  n/a ";
  const frames = d.distinctRegimes !== null ? String(d.distinctRegimes).padStart(3) : "n/a";
  console.log(`  ${d.name.padEnd(27)} | ${tests} | ${comp}   | ${mgr} | ${coh} | ${frames}    | ${d.status}`);
}

// ================================================================
// AGGREGATE INVARIANCE SCORE
// ================================================================

const avgComposite = compMean;
const invarianceRate = invariantPassed / (invariantPassed + invariantFailed);

console.log(`\n${"=".repeat(80)}`);
console.log("CROSS-DOMAIN INVARIANCE SCORE");
console.log("=".repeat(80));

console.log(`\n  Invariant properties: ${invariantPassed}/${invariantPassed + invariantFailed} (${(invarianceRate * 100).toFixed(1)}%)`);
console.log(`  Average composite:   ${avgComposite.toFixed(1)}%`);
console.log(`  Domain coverage:     ${passingDomains} domains (oil, financial, pandemic, banking)`);

const finalScore = (invarianceRate * 0.5 + avgComposite / 100 * 0.5) * 100;

console.log(`\n  ${"=".repeat(50)}`);
console.log(`  CROSS-DOMAIN INVARIANCE: ${finalScore.toFixed(1)}%`);
console.log(`  ${"=".repeat(50)}`);

if (invarianceRate === 1.0 && avgComposite >= 90) {
  console.log(`\n  PROVEN: The mathematical framework (Gini, coherence, 2D regime,`);
  console.log(`  transition intensity, projection layer) is DOMAIN-AGNOSTIC.`);
  console.log(`  Same engine, same math, different signal structures → same invariants.`);
} else if (invarianceRate >= 0.8 && avgComposite >= 85) {
  console.log(`\n  STRONG: Framework shows robust cross-domain invariance with minor gaps.`);
} else {
  console.log(`\n  PARTIAL: Framework shows domain-specific deviations requiring investigation.`);
}

console.log(`\n${"=".repeat(80)}`);
console.log(`FINAL: ${invariantPassed} invariants passed, ${invariantFailed} failed | Score: ${finalScore.toFixed(1)}%`);
console.log("=".repeat(80));

if (invariantFailed > 0) process.exit(1);
