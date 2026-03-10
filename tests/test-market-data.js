/**
 * Market Data Orchestrator Test
 *
 * Validates analyzeTickerFromCSV against real COVID-2020 SPY data.
 * Backend is not required — tests the offline pipeline only.
 *
 * Data source: tests/data/market/covid-2020-spy.csv (Yahoo Finance, 145 bars)
 *
 * Run: node tests/test-market-data.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { analyzeTickerFromCSV, BACKEND_TO_ADAPTER } from "../src/engine/market-data.js";
import { readCSV } from "./lib/backtest-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

// ================================================================
// CSV -> adapter data helpers
// ================================================================

function loadMarketCSV(csvPath) {
  const rows = readCSV(csvPath);

  const ohlcv = rows.map(r => ({
    open: r.Open,
    high: r.High,
    low: r.Low,
    close: r.Close,
    volume: r.Volume,
  }));

  // Map CSV column names to adapter key names
  const technicals = {};
  for (const [csvKey, adapterKey] of Object.entries(BACKEND_TO_ADAPTER)) {
    technicals[adapterKey] = rows.map(r => r[csvKey] || 0);
  }

  return { ohlcv, technicals, rows };
}

// ================================================================
// TEST FRAMEWORK
// ================================================================

let passed = 0;
let failed = 0;

function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} — ${detail}`);
    failed++;
  }
}

// ================================================================
// MAIN TEST
// ================================================================

console.log("=".repeat(70));
console.log("Market Data Orchestrator — analyzeTickerFromCSV");
console.log("=".repeat(70));

const csvPath = path.join(DATA_DIR, "covid-2020-spy.csv");
const { ohlcv, technicals } = loadMarketCSV(csvPath);

console.log(`\n  Loaded ${ohlcv.length} bars from covid-2020-spy.csv`);

const metadata = {
  name: "SPDR S&P 500 ETF Trust",
  sector: "ETF",
  industry: "Index Fund",
  exchange: "ARCA",
  marketCap: null,
};

const result = analyzeTickerFromCSV("SPY", ohlcv, technicals, metadata, 60);

console.log("");

// 1. Config shape
check(
  result.config && result.config.id === "market-SPY",
  "Config ID is market-SPY",
  `got ${result.config?.id}`
);

// 2. Signals array with >= 12 signals
check(
  Array.isArray(result.signals) && result.signals.length >= 12,
  `Signals array has >= 12 entries (got ${result.signals?.length})`,
  `got ${result.signals?.length}`
);

// 3. Regime has .label
check(
  result.regime && typeof result.regime.label === "string" && result.regime.label.length > 0,
  `Regime has label: "${result.regime?.label}"`,
  `got ${JSON.stringify(result.regime)}`
);

// 4. Gini, mean, coherence are numbers
check(
  typeof result.gini === "number" && !isNaN(result.gini),
  `Gini is a number: ${result.gini.toFixed(4)}`,
  `got ${result.gini}`
);

check(
  typeof result.mean === "number" && !isNaN(result.mean),
  `Mean severity is a number: ${result.mean.toFixed(4)}`,
  `got ${result.mean}`
);

check(
  typeof result.coherence === "number" && !isNaN(result.coherence),
  `Coherence is a number: ${result.coherence}`,
  `got ${result.coherence}`
);

// 5. Entropy, primeDensity, dissolutionRate, propagationRate
check(
  typeof result.entropy === "number" && !isNaN(result.entropy),
  `Entropy is a number: ${result.entropy.toFixed(4)}`,
  `got ${result.entropy}`
);

check(
  typeof result.primeDensity === "number" && !isNaN(result.primeDensity),
  `Prime density is a number: ${result.primeDensity.toFixed(4)}`,
  `got ${result.primeDensity}`
);

check(
  typeof result.dissolutionRate === "number" && !isNaN(result.dissolutionRate),
  `Dissolution rate is a number: ${result.dissolutionRate.toFixed(4)}`,
  `got ${result.dissolutionRate}`
);

check(
  typeof result.propagationRate === "number" && !isNaN(result.propagationRate),
  `Propagation rate is a number: ${result.propagationRate.toFixed(4)}`,
  `got ${result.propagationRate}`
);

// 6. OHLCV returned
check(
  Array.isArray(result.ohlcv) && result.ohlcv.length === ohlcv.length,
  `OHLCV array returned with ${result.ohlcv?.length} bars`,
  `got ${result.ohlcv?.length}`
);

// 7. Config has correct primeMapping
check(
  result.config.primeMapping &&
    result.config.primeMapping.condition === "condition" &&
    result.config.primeMapping.flow === "flow" &&
    result.config.primeMapping.price === "price" &&
    result.config.primeMapping.capacity === "capacity" &&
    result.config.primeMapping.context === "context",
  "Config has correct primeMapping (5 universal categories)",
  `got ${JSON.stringify(result.config?.primeMapping)}`
);

// ================================================================
// BONUS: Validate signal categories cover all 4 market categories
// ================================================================

const categories = new Set(result.signals.map(s => s.category));
check(
  categories.has("condition") && categories.has("flow") &&
    categories.has("price") && categories.has("capacity"),
  "All 4 market categories present in signals",
  `got ${[...categories].join(", ")}`
);

// ================================================================
// BONUS: Validate each signal has severity field
// ================================================================

const allHaveSeverity = result.signals.every(s =>
  ["critical", "high", "moderate", "watch"].includes(s.severity)
);
check(
  allHaveSeverity,
  "All signals have valid severity levels",
  `found invalid severity in ${result.signals.find(s => !["critical", "high", "moderate", "watch"].includes(s.severity))?.id}`
);

// ================================================================
// BONUS: Test with empty OHLCV handles gracefully
// ================================================================

const emptyResult = analyzeTickerFromCSV("EMPTY", [], null, {}, 60);
check(
  emptyResult.signals.length === 0 && emptyResult.regime.label === "NO DATA",
  "Empty OHLCV returns NO DATA regime gracefully",
  `got ${emptyResult.regime?.label}`
);

// ================================================================
// SUMMARY
// ================================================================

console.log(`\n${"=".repeat(70)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("=".repeat(70));

if (failed > 0) process.exit(1);
