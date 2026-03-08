/**
 * Regime Backtest — Verifies mathematical outputs across all four regime states
 * plus edge cases and the actual Hormuz crisis configuration.
 *
 * Run: node tests/backtest-regimes.js
 */

// ---- Inline implementations (no ESM import needed) ----

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

function computeGini(signals) {
  const ranks = signals.map(s => SEVERITY_RANK[s.severity] || 1);
  const n = ranks.length;
  if (n === 0) return 0;
  const mean = ranks.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sumAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbsDiff += Math.abs(ranks[i] - ranks[j]);
    }
  }
  return sumAbsDiff / (2 * n * n * mean);
}

function computeMeanSeverity(signals) {
  if (signals.length === 0) return 1;
  const ranks = signals.map(s => SEVERITY_RANK[s.severity] || 1);
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

function computeCrossCoherence(signals, categoryKeys) {
  if (!categoryKeys || categoryKeys.length === 0) return 100;
  const catMeans = [];
  for (const cat of categoryKeys) {
    const catSignals = signals.filter(s => s.category === cat);
    if (catSignals.length === 0) continue;
    const ranks = catSignals.map(s => SEVERITY_RANK[s.severity] || 1);
    catMeans.push(ranks.reduce((a, b) => a + b, 0) / ranks.length);
  }
  if (catMeans.length <= 1) return 100;
  const mu = catMeans.reduce((a, b) => a + b, 0) / catMeans.length;
  if (mu === 0) return 100;
  const variance = catMeans.reduce((acc, v) => acc + (v - mu) ** 2, 0) / catMeans.length;
  const sigma = Math.sqrt(variance);
  const cv = sigma / mu;
  return Math.round((1 - Math.min(cv, 1)) * 100);
}

function classifyRegime(meanSeverity, gini) {
  const highMean = meanSeverity >= 2.5;
  const highGini = gini >= 0.2;
  if (!highMean && !highGini) return { label: "STABLE", quadrant: "low-low" };
  if (!highMean && highGini)  return { label: "TRANSIENT SPIKE", quadrant: "low-high" };
  if (highMean && !highGini)  return { label: "CRISIS CONSOLIDATION", quadrant: "high-low" };
  return { label: "BOUNDARY LAYER", quadrant: "high-high" };
}

function computeTransitionIntensity(signals, baselineSignals) {
  const baseRanks = {};
  for (const s of baselineSignals) {
    baseRanks[s.id] = SEVERITY_RANK[s.severity] || 1;
  }
  const deltas = signals.map(s => {
    const current = SEVERITY_RANK[s.severity] || 1;
    const baseline = baseRanks[s.id] || 1;
    return current - baseline;
  });
  const magnitude = Math.sqrt(deltas.reduce((sum, d) => sum + d * d, 0));
  const nonZero = deltas.filter(d => d !== 0);
  if (nonZero.length === 0) return { magnitude: 0, alignment: 0, label: "STABLE", normalized: 0 };
  const positive = nonZero.filter(d => d > 0).length;
  const negative = nonZero.length - positive;
  const alignment = Math.max(positive, negative) / nonZero.length;
  const maxMag = Math.sqrt(signals.length * 9);
  const normalized = maxMag > 0 ? magnitude / maxMag : 0;
  let label;
  if (normalized < 0.2) label = "STABLE";
  else if (alignment >= 0.7) label = "PHASE TRANSITION";
  else label = "TURBULENCE";
  return { magnitude, alignment, normalized, label };
}

// ---- Helper to make signal arrays ----
function mkSignals(specs) {
  // specs: [{ id, category, severity }]
  return specs.map(s => ({ id: s.id || s.category + "_" + s.severity, category: s.category, severity: s.severity }));
}

const CATS = ["kernel", "physical", "price", "domestic", "geopolitical"];

// ---- Test Scenarios ----

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} — ${detail}`);
    failed++;
  }
}

function runScenario(name, signals, categories, expectations) {
  console.log(`\n=== ${name} ===`);
  const gini = computeGini(signals);
  const mean = computeMeanSeverity(signals);
  const coherence = computeCrossCoherence(signals, categories);
  const regime = classifyRegime(mean, gini);

  console.log(`  Gini=${gini.toFixed(4)}, Mean=${mean.toFixed(2)}, Coherence=${coherence}%, Regime=${regime.label}`);

  if (expectations.regime) {
    assert(regime.label === expectations.regime, `Regime = ${expectations.regime}`, `got ${regime.label}`);
  }
  if (expectations.giniRange) {
    const [lo, hi] = expectations.giniRange;
    assert(gini >= lo && gini <= hi, `Gini in [${lo}, ${hi}]`, `got ${gini.toFixed(4)}`);
  }
  if (expectations.meanRange) {
    const [lo, hi] = expectations.meanRange;
    assert(mean >= lo && mean <= hi, `Mean in [${lo}, ${hi}]`, `got ${mean.toFixed(2)}`);
  }
  if (expectations.coherenceRange) {
    const [lo, hi] = expectations.coherenceRange;
    assert(coherence >= lo && coherence <= hi, `Coherence in [${lo}, ${hi}]`, `got ${coherence}`);
  }

  return { gini, mean, coherence, regime };
}

// ================================================================
// SCENARIO 1: STABLE — All signals at watch/moderate
// ================================================================
runScenario("STABLE — All watch", mkSignals([
  { category: "kernel", severity: "watch" },
  { category: "kernel", severity: "watch" },
  { category: "physical", severity: "watch" },
  { category: "physical", severity: "watch" },
  { category: "price", severity: "watch" },
  { category: "price", severity: "watch" },
  { category: "domestic", severity: "watch" },
  { category: "domestic", severity: "watch" },
  { category: "geopolitical", severity: "watch" },
  { category: "geopolitical", severity: "watch" },
]), CATS, {
  regime: "STABLE",
  giniRange: [0, 0.001],     // All identical => Gini = 0
  meanRange: [1, 1],
  coherenceRange: [100, 100], // All categories identical
});

// ================================================================
// SCENARIO 2: STABLE — Mixed low (watch + moderate, uniform)
// ================================================================
runScenario("STABLE — Uniform low mix", mkSignals([
  { category: "kernel", severity: "watch" },
  { category: "kernel", severity: "moderate" },
  { category: "physical", severity: "watch" },
  { category: "physical", severity: "moderate" },
  { category: "price", severity: "watch" },
  { category: "price", severity: "moderate" },
  { category: "domestic", severity: "watch" },
  { category: "domestic", severity: "moderate" },
  { category: "geopolitical", severity: "watch" },
  { category: "geopolitical", severity: "moderate" },
]), CATS, {
  regime: "STABLE",
  meanRange: [1, 2.49],
  coherenceRange: [95, 100],  // All categories have same mix
});

// ================================================================
// SCENARIO 3: TRANSIENT SPIKE — One category critical, rest watch
// ================================================================
runScenario("TRANSIENT SPIKE — Kernel critical, rest watch", mkSignals([
  { category: "kernel", severity: "critical" },
  { category: "kernel", severity: "critical" },
  { category: "physical", severity: "watch" },
  { category: "physical", severity: "watch" },
  { category: "price", severity: "watch" },
  { category: "price", severity: "watch" },
  { category: "domestic", severity: "watch" },
  { category: "domestic", severity: "watch" },
  { category: "geopolitical", severity: "watch" },
  { category: "geopolitical", severity: "watch" },
]), CATS, {
  regime: "TRANSIENT SPIKE",
  giniRange: [0.2, 0.6],     // High inequality
  meanRange: [1, 2.49],      // Low mean (mostly watch)
  coherenceRange: [0, 70],   // Categories disagree
});

// ================================================================
// SCENARIO 4: CRISIS CONSOLIDATION — All critical
// ================================================================
runScenario("CRISIS CONSOLIDATION — All critical", mkSignals([
  { category: "kernel", severity: "critical" },
  { category: "kernel", severity: "critical" },
  { category: "physical", severity: "critical" },
  { category: "physical", severity: "critical" },
  { category: "price", severity: "critical" },
  { category: "price", severity: "critical" },
  { category: "domestic", severity: "critical" },
  { category: "domestic", severity: "critical" },
  { category: "geopolitical", severity: "critical" },
  { category: "geopolitical", severity: "critical" },
]), CATS, {
  regime: "CRISIS CONSOLIDATION",
  giniRange: [0, 0.001],     // All identical => Gini = 0
  meanRange: [4, 4],
  coherenceRange: [100, 100], // Perfect agreement
});

// ================================================================
// SCENARIO 5: CRISIS CONSOLIDATION — All high/critical (uniform elevated)
// ================================================================
runScenario("CRISIS CONSOLIDATION — Uniform high/critical", mkSignals([
  { category: "kernel", severity: "critical" },
  { category: "kernel", severity: "high" },
  { category: "physical", severity: "critical" },
  { category: "physical", severity: "high" },
  { category: "price", severity: "critical" },
  { category: "price", severity: "high" },
  { category: "domestic", severity: "critical" },
  { category: "domestic", severity: "high" },
  { category: "geopolitical", severity: "critical" },
  { category: "geopolitical", severity: "high" },
]), CATS, {
  regime: "CRISIS CONSOLIDATION",
  giniRange: [0, 0.19],      // Low Gini — even distribution at high level
  meanRange: [3, 4],
  coherenceRange: [95, 100],  // Categories have same mix
});

// ================================================================
// SCENARIO 6: BOUNDARY LAYER — Half the system in crisis, half calm
// This requires EXTREME split: some categories all-critical, others all-watch,
// with overall mean still >= 2.5 and Gini >= 0.2
// ================================================================
runScenario("BOUNDARY LAYER — Extreme category split", mkSignals([
  { category: "kernel", severity: "critical" },
  { category: "kernel", severity: "critical" },
  { category: "physical", severity: "critical" },
  { category: "physical", severity: "critical" },
  { category: "price", severity: "watch" },
  { category: "price", severity: "watch" },
  { category: "domestic", severity: "watch" },
  { category: "domestic", severity: "watch" },
  { category: "geopolitical", severity: "critical" },
  { category: "geopolitical", severity: "critical" },
]), CATS, {
  regime: "BOUNDARY LAYER",
  giniRange: [0.2, 0.5],     // High Gini — extreme split between critical and watch
  meanRange: [2.5, 4],       // Mean=2.8 (6 criticals + 4 watches)
  coherenceRange: [0, 50],   // Categories strongly disagree
});

// ================================================================
// SCENARIO 7: ACTUAL HORMUZ CONFIG — Current crisis state
// ================================================================
console.log("\n=== ACTUAL HORMUZ CONFIG — Current baseline signals ===");
const hormuzSignals = [
  { id: "pni", category: "kernel", severity: "critical" },
  { id: "warrisk", category: "kernel", severity: "critical" },
  { id: "reinsure", category: "kernel", severity: "critical" },
  { id: "ais", category: "physical", severity: "critical" },
  { id: "stranded", category: "physical", severity: "high" },
  { id: "bypass", category: "physical", severity: "moderate" },
  { id: "vlcc", category: "physical", severity: "critical" },
  { id: "spr", category: "physical", severity: "high" },
  { id: "brent", category: "price", severity: "moderate" },
  { id: "wti", category: "price", severity: "moderate" },
  { id: "spread", category: "price", severity: "moderate" },
  { id: "ovx", category: "price", severity: "moderate" },
  { id: "kcposted", category: "price", severity: "moderate" },
  { id: "rigs", category: "domestic", severity: "moderate" },
  { id: "duc", category: "domestic", severity: "high" },
  { id: "production", category: "domestic", severity: "moderate" },
  { id: "iranprod", category: "geopolitical", severity: "critical" },
  { id: "opecspare", category: "geopolitical", severity: "high" },
  { id: "georisk", category: "geopolitical", severity: "high" },
  { id: "proxyactive", category: "geopolitical", severity: "critical" },
];

const hResult = runScenario("HORMUZ CRISIS", hormuzSignals, CATS, {
  // Kernel is all critical (4.0), physical is mixed high (3.0), price is all moderate (2.0),
  // domestic is moderate/high (2.33), geopolitical is high/critical (3.5)
  // Mean should be elevated, Gini should be moderate-to-high (uneven across categories)
  meanRange: [2.5, 3.5],
});

// The Hormuz crisis has kernel/physical/geopolitical elevated but price/domestic lower.
// Produces CRISIS CONSOLIDATION: mean=2.95 (high) but Gini=0.16 (low) because
// with 20 signals the inequality gets smoothed. Physical reality dominates.
console.log(`\n  HORMUZ ANALYSIS:`);
console.log(`  - Kernel mean: ${computeMeanSeverity(hormuzSignals.filter(s => s.category === "kernel")).toFixed(2)} (all critical)`);
console.log(`  - Physical mean: ${computeMeanSeverity(hormuzSignals.filter(s => s.category === "physical")).toFixed(2)} (mixed)`);
console.log(`  - Price mean: ${computeMeanSeverity(hormuzSignals.filter(s => s.category === "price")).toFixed(2)} (all moderate)`);
console.log(`  - Domestic mean: ${computeMeanSeverity(hormuzSignals.filter(s => s.category === "domestic")).toFixed(2)} (moderate-high)`);
console.log(`  - Geopolitical mean: ${computeMeanSeverity(hormuzSignals.filter(s => s.category === "geopolitical")).toFixed(2)} (high-critical)`);

// Validate: if prices come in live and push price category to high/critical,
// regime should shift toward CRISIS CONSOLIDATION
console.log("\n=== HORMUZ + LIVE PRICE ESCALATION — Prices hit critical ===");
const hormuzEscalated = hormuzSignals.map(s =>
  s.category === "price" ? { ...s, severity: "critical" } : s
);
runScenario("HORMUZ ESCALATED (prices critical)", hormuzEscalated, CATS, {
  meanRange: [3, 4],
  giniRange: [0, 0.25],  // Should drop — more uniform now
});

// ================================================================
// SCENARIO 8: Transition Intensity — from stable baseline to crisis
// ================================================================
console.log("\n=== TRANSITION INTENSITY — Stable baseline to crisis current ===");
const stableBaseline = CATS.flatMap(cat => [
  { id: cat + "_1", category: cat, severity: "watch" },
  { id: cat + "_2", category: cat, severity: "watch" },
]);
const crisisCurrent = CATS.flatMap(cat => [
  { id: cat + "_1", category: cat, severity: "critical" },
  { id: cat + "_2", category: cat, severity: "critical" },
]);
const ti = computeTransitionIntensity(crisisCurrent, stableBaseline);
console.log(`  Magnitude=${ti.magnitude.toFixed(2)}, Alignment=${(ti.alignment*100).toFixed(0)}%, Normalized=${(ti.normalized*100).toFixed(0)}%, Label=${ti.label}`);
assert(ti.label === "PHASE TRANSITION", "Full escalation = PHASE TRANSITION", `got ${ti.label}`);
assert(ti.alignment === 1.0, "All deltas positive = 100% alignment", `got ${ti.alignment}`);
assert(ti.normalized > 0.5, "Normalized > 50%", `got ${(ti.normalized*100).toFixed(0)}%`);

// ================================================================
// SCENARIO 9: Transition Intensity — mixed directions (turbulence)
// Need a non-uniform baseline so some signals go UP and others go DOWN
// ================================================================
console.log("\n=== TRANSITION INTENSITY — Mixed directions (turbulence) ===");
const mixedBaseline = [
  { id: "kernel_1", category: "kernel", severity: "critical" },   // starts high
  { id: "kernel_2", category: "kernel", severity: "critical" },   // starts high
  { id: "physical_1", category: "physical", severity: "watch" },  // starts low
  { id: "physical_2", category: "physical", severity: "watch" },  // starts low
  { id: "price_1", category: "price", severity: "critical" },     // starts high
  { id: "price_2", category: "price", severity: "critical" },     // starts high
  { id: "domestic_1", category: "domestic", severity: "watch" },   // starts low
  { id: "domestic_2", category: "domestic", severity: "watch" },   // starts low
  { id: "geopolitical_1", category: "geopolitical", severity: "high" },
  { id: "geopolitical_2", category: "geopolitical", severity: "high" },
];
const mixedCurrent = [
  { id: "kernel_1", category: "kernel", severity: "watch" },      // DOWN 3
  { id: "kernel_2", category: "kernel", severity: "watch" },      // DOWN 3
  { id: "physical_1", category: "physical", severity: "critical" }, // UP 3
  { id: "physical_2", category: "physical", severity: "critical" }, // UP 3
  { id: "price_1", category: "price", severity: "watch" },        // DOWN 3
  { id: "price_2", category: "price", severity: "watch" },        // DOWN 3
  { id: "domestic_1", category: "domestic", severity: "critical" }, // UP 3
  { id: "domestic_2", category: "domestic", severity: "critical" }, // UP 3
  { id: "geopolitical_1", category: "geopolitical", severity: "high" }, // no change
  { id: "geopolitical_2", category: "geopolitical", severity: "high" }, // no change
];
const tiMixed = computeTransitionIntensity(mixedCurrent, mixedBaseline);
console.log(`  Magnitude=${tiMixed.magnitude.toFixed(2)}, Alignment=${(tiMixed.alignment*100).toFixed(0)}%, Normalized=${(tiMixed.normalized*100).toFixed(0)}%, Label=${tiMixed.label}`);
// 4 went up, 4 went down, 2 unchanged — alignment should be 50% -> TURBULENCE
assert(tiMixed.label === "TURBULENCE", "Mixed directions = TURBULENCE", `got ${tiMixed.label}`);
assert(tiMixed.alignment === 0.5, "50/50 alignment", `got ${tiMixed.alignment}`);

// ================================================================
// SCENARIO 10: No change from baseline
// ================================================================
console.log("\n=== TRANSITION INTENSITY — No change from baseline ===");
const tiNone = computeTransitionIntensity(stableBaseline, stableBaseline);
console.log(`  Magnitude=${tiNone.magnitude.toFixed(2)}, Alignment=${tiNone.alignment}, Normalized=${(tiNone.normalized*100).toFixed(0)}%, Label=${tiNone.label}`);
assert(tiNone.label === "STABLE", "No change = STABLE", `got ${tiNone.label}`);
assert(tiNone.magnitude === 0, "Zero magnitude", `got ${tiNone.magnitude}`);

// ================================================================
// EDGE CASES
// ================================================================
console.log("\n=== EDGE: Single signal ===");
const single = [{ id: "x", category: "kernel", severity: "critical" }];
const singleGini = computeGini(single);
console.log(`  Gini=${singleGini.toFixed(4)}`);
assert(singleGini === 0, "Single signal Gini = 0", `got ${singleGini}`);

console.log("\n=== EDGE: Empty signals ===");
const emptyGini = computeGini([]);
const emptyMean = computeMeanSeverity([]);
console.log(`  Gini=${emptyGini}, Mean=${emptyMean}`);
assert(emptyGini === 0, "Empty Gini = 0", `got ${emptyGini}`);
assert(emptyMean === 1, "Empty Mean = 1 (fallback)", `got ${emptyMean}`);

console.log("\n=== EDGE: Known Gini values ===");
// Uniform distribution [2,2,2,2] -> G = 0
const uniform = [
  { severity: "moderate" }, { severity: "moderate" },
  { severity: "moderate" }, { severity: "moderate" },
];
const gUniform = computeGini(uniform);
console.log(`  Uniform [2,2,2,2]: Gini=${gUniform.toFixed(4)}`);
assert(gUniform === 0, "Uniform Gini = 0", `got ${gUniform}`);

// Extreme [4,1,1,1] -> G should be > 0.3
const extreme = [
  { severity: "critical" }, { severity: "watch" },
  { severity: "watch" }, { severity: "watch" },
];
const gExtreme = computeGini(extreme);
console.log(`  Extreme [4,1,1,1]: Gini=${gExtreme.toFixed(4)}`);
assert(gExtreme > 0.3, "Extreme Gini > 0.3", `got ${gExtreme.toFixed(4)}`);

// Maximum inequality [4,1] -> G should be ~0.3
const maxIneq = [{ severity: "critical" }, { severity: "watch" }];
const gMax = computeGini(maxIneq);
console.log(`  Max inequality [4,1]: Gini=${gMax.toFixed(4)}`);
assert(gMax > 0.2, "Max inequality Gini > 0.2", `got ${gMax.toFixed(4)}`);

// ================================================================
// SUMMARY
// ================================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failed > 0) {
  console.log("FAILURES DETECTED — review output above");
  process.exit(1);
} else {
  console.log("ALL ASSERTIONS PASSED");
}
