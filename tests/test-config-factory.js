/**
 * Config Factory + Terms — Unit Tests
 *
 * Validates that createMarketConfig() produces a domain config matching
 * the shape of src/domains/hormuz-iran/config.js, and that terms.js
 * exports a populated glossary.
 *
 * Run: node tests/test-config-factory.js
 */

import { createMarketConfig } from "../src/domains/market/config-factory.js";
import terms from "../src/domains/market/terms.js";

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
// SETUP — generate a config for AAPL
// ================================================================

const metadata = {
  name: "Apple Inc.",
  sector: "Technology",
  industry: "Consumer Electronics",
  exchange: "NASDAQ",
  marketCap: "3.4T",
};

const config = createMarketConfig("AAPL", metadata);

// ================================================================
// TEST 1: Config id matches "market-AAPL"
// ================================================================

console.log("\n=== TEST 1: Config ID ===");
assert(config.id === "market-AAPL", `id === "market-AAPL": got "${config.id}"`);

// ================================================================
// TEST 2: Name includes ticker
// ================================================================

console.log("\n=== TEST 2: Config name ===");
assert(config.name.includes("AAPL"), `name includes "AAPL": got "${config.name}"`);
assert(config.name.includes("Apple Inc."), `name includes "Apple Inc.": got "${config.name}"`);

// ================================================================
// TEST 3: Sector from metadata
// ================================================================

console.log("\n=== TEST 3: Sector from metadata ===");
assert(config.sector === "Technology", `sector === "Technology": got "${config.sector}"`);
assert(config.industry === "Consumer Electronics", `industry from metadata: got "${config.industry}"`);
assert(config.exchange === "NASDAQ", `exchange from metadata: got "${config.exchange}"`);
assert(config.marketCap === "3.4T", `marketCap from metadata: got "${config.marketCap}"`);
assert(config.subtitle.includes("Technology"), `subtitle includes sector: got "${config.subtitle}"`);

// ================================================================
// TEST 4: All 5 universal categories in primeMapping
// ================================================================

console.log("\n=== TEST 4: Prime mapping ===");
const REQUIRED_PRIMES = ["condition", "flow", "price", "capacity", "context"];
for (const prime of REQUIRED_PRIMES) {
  assert(
    config.primeMapping[prime] !== undefined,
    `primeMapping has "${prime}": ${config.primeMapping[prime]}`
  );
}
assert(
  Object.keys(config.primeMapping).length === 5,
  `primeMapping has exactly 5 keys: got ${Object.keys(config.primeMapping).length}`
);

// ================================================================
// TEST 5: Signals array with >= 12 entries, each has id, category, name
// ================================================================

console.log("\n=== TEST 5: Signals array ===");
assert(Array.isArray(config.signals), "signals is an array");
assert(config.signals.length >= 12, `signals.length >= 12: got ${config.signals.length}`);

let allSignalsValid = true;
for (const sig of config.signals) {
  if (typeof sig.id !== "string" || !sig.id) { allSignalsValid = false; break; }
  if (typeof sig.category !== "string" || !sig.category) { allSignalsValid = false; break; }
  if (typeof sig.name !== "string" || !sig.name) { allSignalsValid = false; break; }
}
assert(allSignalsValid, "Every signal has id, category, and name (all non-empty strings)");

// Verify all 12 expected signal IDs from the market adapter
const expectedIds = new Set([
  "mkt_rsi", "mkt_macd", "mkt_bbpctb",
  "mkt_volratio", "mkt_obvslope", "mkt_mfi",
  "mkt_sma50", "mkt_sma200", "mkt_drawdown",
  "mkt_atr", "mkt_bbwidth", "mkt_adx",
]);
const actualIds = new Set(config.signals.map(s => s.id));
const allIdsPresent = [...expectedIds].every(id => actualIds.has(id));
assert(allIdsPresent, "All 12 market adapter signal IDs present");

// Each signal should have default placeholder fields
const allHaveDefaults = config.signals.every(
  s => s.severity === "watch" && s.trend === "stable" && s.source === "computed"
);
assert(allHaveDefaults, "All signals have default severity/trend/source");

// ================================================================
// TEST 6: 5 categories in categories object
// ================================================================

console.log("\n=== TEST 6: Categories object ===");
const catKeys = Object.keys(config.categories);
assert(catKeys.length === 5, `5 categories: got ${catKeys.length}`);
for (const prime of REQUIRED_PRIMES) {
  assert(
    config.categories[prime] !== undefined,
    `categories has "${prime}"`
  );
  assert(
    typeof config.categories[prime].label === "string",
    `categories.${prime} has label`
  );
  assert(
    typeof config.categories[prime].color === "string",
    `categories.${prime} has color`
  );
}

// ================================================================
// TEST 7: Phases array with >= 3 phases
// ================================================================

console.log("\n=== TEST 7: Phases array ===");
assert(Array.isArray(config.phases), "phases is an array");
assert(config.phases.length >= 3, `phases.length >= 3: got ${config.phases.length}`);
const allPhasesValid = config.phases.every(
  p => typeof p.id === "string" && typeof p.name === "string" && typeof p.description === "string"
);
assert(allPhasesValid, "Every phase has id, name, and description");

// Verify the four Wyckoff phases
const phaseIds = config.phases.map(p => p.id);
assert(phaseIds.includes("accumulation"), "Phases include accumulation");
assert(phaseIds.includes("markup"), "Phases include markup");
assert(phaseIds.includes("distribution"), "Phases include distribution");
assert(phaseIds.includes("markdown"), "Phases include markdown");

// ================================================================
// TEST 8: priceSymbols maps to ticker
// ================================================================

console.log("\n=== TEST 8: Price symbols ===");
assert(config.priceSymbols.price === "AAPL", `priceSymbols.price === "AAPL": got "${config.priceSymbols.price}"`);
assert(
  Array.isArray(config.livePriceIds) && config.livePriceIds.includes("price"),
  "livePriceIds includes 'price'"
);

// ================================================================
// TEST 9: Tabs array exists
// ================================================================

console.log("\n=== TEST 9: Tabs array ===");
assert(Array.isArray(config.tabs), "tabs is an array");
assert(config.tabs.length >= 6, `tabs.length >= 6: got ${config.tabs.length}`);
const allTabsValid = config.tabs.every(
  t => typeof t.id === "string" && typeof t.label === "string"
);
assert(allTabsValid, "Every tab has id and label");

// Verify expected tab IDs
const tabIds = config.tabs.map(t => t.id);
assert(tabIds.includes("thesis"), "Tabs include thesis");
assert(tabIds.includes("nodes"), "Tabs include nodes");
assert(tabIds.includes("patterns"), "Tabs include patterns");

// ================================================================
// TEST 10: terms.js exports an object with at least 5 keys
// ================================================================

console.log("\n=== TEST 10: Terms glossary ===");
assert(typeof terms === "object" && terms !== null, "terms is a non-null object");
const termKeys = Object.keys(terms);
assert(termKeys.length >= 5, `terms has >= 5 keys: got ${termKeys.length}`);

// Verify all expected term keys
const expectedTerms = ["rsi", "macd", "bollingerBands", "atr", "adx", "obv", "mfi", "drawdown", "gini", "regime", "trajectory", "sigma"];
for (const term of expectedTerms) {
  assert(
    typeof terms[term] === "string" && terms[term].length > 0,
    `terms.${term} is a non-empty string`
  );
}

// ================================================================
// BONUS: Config shape completeness — all fields from template exist
// ================================================================

console.log("\n=== BONUS: Config shape completeness ===");
assert(typeof config.severityThresholds === "object", "severityThresholds exists");
assert(Array.isArray(config.effectKeywords), "effectKeywords is array");
assert(Array.isArray(config.eventKeywords), "eventKeywords is array");
assert(typeof config.chainTerms === "object", "chainTerms exists");
assert(Array.isArray(config.feedSources), "feedSources is array");
assert(typeof config.derivedPrices === "object", "derivedPrices exists");
assert(typeof config.verifySources === "object", "verifySources exists");

// ================================================================
// BONUS: Default metadata fallback
// ================================================================

console.log("\n=== BONUS: Default metadata fallback ===");
const bare = createMarketConfig("XYZ");
assert(bare.id === "market-XYZ", `Bare config id: "market-XYZ": got "${bare.id}"`);
assert(bare.name === "XYZ", `Bare config name defaults to ticker: got "${bare.name}"`);
assert(bare.sector === "Unknown", `Bare config sector defaults to "Unknown": got "${bare.sector}"`);
assert(bare.priceSymbols.price === "XYZ", `Bare config priceSymbols.price === "XYZ": got "${bare.priceSymbols.price}"`);

// ================================================================
// BONUS: Config isolation — mutations don't bleed between instances
// ================================================================

console.log("\n=== BONUS: Config isolation ===");
const configA = createMarketConfig("AAA");
const configB = createMarketConfig("BBB");
configA.signals.push({ id: "extra", category: "test", name: "test" });
configA.tabs.push({ id: "extra", label: "EXTRA" });
configA.categories.extra = { label: "EXTRA", color: "#000" };
assert(configB.signals.length === 12, `Config B unaffected by Config A mutation (signals): ${configB.signals.length}`);
assert(configB.tabs.length === 7, `Config B unaffected by Config A mutation (tabs): ${configB.tabs.length}`);
assert(configB.categories.extra === undefined, "Config B unaffected by Config A mutation (categories)");

// ================================================================
// RESULTS
// ================================================================

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  console.log("\nFAILURES DETECTED — see above");
  process.exit(1);
} else {
  console.log("\nALL TESTS PASSED");
}
