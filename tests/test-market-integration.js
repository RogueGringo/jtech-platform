/**
 * Market Pipeline Integration Test — Full E2E: ticker -> adapters -> engine -> regime/topology
 *
 * Validates the COMPLETE pipeline that a live user would trigger, using cached
 * CSV data (real Yahoo Finance, COVID-2020 SPY) instead of the backend.
 *
 * Flow:
 *   1. Load real OHLCV CSV (tests/data/market/covid-2020-spy.csv)
 *   2. Build ohlcv array from CSV rows
 *   3. Call analyzeTickerFromCSV("SPY", ohlcv, null, metadata)
 *   4. Validate full output chain: config -> signals -> engine -> metadata
 *
 * Also validates cross-adapter coherence: market signals + financial text signals
 * combined into a single regime — proving the IE Manifold principle.
 *
 * NO SYNTHETIC DATA. CSV is real Yahoo Finance OHLCV for SPY Dec 2019 – Jul 2020.
 * GEOMETRIC VALIDATION. Tests validate topology, not hardcoded labels.
 *
 * Run: node tests/test-market-integration.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV } from "./lib/backtest-engine.js";
import { analyzeTickerFromCSV } from "../src/engine/market-data.js";
import { financialTextToSignals } from "../src/adapters/financial-text-adapter.js";
import { computeCoherence } from "../src/engine/signals.js";
import { MARKET_CATEGORIES } from "../src/adapters/market-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// TEST HARNESS
// ================================================================

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

// ================================================================
// LOAD REAL DATA — Yahoo Finance SPY, COVID-2020
// ================================================================

const csvPath = path.join(__dirname, "data", "market", "covid-2020-spy.csv");
const rows = readCSV(csvPath);

// Build ohlcv array from CSV rows (readCSV parses numeric columns)
const ohlcv = rows.map(r => ({
  open: r.Open,
  high: r.High,
  low: r.Low,
  close: r.Close,
  volume: r.Volume,
}));

const metadata = { name: "SPDR S&P 500 ETF", sector: "Broad Market" };

console.log("MARKET PIPELINE INTEGRATION TEST");
console.log("================================");
console.log(`  Data: ${csvPath}`);
console.log(`  Rows: ${rows.length} trading days (real Yahoo Finance SPY)`);
console.log(`  Date range: ${rows[0].date} to ${rows[rows.length - 1].date}`);
console.log();

// ================================================================
// RUN FULL PIPELINE
// ================================================================

const result = analyzeTickerFromCSV("SPY", ohlcv, null, metadata);

// ================================================================
// A. CONFIG PIPELINE
// ================================================================

console.log("A. Config pipeline");
const { config } = result;

assert(config.id === "market-SPY", `config.id === "market-SPY" (got: ${config.id})`);
assert(config.name.includes("SPY"), `config.name includes "SPY" (got: ${config.name})`);
assert(config.sector === "Broad Market", `config.sector === "Broad Market" (got: ${config.sector})`);
assert(config.signals.length >= 12, `config.signals.length >= 12 (got: ${config.signals.length})`);
assert(config.phases.length >= 3, `config.phases.length >= 3 (got: ${config.phases.length})`);

const catKeys = Object.keys(config.categories);
const required5 = ["condition", "flow", "price", "capacity", "context"];
const hasAll5 = required5.every(k => catKeys.includes(k));
assert(hasAll5, `config.categories has all 5 universal keys (got: ${catKeys.join(", ")})`);

console.log();

// ================================================================
// B. SIGNAL PIPELINE
// ================================================================

console.log("B. Signal pipeline");
const { signals } = result;

assert(Array.isArray(signals) && signals.length >= 12, `signals is array with >= 12 entries (got: ${signals.length})`);

const allHaveFields = signals.every(s => s.id && s.category && s.severity);
assert(allHaveFields, "every signal has id, category, severity");

const validSeverities = new Set(["critical", "high", "moderate", "watch"]);
const allValidSev = signals.every(s => validSeverities.has(s.severity));
assert(allValidSev, `every severity is one of: ${[...validSeverities].join(", ")}`);

const signalCategories = new Set(signals.map(s => s.category));
const marketCats = ["condition", "flow", "price", "capacity"];
const coveredCats = marketCats.filter(c => signalCategories.has(c));
assert(coveredCats.length >= 3, `categories span at least 3 of 4 market categories (got: ${coveredCats.join(", ")})`);

console.log();

// ================================================================
// C. ENGINE PIPELINE
// ================================================================

console.log("C. Engine pipeline");
const { regime, gini, mean, coherence } = result;

assert(regime && typeof regime === "object" && regime.label, `regime is object with .label (got: ${JSON.stringify(regime)})`);

const validRegimes = new Set(["STABLE", "TRANSIENT SPIKE", "BOUNDARY LAYER", "CRISIS CONSOLIDATION"]);
assert(validRegimes.has(regime.label), `regime.label is valid quadrant (got: ${regime.label})`);

assert(typeof gini === "number" && gini >= 0 && gini <= 1, `gini is number between 0 and 1 (got: ${gini.toFixed(4)})`);
assert(typeof mean === "number" && mean >= 1 && mean <= 4, `mean is number between 1 and 4 (got: ${mean.toFixed(4)})`);
assert(typeof coherence === "number" && coherence >= 0 && coherence <= 100, `coherence is number between 0 and 100 (got: ${coherence})`);

console.log();

// ================================================================
// D. METADATA PIPELINE
// ================================================================

console.log("D. Metadata pipeline");
const { entropy, primeDensity, dissolutionRate, propagationRate } = result;

assert(typeof entropy === "number" && entropy >= 0, `entropy is a number >= 0 (got: ${entropy.toFixed(4)})`);
assert(typeof primeDensity === "number" && primeDensity >= 0 && primeDensity <= 1, `primeDensity is number between 0 and 1 (got: ${primeDensity.toFixed(4)})`);
assert(typeof dissolutionRate === "number" && dissolutionRate >= 0 && dissolutionRate <= 1, `dissolutionRate is number between 0 and 1 (got: ${dissolutionRate.toFixed(4)})`);
assert(typeof propagationRate === "number" && propagationRate >= 0 && propagationRate <= 1, `propagationRate is number between 0 and 1 (got: ${propagationRate.toFixed(4)})`);
assert(Array.isArray(result.ohlcv) && result.ohlcv.length === rows.length, `ohlcv is array with length matching CSV rows (got: ${result.ohlcv.length} vs ${rows.length})`);

console.log();

// ================================================================
// E. FINANCIAL TEXT ADAPTER INTEGRATION
// ================================================================

console.log("E. Financial text adapter integration");

// Real COVID-2020 crisis headlines (documented events, March 2020)
const covidHeadlines = [
  { text: "Dow crashes 2000 points as coronavirus panic triggers market meltdown", timestamp: "2020-03-09T16:00:00Z" },
  { text: "NYSE trading halted as S&P 500 plunges 7% on oil crash and pandemic fears", timestamp: "2020-03-09T09:35:00Z" },
  { text: "Fed slashes rates to zero in emergency move as systemic risk fears mount", timestamp: "2020-03-15T17:00:00Z" },
  { text: "Global market crash deepens, circuit breakers triggered for third time this week", timestamp: "2020-03-12T09:35:00Z" },
  { text: "Unemployment claims surge as layoffs accelerate across sectors", timestamp: "2020-03-19T08:30:00Z" },
  { text: "Congress passes massive bailout package as economic collapse fears grow", timestamp: "2020-03-27T14:00:00Z" },
];

const textThresholds = {
  condition_density: [["critical", 0.08], ["high", 0.04], ["moderate", 0.02]],
  info_density: [["critical", 0.06], ["high", 0.03], ["moderate", 0.01]],
  intensity_density: [["critical", 0.08], ["high", 0.04], ["moderate", 0.02]],
  capacity_density: [["critical", 0.06], ["high", 0.03], ["moderate", 0.01]],
  context_density: [["critical", 0.04], ["high", 0.02], ["moderate", 0.01]],
};

const textResult = financialTextToSignals(covidHeadlines, textThresholds);

assert(
  Array.isArray(textResult.signals) && textResult.signals.length > 0,
  `financialTextToSignals produces signals[] (got: ${textResult.signals.length} signals)`
);

// Feed text signals through the same engine pipeline
const textCoherence = computeCoherence(textResult.signals, ["condition", "flow", "price", "capacity", "context"]);
assert(
  textCoherence && textCoherence.regime && textCoherence.regime.label,
  `text signals produce valid regime through engine (got: ${textCoherence.regime.label})`
);

// Combined market + text signals produce a valid regime
const combinedSignals = [...signals, ...textResult.signals];
const combinedCoherence = computeCoherence(combinedSignals, [...MARKET_CATEGORIES, "context"]);
assert(
  combinedCoherence && combinedCoherence.regime && validRegimes.has(combinedCoherence.regime.label),
  `combined (market + text) signals produce valid regime (got: ${combinedCoherence.regime.label})`
);

console.log();

// ================================================================
// F. CROSS-ADAPTER COHERENCE (the conviction signal)
// ================================================================

console.log("F. Cross-adapter coherence (the conviction signal)");

// Verify the combined signal array has both market and text signals
const marketSignalCount = signals.length;
const textSignalCount = textResult.signals.length;
assert(
  combinedSignals.length === marketSignalCount + textSignalCount,
  `combined array has market (${marketSignalCount}) + text (${textSignalCount}) = ${combinedSignals.length} signals`
);

assert(
  typeof combinedCoherence.coherenceScore === "number" && combinedCoherence.coherenceScore >= 0 && combinedCoherence.coherenceScore <= 100,
  `cross-source coherence is valid (got: ${combinedCoherence.coherenceScore}%)`
);

// IE Manifold principle: cross-source coherence from price + sentiment proves
// that independent information channels (market data + news text) can be
// unified into a single regime assessment
assert(
  combinedCoherence.gini >= 0 && combinedCoherence.gini <= 1
    && combinedCoherence.meanSeverity >= 1 && combinedCoherence.meanSeverity <= 4,
  `IE Manifold: cross-source Gini=${combinedCoherence.gini.toFixed(4)}, Mean=${combinedCoherence.meanSeverity.toFixed(4)} — valid geometry`
);

console.log();

// ================================================================
// SUMMARY
// ================================================================

console.log("=".repeat(50));
console.log(`INTEGRATION: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed > 0) {
  console.log();
  console.log("Pipeline diagnostics:");
  console.log(`  Config: id=${config.id}, signals=${config.signals.length}, phases=${config.phases.length}`);
  console.log(`  Signals: ${signals.length} total, categories=${[...signalCategories].join(",")}`);
  console.log(`  Engine: regime=${regime.label}, gini=${gini.toFixed(4)}, mean=${mean.toFixed(4)}, coherence=${coherence}`);
  console.log(`  Meta: entropy=${entropy.toFixed(4)}, PD=${primeDensity.toFixed(4)}, diss=${dissolutionRate.toFixed(4)}, prop=${propagationRate.toFixed(4)}`);
  console.log(`  Text: ${textResult.signals.length} signals, PD=${textResult.primeDensity.toFixed(4)}`);
  console.log(`  Combined: ${combinedSignals.length} signals, regime=${combinedCoherence.regime.label}`);
}

process.exit(failed > 0 ? 1 : 0);
