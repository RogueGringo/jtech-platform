/**
 * Cross-Source Validation — GDELT vs FRED on 2022 Russia-Ukraine
 *
 * Proves: Different data sources (linguistic events vs market prices)
 * processed through the same math engine produce correlated regime
 * trajectories for the same historical event.
 *
 * Run: node tests/backtest-cross-source.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pearsonR } from "./lib/backtest-engine.js";
import { crossPanelCoherence, toIERegime } from "../src/engine/ie-manifold.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=".repeat(80));
console.log("CROSS-SOURCE VALIDATION — GDELT IE vs FRED Oil (2022 Russia-Ukraine)");
console.log("=".repeat(80));

// Import GDELT backtest results
const gdeltModule = await import("./backtest-gdelt.js");
const gdeltResults = gdeltModule.results;

// Load FRED 2022 oil data directly
const fredCsvPath = path.join(__dirname, "data", "2022-russia-ukraine.csv");
const fredRaw = fs.readFileSync(fredCsvPath, "utf-8");
const fredLines = fredRaw.trim().split("\n");
const fredHeader = fredLines[0].split(",").map(h => h.trim());
const fredRows = fredLines.slice(1).map(line => {
  const vals = line.split(",");
  const row = {};
  fredHeader.forEach((col, i) => {
    const v = vals[i]?.trim();
    row[col] = col === "date" ? v : (v === "" || v === undefined ? null : parseFloat(v));
  });
  return row;
}).filter(r => r.brent !== null && r.wti !== null);

console.log(`\n  GDELT: ${gdeltResults.length} daily records`);
console.log(`  FRED:  ${fredRows.length} daily records`);

// Find overlapping dates
const gdeltDateMap = new Map(gdeltResults.map(r => [r.date, r]));
const fredDateMap = new Map(fredRows.map(r => [r.date, r]));
const overlap = [...gdeltDateMap.keys()].filter(d => fredDateMap.has(d)).sort();

console.log(`  Overlap: ${overlap.length} shared dates\n`);

// Extract paired time series
const gdeltMeans = overlap.map(d => gdeltDateMap.get(d).mean);
const gdeltEntropy = overlap.map(d => gdeltDateMap.get(d).entropy);
const gdeltVolume = overlap.map(d => gdeltDateMap.get(d).volumeRatio);
const gdeltPD = overlap.map(d => gdeltDateMap.get(d).primeDensity);
const fredBrent = overlap.map(d => fredDateMap.get(d).brent);

// ================================================================
// CORRELATIONS
// ================================================================

console.log("  CROSS-SOURCE CORRELATIONS:");
const volBrentR = pearsonR(gdeltVolume, fredBrent);
console.log(`    GDELT volume ratio vs Brent:     r = ${volBrentR.toFixed(3)}`);

const meanBrentR = pearsonR(gdeltMeans, fredBrent);
console.log(`    GDELT mean severity vs Brent:    r = ${meanBrentR.toFixed(3)}`);

const entropyBrentR = pearsonR(gdeltEntropy, fredBrent);
console.log(`    GDELT entropy vs Brent:          r = ${entropyBrentR.toFixed(3)}`);

const pdBrentR = pearsonR(gdeltPD, fredBrent);
console.log(`    GDELT prime density vs Brent:    r = ${pdBrentR.toFixed(3)}`);

// ================================================================
// CROSS-PANEL COHERENCE on key dates
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CROSS-PANEL COHERENCE — COG DETECTION");
console.log("=".repeat(80));

const cohDates = ["2022-02-24", "2022-03-08", "2022-04-02"];
for (const d of cohDates) {
  const gd = gdeltDateMap.get(d);
  const fd = fredDateMap.get(d);
  if (!gd || !fd) continue;

  // FRED mean severity (approximate from Brent level)
  // Using the oil backtest thresholds: critical>=95, high>=80, moderate>=70
  const brentSev = fd.brent >= 95 ? 4 : fd.brent >= 80 ? 3 : fd.brent >= 70 ? 2 : 1;
  const fredMean = (brentSev + 2) / 2; // Approximate with geopolitical=high baseline

  const panels = [
    { name: "MACRO (GDELT)", mean: gd.mean, gini: gd.gini, regime: gd.regime, ieRegime: gd.ieRegime },
    { name: "PRICE (FRED)", mean: fredMean, gini: 0.15, regime: brentSev >= 3 ? "CRISIS CONSOLIDATION" : "STABLE",
      ieRegime: toIERegime(brentSev >= 3 ? "CRISIS CONSOLIDATION" : "STABLE") },
  ];

  const coh = crossPanelCoherence(panels);
  console.log(`\n  ${d} | Brent: $${fd.brent}`);
  console.log(`    MACRO:  ${gd.ieRegime.padEnd(15)} mean=${gd.mean.toFixed(2)}`);
  console.log(`    PRICE:  ${panels[1].ieRegime.padEnd(15)} mean=${fredMean.toFixed(2)}`);
  console.log(`    Cross-panel coherence: ${(coh.coherence * 100).toFixed(1)}% | COG: ${coh.cogDetected ? "YES" : "NO"}`);
  if (coh.divergences.length > 0) {
    console.log(`    DIVERGENCE: ${coh.divergences.map(d => `${d.panel1}=${d.regime1} vs ${d.panel2}=${d.regime2}`).join("; ")}`);
  }
}

// ================================================================
// INVARIANCE TESTS
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CROSS-SOURCE INVARIANCE");
console.log("=".repeat(80));

let xPassed = 0, xFailed = 0;
function check(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); xPassed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); xFailed++; }
}

check(volBrentR > 0,
  "GDELT volume positively correlates with Brent price",
  `r=${volBrentR.toFixed(3)}`);

check(meanBrentR > 0,
  "GDELT mean severity positively correlates with Brent",
  `r=${meanBrentR.toFixed(3)}`);

check(entropyBrentR < 0,
  "GDELT entropy inversely correlates with Brent (prime regression = high prices)",
  `r=${entropyBrentR.toFixed(3)}`);

check(pdBrentR > 0,
  "GDELT prime density positively correlates with Brent (more primes = higher prices)",
  `r=${pdBrentR.toFixed(3)}`);

// Peak alignment: both sources detect crisis peak within 30 days
const gdeltPeakDate = gdeltResults.filter(r => overlap.includes(r.date))
  .reduce((best, r) => r.mean > best.mean ? r : best).date;
const fredPeakDate = fredRows.filter(r => overlap.includes(r.date))
  .reduce((best, r) => (r.brent || 0) > (best.brent || 0) ? r : best).date;
const peakGap = Math.abs(new Date(gdeltPeakDate) - new Date(fredPeakDate)) / (1000 * 60 * 60 * 24);
check(peakGap < 30,
  `Peak alignment: GDELT peak ${gdeltPeakDate}, FRED peak ${fredPeakDate} (${peakGap}d gap)`,
  `gap=${peakGap} days`);

const crossScore = xPassed / (xPassed + xFailed);

console.log(`\n  ${"=".repeat(50)}`);
console.log(`  CROSS-SOURCE SCORE: ${(crossScore * 100).toFixed(1)}%`);
console.log(`  ${"=".repeat(50)}`);

console.log(`\n${"=".repeat(80)}`);
console.log(`FINAL: ${xPassed} passed, ${xFailed} failed | Cross-Source: ${(crossScore * 100).toFixed(1)}%`);
console.log("=".repeat(80));

if (xFailed > 0) process.exit(1);
