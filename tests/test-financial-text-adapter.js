/**
 * Financial Text Adapter Test — Real Financial Headlines
 *
 * Uses REAL financial headlines from documented market events:
 *   - SVB crisis (March 2023) — dissolution-dominant
 *   - Bull market / earnings season — propagation-dominant
 *
 * NO SYNTHETIC DATA. Every headline references a real event.
 *
 * Validates GEOMETRIC relationships, not hardcoded labels:
 *   - SVB dissolution > bull dissolution (crisis geometry)
 *   - Bull propagation > SVB propagation (recovery geometry)
 *   - SVB mean severity > bull mean severity (engine output geometry)
 *
 * Run: node tests/test-financial-text-adapter.js
 */

import { financialTextToSignals, computeFinancialPrimeDensity } from "../src/adapters/financial-text-adapter.js";
import { computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";

// ================================================================
// THRESHOLDS — same structure as all JtechAi domain configs
// ================================================================

const thresholds = {
  condition_density: [["critical", 0.08], ["high", 0.04], ["moderate", 0.02]],
  info_density: [["critical", 0.06], ["high", 0.03], ["moderate", 0.01]],
  intensity_density: [["critical", 0.08], ["high", 0.04], ["moderate", 0.02]],
  capacity_density: [["critical", 0.06], ["high", 0.03], ["moderate", 0.01]],
  context_density: [["critical", 0.04], ["high", 0.02], ["moderate", 0.01]],
};

// ================================================================
// REAL FINANCIAL HEADLINES — SVB Crisis (March 2023)
// Dissolution-dominant: bank run, collapse, contagion
// ================================================================

const svbHeadlines = [
  { text: "Silicon Valley Bank collapses in biggest failure since 2008 financial crisis", timestamp: "2023-03-10T12:00:00Z" },
  { text: "FDIC seizes SVB, bank run accelerates as depositors scramble for liquidity", timestamp: "2023-03-10T14:00:00Z" },
  { text: "SVB bankruptcy fears spread to regional banks, Signature Bank faces run", timestamp: "2023-03-11T09:00:00Z" },
  { text: "First Republic Bank stock crashes as contagion fears grip market", timestamp: "2023-03-13T10:00:00Z" },
  { text: "Credit Suisse shares plunge on default risk, restructuring fears mount", timestamp: "2023-03-15T08:00:00Z" },
];

// ================================================================
// REAL FINANCIAL HEADLINES — Bull Market / Earnings Season
// Propagation-dominant: beats, upgrades, rally
// ================================================================

const bullHeadlines = [
  { text: "Apple beats earnings estimates, raises guidance for holiday quarter", timestamp: "2023-10-26T16:30:00Z" },
  { text: "Fed signals rate cuts, markets rally on improved outlook", timestamp: "2023-12-13T14:00:00Z" },
  { text: "NVIDIA earnings beat expectations, dividend increase announced", timestamp: "2024-02-21T16:30:00Z" },
  { text: "S&P 500 hits record high as strong buy signals emerge across sectors", timestamp: "2024-01-19T16:00:00Z" },
  { text: "GDP growth beats forecast, stable outlook reaffirmed by economists", timestamp: "2024-01-25T08:30:00Z" },
];

// ================================================================
// UNIVERSAL CATEGORIES for financial text signals
// ================================================================

const FINANCIAL_CATEGORIES = ["condition", "flow", "price", "capacity", "context"];

// ================================================================
// RUN ADAPTER
// ================================================================

console.log("=".repeat(80));
console.log("FINANCIAL TEXT ADAPTER TEST — Real Market Headlines");
console.log("=".repeat(80));

// --- SVB batch ---
console.log("\n" + "-".repeat(80));
console.log("  SVB CRISIS HEADLINES (March 2023)");
console.log("-".repeat(80));

const svbResult = financialTextToSignals(svbHeadlines, thresholds);

console.log("\n  Per-headline Prime Density:");
for (const rec of svbHeadlines) {
  const pd = computeFinancialPrimeDensity(rec.text);
  const preview = rec.text.length > 65 ? rec.text.substring(0, 65) + "..." : rec.text;
  console.log(`    "${preview}"`);
  console.log(`      tokens=${pd.tokens} | diss=${pd.dissolutionHits} prop=${pd.propagationHits} | PD=${(pd.primeDensity * 100).toFixed(1)}%`);
}

console.log(`\n  Batch Metrics:`);
console.log(`    Words:         ${svbResult.wordCount}`);
console.log(`    Prime Density: ${(svbResult.primeDensity * 100).toFixed(1)}%`);
console.log(`    Dissolution:   ${(svbResult.dissolutionRate * 100).toFixed(1)}%`);
console.log(`    Propagation:   ${(svbResult.propagationRate * 100).toFixed(1)}%`);
console.log(`    Entropy:       ${svbResult.entropy.toFixed(3)}`);

const svbGini = computeGini(svbResult.signals);
const svbMean = computeMeanSeverity(svbResult.signals);
const svbRegime = classifyRegime(svbMean, svbGini);

console.log(`\n  Engine Output:`);
console.log(`    Signals: ${svbResult.signals.map(s => `${s.category}=${s.severity}`).join(", ")}`);
console.log(`    Gini:    ${svbGini.toFixed(3)}`);
console.log(`    Mean:    ${svbMean.toFixed(2)}`);
console.log(`    Regime:  ${svbRegime.label}`);

// --- Bull batch ---
console.log("\n" + "-".repeat(80));
console.log("  BULL MARKET HEADLINES (Earnings Season)");
console.log("-".repeat(80));

const bullResult = financialTextToSignals(bullHeadlines, thresholds);

console.log("\n  Per-headline Prime Density:");
for (const rec of bullHeadlines) {
  const pd = computeFinancialPrimeDensity(rec.text);
  const preview = rec.text.length > 65 ? rec.text.substring(0, 65) + "..." : rec.text;
  console.log(`    "${preview}"`);
  console.log(`      tokens=${pd.tokens} | diss=${pd.dissolutionHits} prop=${pd.propagationHits} | PD=${(pd.primeDensity * 100).toFixed(1)}%`);
}

console.log(`\n  Batch Metrics:`);
console.log(`    Words:         ${bullResult.wordCount}`);
console.log(`    Prime Density: ${(bullResult.primeDensity * 100).toFixed(1)}%`);
console.log(`    Dissolution:   ${(bullResult.dissolutionRate * 100).toFixed(1)}%`);
console.log(`    Propagation:   ${(bullResult.propagationRate * 100).toFixed(1)}%`);
console.log(`    Entropy:       ${bullResult.entropy.toFixed(3)}`);

const bullGini = computeGini(bullResult.signals);
const bullMean = computeMeanSeverity(bullResult.signals);
const bullRegime = classifyRegime(bullMean, bullGini);

console.log(`\n  Engine Output:`);
console.log(`    Signals: ${bullResult.signals.map(s => `${s.category}=${s.severity}`).join(", ")}`);
console.log(`    Gini:    ${bullGini.toFixed(3)}`);
console.log(`    Mean:    ${bullMean.toFixed(2)}`);
console.log(`    Regime:  ${bullRegime.label}`);

// ================================================================
// VALIDATION — Geometric, not hardcoded
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("GEOMETRIC VALIDATION");
console.log("=".repeat(80));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label} -- ${detail}`); failed++; }
}

// --- Test 1: SVB dissolution-dominant ---
check(
  svbResult.primeDensity > 0 && svbResult.dissolutionRate > 0.5,
  "SVB text -> primeDensity > 0 AND dissolutionRate > 50%",
  `PD=${(svbResult.primeDensity * 100).toFixed(1)}%, dissRate=${(svbResult.dissolutionRate * 100).toFixed(1)}%`
);

// --- Test 2: Bull propagation > dissolution ---
check(
  bullResult.propagationRate > bullResult.dissolutionRate,
  "Bull text -> propagationRate > dissolutionRate",
  `propRate=${(bullResult.propagationRate * 100).toFixed(1)}%, dissRate=${(bullResult.dissolutionRate * 100).toFixed(1)}%`
);

// --- Test 3: Geometric — SVB mean severity > bull mean severity ---
check(
  svbMean > bullMean,
  "Geometric: SVB mean severity > bull mean severity (engine output)",
  `SVB mean=${svbMean.toFixed(2)}, bull mean=${bullMean.toFixed(2)}`
);

// --- Test 4: Standalone computeFinancialPrimeDensity ---
const crashPD = computeFinancialPrimeDensity("First Republic Bank stock crashes as contagion fears grip market");
const normalPD = computeFinancialPrimeDensity("Markets closed mixed on light trading volume today");
check(
  crashPD.primeDensity > normalPD.primeDensity,
  "Standalone PD: crash headline > normal headline",
  `crash PD=${(crashPD.primeDensity * 100).toFixed(1)}%, normal PD=${(normalPD.primeDensity * 100).toFixed(1)}%`
);

// --- Test 5: Output shape validation ---
const hasSignals = Array.isArray(svbResult.signals) && svbResult.signals.length === 5;
const hasEntropy = typeof svbResult.entropy === "number";
const hasPD = typeof svbResult.primeDensity === "number";
const hasDR = typeof svbResult.dissolutionRate === "number";
const hasPR = typeof svbResult.propagationRate === "number";
const hasWC = typeof svbResult.wordCount === "number" && svbResult.wordCount > 0;
check(
  hasSignals && hasEntropy && hasPD && hasDR && hasPR && hasWC,
  "Output shape: signals[], entropy, primeDensity, dissolutionRate, propagationRate, wordCount",
  `signals=${hasSignals}, entropy=${hasEntropy}, PD=${hasPD}, DR=${hasDR}, PR=${hasPR}, WC=${hasWC}`
);

// --- Test 6: All signals have valid universal categories ---
const validCategories = new Set(FINANCIAL_CATEGORIES);
const allValid = svbResult.signals.every(s =>
  validCategories.has(s.category)
  && typeof s.id === "string"
  && typeof s.severity === "string"
);
const bullValid = bullResult.signals.every(s =>
  validCategories.has(s.category)
  && typeof s.id === "string"
  && typeof s.severity === "string"
);
check(
  allValid && bullValid,
  "All signals have valid universal categories (condition, flow, price, capacity, context)",
  `SVB valid=${allValid}, bull valid=${bullValid}`
);

// ================================================================
// SUMMARY
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log(`FINAL: ${passed} passed, ${failed} failed`);
console.log("=".repeat(80));

if (failed > 0) process.exit(1);
