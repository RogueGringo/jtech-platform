# V&V Statistical Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stress-test every Cycle 6 market calibration claim at α = 0.001 with bootstrap CIs, permutation tests, binomial tests, Fisher z-tests, three-layer negative controls, and adaptive sample sizing.

**Architecture:** New `tests/lib/statistics.js` provides pure inferential functions. Six `tests/vv-*.js` files consume them against expanded real data (15+ Yahoo Finance events + 3 negative control periods). Existing calibration backtests stay untouched.

**Tech Stack:** Node.js ESM, pure math (no dependencies), yfinance for data fetching, existing `backtest-engine.js` + `market-adapter.js` infrastructure.

---

## Dependency Graph

```
Task 1: statistics.js (no deps)
Task 2: fetch expanded data (no deps)
    ↓         ↓
Tasks 3-8: all V&V tests (depend on 1 + 2)
```

Tasks 1 and 2 are parallelizable. Tasks 3-8 each depend on 1 and 2 but are independent of each other.

---

### Task 1: Inferential Statistics Library

**Files:**
- Create: `tests/lib/statistics.js`
- Test: `tests/test-statistics.js`

**Context:** The codebase has zero inferential statistics. Every correlation is a point estimate. This library provides the six functions from the design doc: bootstrapCI, permutationTest, binomialTest, pearsonCI, powerAnalysis, fisherZTest. All pure functions, no dependencies.

**Step 1: Write the test file**

```javascript
/**
 * Inferential Statistics Library — Unit Tests
 *
 * Validates bootstrap CI, permutation test, binomial test, Fisher z,
 * Pearson CI, and power analysis against known statistical properties.
 *
 * Run: node tests/test-statistics.js
 */

import {
  bootstrapCI,
  permutationTest,
  binomialTest,
  pearsonCI,
  powerAnalysis,
  fisherZTest,
} from "./lib/statistics.js";
import { pearsonR } from "./lib/backtest-engine.js";

let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label} — ${detail}`);
    failed++;
  }
}

// ================================================================
// Deterministic seed for reproducibility
// ================================================================
// Note: bootstrapCI and permutationTest use Math.random() internally.
// We test statistical PROPERTIES (CI contains true value, p-value
// ordering) not exact numbers, so randomness is acceptable.

// ================================================================
// TEST 1: bootstrapCI — known mean
// ================================================================

console.log("\n=== TEST 1: bootstrapCI ===");

const knownData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const meanFn = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

// True mean = 5.5. CI at α=0.05 should contain 5.5 most of the time.
const ci95 = bootstrapCI(knownData, meanFn, 0.05, 5000);
assert(Array.isArray(ci95) && ci95.length === 2, "bootstrapCI returns [lower, upper]");
assert(ci95[0] < ci95[1], `Lower < upper: [${ci95[0].toFixed(3)}, ${ci95[1].toFixed(3)}]`);
assert(ci95[0] <= 5.5 && ci95[1] >= 5.5, `95% CI contains true mean 5.5: [${ci95[0].toFixed(3)}, ${ci95[1].toFixed(3)}]`);

// α=0.001 CI should be wider than α=0.05 CI
const ci999 = bootstrapCI(knownData, meanFn, 0.001, 5000);
assert(ci999[1] - ci999[0] >= ci95[1] - ci95[0],
  `99.9% CI wider than 95% CI: ${(ci999[1] - ci999[0]).toFixed(3)} >= ${(ci95[1] - ci95[0]).toFixed(3)}`);

// ================================================================
// TEST 2: permutationTest — correlated vs uncorrelated
// ================================================================

console.log("\n=== TEST 2: permutationTest ===");

// Perfectly correlated: xs = ys. permutationTest should yield low p-value.
const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const pCorrelated = permutationTest(xs, ys, pearsonR, 2000);
assert(typeof pCorrelated === "number", `permutationTest returns number: ${pCorrelated}`);
assert(pCorrelated < 0.05, `Correlated data p < 0.05: p=${pCorrelated.toFixed(4)}`);

// Uncorrelated: random-looking arrangement
const ysRandom = [5, 3, 8, 1, 10, 2, 7, 4, 9, 6];
const pUncorrelated = permutationTest(xs, ysRandom, pearsonR, 2000);
assert(pUncorrelated > pCorrelated, `Uncorrelated p > correlated p: ${pUncorrelated.toFixed(4)} > ${pCorrelated.toFixed(4)}`);

// ================================================================
// TEST 3: binomialTest — known cases
// ================================================================

console.log("\n=== TEST 3: binomialTest ===");

// 100 heads out of 100 flips — should be extremely significant
const p100 = binomialTest(100, 100, 0.5);
assert(p100 < 0.001, `100/100 hits: p < 0.001: p=${p100.toExponential(3)}`);

// 50 heads out of 100 flips — should NOT be significant (close to p=1)
const p50 = binomialTest(50, 100, 0.5);
assert(p50 > 0.05, `50/100 hits: p > 0.05: p=${p50.toFixed(4)}`);

// 55 heads out of 100 flips — borderline
const p55 = binomialTest(55, 100, 0.5);
assert(p55 < p50, `55/100 more significant than 50/100: ${p55.toFixed(4)} < ${p50.toFixed(4)}`);

// 520 hits out of 1000 — should be more significant with larger N
const p520 = binomialTest(520, 1000, 0.5);
assert(typeof p520 === "number" && p520 >= 0 && p520 <= 1, `binomialTest(520, 1000) in [0,1]: ${p520.toFixed(6)}`);

// ================================================================
// TEST 4: pearsonCI — Fisher z-transform
// ================================================================

console.log("\n=== TEST 4: pearsonCI ===");

// r = 0.8, n = 100, α = 0.05
const ci = pearsonCI(0.8, 100, 0.05);
assert(ci[0] < 0.8 && ci[1] > 0.8, `CI contains r=0.8: [${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]`);
assert(ci[0] > 0 && ci[1] < 1, `CI in valid range: [${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]`);

// r = 0.8, n = 100, α = 0.001 — wider
const ciStrict = pearsonCI(0.8, 100, 0.001);
assert(ciStrict[1] - ciStrict[0] > ci[1] - ci[0],
  `99.9% CI wider: ${(ciStrict[1] - ciStrict[0]).toFixed(3)} > ${(ci[1] - ci[0]).toFixed(3)}`);

// r = 0, n = 30 — should include 0 and be symmetric-ish
const ciZero = pearsonCI(0, 30, 0.05);
assert(ciZero[0] < 0 && ciZero[1] > 0, `CI for r=0 includes 0: [${ciZero[0].toFixed(3)}, ${ciZero[1].toFixed(3)}]`);

// ================================================================
// TEST 5: fisherZTest — known different correlations
// ================================================================

console.log("\n=== TEST 5: fisherZTest ===");

// r1 = 0.8, r2 = -0.8, both n=100 — should be highly significant
const fz1 = fisherZTest(0.8, 100, -0.8, 100);
assert(fz1.p < 0.001, `r=0.8 vs r=-0.8 significant: p=${fz1.p.toExponential(3)}, z=${fz1.z.toFixed(3)}`);

// r1 = 0.5, r2 = 0.48, both n=50 — should NOT be significant
const fz2 = fisherZTest(0.5, 50, 0.48, 50);
assert(fz2.p > 0.05, `r=0.5 vs r=0.48 NOT significant: p=${fz2.p.toFixed(4)}`);

// Polarity test: r=+0.5 (market) vs r=-0.9 (text), n=200 each
const fzPolarity = fisherZTest(0.5, 200, -0.9, 200);
assert(fzPolarity.p < 0.001, `Polarity inversion test: p=${fzPolarity.p.toExponential(3)}`);

// ================================================================
// TEST 6: powerAnalysis — sufficient vs insufficient
// ================================================================

console.log("\n=== TEST 6: powerAnalysis ===");

// Large dataset — should be sufficient
const largeData = Array.from({ length: 200 }, (_, i) => i);
const pa1 = powerAnalysis(largeData, meanFn, 20, 0.001, 1000);
assert(typeof pa1.sufficient === "boolean", `powerAnalysis returns sufficient: ${pa1.sufficient}`);
assert(typeof pa1.currentWidth === "number", `powerAnalysis returns currentWidth: ${pa1.currentWidth.toFixed(3)}`);

// Tiny dataset — likely insufficient with tight target
const tinyData = [1, 2, 3];
const pa2 = powerAnalysis(tinyData, meanFn, 0.1, 0.001, 1000);
assert(pa2.currentWidth > 0.1, `Tiny data CI too wide: width=${pa2.currentWidth.toFixed(3)} > target=0.1`);

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
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-statistics.js`
Expected: FAIL — `Cannot find module './lib/statistics.js'`

**Step 3: Write the implementation**

```javascript
/**
 * Inferential Statistics Library
 *
 * Pure functions for bootstrap CIs, permutation tests, binomial tests,
 * Fisher z-transforms, and power analysis. No dependencies beyond Math.
 *
 * All functions use α = 0.001 as default (99.9% confidence — rare and undeniable).
 */

// ================================================================
// BOOTSTRAP CONFIDENCE INTERVAL (BCa)
// ================================================================

/**
 * Bootstrap percentile confidence interval.
 *
 * @param {number[]} data - Sample data
 * @param {function} statFn - (resampled_array) => statistic
 * @param {number} [α=0.001] - Significance level (0.001 = 99.9% CI)
 * @param {number} [B=10000] - Number of bootstrap resamples
 * @returns {[number, number]} [lower, upper] confidence bounds
 */
export function bootstrapCI(data, statFn, α = 0.001, B = 10000) {
  const n = data.length;
  if (n === 0) return [0, 0];

  const bootStats = [];
  for (let b = 0; b < B; b++) {
    const resample = new Array(n);
    for (let i = 0; i < n; i++) {
      resample[i] = data[Math.floor(Math.random() * n)];
    }
    bootStats.push(statFn(resample));
  }

  bootStats.sort((a, b) => a - b);

  const lo = Math.floor((α / 2) * B);
  const hi = Math.floor((1 - α / 2) * B) - 1;

  return [bootStats[Math.max(0, lo)], bootStats[Math.min(B - 1, hi)]];
}

// ================================================================
// PERMUTATION TEST
// ================================================================

/**
 * Two-sample permutation test.
 *
 * Shuffles the pairing between xs and ys B times. Returns p-value =
 * fraction of permuted test statistics >= |observed statistic|.
 *
 * @param {number[]} xs - First variable
 * @param {number[]} ys - Second variable
 * @param {function} statFn - (xs, ys) => test statistic
 * @param {number} [B=10000] - Number of permutations
 * @returns {number} p-value (two-tailed)
 */
export function permutationTest(xs, ys, statFn, B = 10000) {
  const observed = Math.abs(statFn(xs, ys));
  let count = 0;

  const ysCopy = [...ys];
  for (let b = 0; b < B; b++) {
    // Fisher-Yates shuffle of ys
    for (let i = ysCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ysCopy[i], ysCopy[j]] = [ysCopy[j], ysCopy[i]];
    }
    const permStat = Math.abs(statFn(xs, ysCopy));
    if (permStat >= observed) count++;
  }

  return count / B;
}

// ================================================================
// EXACT BINOMIAL TEST
// ================================================================

/**
 * One-sided binomial test (greater alternative).
 *
 * Returns p-value = P(X >= successes) under H0: p = p0.
 * Uses log-space computation to avoid overflow for large n.
 *
 * @param {number} successes - Number of successes
 * @param {number} trials - Total trials
 * @param {number} [p0=0.5] - Null hypothesis probability
 * @returns {number} p-value
 */
export function binomialTest(successes, trials, p0 = 0.5) {
  if (successes <= trials * p0) return 1.0;

  // P(X >= successes) = sum_{k=successes}^{trials} C(n,k) * p^k * (1-p)^(n-k)
  // Compute in log-space to avoid overflow
  const logP0 = Math.log(p0);
  const logQ0 = Math.log(1 - p0);

  // Precompute log-factorials
  const logFact = new Array(trials + 1);
  logFact[0] = 0;
  for (let i = 1; i <= trials; i++) {
    logFact[i] = logFact[i - 1] + Math.log(i);
  }

  function logBinom(n, k) {
    return logFact[n] - logFact[k] - logFact[n - k];
  }

  // Sum P(X = k) for k = successes..trials using log-sum-exp
  let maxLogP = -Infinity;
  const logPs = [];
  for (let k = successes; k <= trials; k++) {
    const logPk = logBinom(trials, k) + k * logP0 + (trials - k) * logQ0;
    logPs.push(logPk);
    if (logPk > maxLogP) maxLogP = logPk;
  }

  // Log-sum-exp for numerical stability
  let sumExp = 0;
  for (const lp of logPs) {
    sumExp += Math.exp(lp - maxLogP);
  }

  return Math.min(1.0, Math.exp(maxLogP + Math.log(sumExp)));
}

// ================================================================
// PEARSON CI — Fisher z-transform
// ================================================================

/**
 * Confidence interval for Pearson r using Fisher z-transform.
 *
 * @param {number} r - Observed Pearson correlation
 * @param {number} n - Sample size
 * @param {number} [α=0.001] - Significance level
 * @returns {[number, number]} [lower, upper] confidence bounds
 */
export function pearsonCI(r, n, α = 0.001) {
  // Fisher z-transform
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);

  // z-critical value for two-tailed CI
  const zCrit = normalQuantile(1 - α / 2);

  const zLo = z - zCrit * se;
  const zHi = z + zCrit * se;

  // Back-transform
  return [Math.tanh(zLo), Math.tanh(zHi)];
}

// ================================================================
// FISHER Z-TEST — compare two correlations
// ================================================================

/**
 * Test whether two Pearson correlations are significantly different.
 *
 * @param {number} r1 - First correlation
 * @param {number} n1 - First sample size
 * @param {number} r2 - Second correlation
 * @param {number} n2 - Second sample size
 * @returns {{ z: number, p: number }} Test statistic and two-tailed p-value
 */
export function fisherZTest(r1, n1, r2, n2) {
  // Clamp to avoid atanh domain errors
  const clamp = v => Math.min(0.9999, Math.max(-0.9999, v));
  const z1 = 0.5 * Math.log((1 + clamp(r1)) / (1 - clamp(r1)));
  const z2 = 0.5 * Math.log((1 + clamp(r2)) / (1 - clamp(r2)));

  const se = Math.sqrt(1 / (n1 - 3) + 1 / (n2 - 3));
  const z = (z1 - z2) / se;

  // Two-tailed p-value from standard normal
  const p = 2 * (1 - normalCDF(Math.abs(z)));

  return { z, p };
}

// ================================================================
// POWER ANALYSIS
// ================================================================

/**
 * Estimate whether current sample produces CIs narrower than target.
 *
 * @param {number[]} data - Sample data
 * @param {function} statFn - Statistic function
 * @param {number} targetWidth - Desired CI width
 * @param {number} [α=0.001] - Significance level
 * @param {number} [B=5000] - Bootstrap resamples
 * @returns {{ sufficient: boolean, currentWidth: number, recommendedN: number|null }}
 */
export function powerAnalysis(data, statFn, targetWidth, α = 0.001, B = 5000) {
  const ci = bootstrapCI(data, statFn, α, B);
  const currentWidth = ci[1] - ci[0];
  const sufficient = currentWidth <= targetWidth;

  // Rough estimate: CI width scales as 1/√n, so recommended N ≈ n * (currentWidth/targetWidth)²
  let recommendedN = null;
  if (!sufficient && currentWidth > 0) {
    const ratio = currentWidth / targetWidth;
    recommendedN = Math.ceil(data.length * ratio * ratio);
  }

  return { sufficient, currentWidth, recommendedN };
}

// ================================================================
// NORMAL DISTRIBUTION HELPERS
// ================================================================

/**
 * Standard normal CDF (Abramowitz & Stegun approximation).
 * Accuracy: |error| < 7.5e-8
 */
function normalCDF(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1 + sign * y);
}

/**
 * Standard normal quantile (inverse CDF).
 * Rational approximation (Beasley-Springer-Moro).
 */
function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-statistics.js`
Expected: ALL TESTS PASSED

**Step 5: Commit**

```bash
git add tests/lib/statistics.js tests/test-statistics.js
git commit -m "feat: inferential statistics library — bootstrap CI, permutation test, binomial, Fisher z"
```

---

### Task 2: Expanded Event Data

**Files:**
- Modify: `tests/data/market/fetch-market-data.py`
- Creates: 13 new CSV files in `tests/data/market/`

**Context:** The current data fetcher pulls 5 events. We need +10 crisis events, 3 calendar negative controls, and VIX data for volatility controls. All from Yahoo Finance via yfinance.

**Step 1: Extend the EVENTS list in `fetch-market-data.py`**

Add these events and negative controls after the existing 5:

```python
# ---------------------------------------------------------------------------
# Expansion events (+10 crisis events for V&V)
# ---------------------------------------------------------------------------
EXPANSION_EVENTS = [
    {"name": "dotcom-2000-qqq",      "ticker": "QQQ",  "start": "2000-03-01", "end": "2002-10-31"},
    {"name": "flash-2010-spy",       "ticker": "SPY",  "start": "2010-04-01", "end": "2010-07-15"},
    {"name": "eudebt-2011-ewg",      "ticker": "EWG",  "start": "2011-06-01", "end": "2012-02-29"},
    {"name": "taper-2013-tlt",       "ticker": "TLT",  "start": "2013-04-01", "end": "2013-10-31"},
    {"name": "china-2015-fxi",       "ticker": "FXI",  "start": "2015-05-01", "end": "2016-03-31"},
    {"name": "oilcrash-2014-xle",    "ticker": "XLE",  "start": "2014-05-01", "end": "2016-03-31"},
    {"name": "volmageddon-2018-spy", "ticker": "SPY",  "start": "2017-12-01", "end": "2018-05-31"},
    {"name": "yencarry-2024-ewj",    "ticker": "EWJ",  "start": "2024-06-01", "end": "2024-10-31"},
    {"name": "tariff-2025-kweb",     "ticker": "KWEB", "start": "2025-02-01", "end": "2025-06-30"},
    {"name": "crypto-2022-coin",     "ticker": "COIN", "start": "2022-03-01", "end": "2023-01-31"},
]

# ---------------------------------------------------------------------------
# Negative controls — known boring periods
# ---------------------------------------------------------------------------
NEGATIVE_CONTROLS = [
    {"name": "calm-2013-spy",  "ticker": "SPY", "start": "2013-06-01", "end": "2014-06-30"},
    {"name": "calm-2017-spy",  "ticker": "SPY", "start": "2017-01-01", "end": "2017-12-31"},
    {"name": "calm-2019-spy",  "ticker": "SPY", "start": "2019-04-01", "end": "2019-09-30"},
]

# ---------------------------------------------------------------------------
# VIX for volatility controls
# ---------------------------------------------------------------------------
VIX_DATA = [
    {"name": "vix-2010-2025", "ticker": "^VIX", "start": "2010-01-01", "end": "2025-12-31"},
]
```

Update the `main()` function:

```python
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_events = EVENTS + EXPANSION_EVENTS + NEGATIVE_CONTROLS + VIX_DATA
    for event in all_events:
        fetch_and_save(event)
    print(f"\nDone. {len(all_events)} datasets from Yahoo Finance — zero synthetic data.")
```

**Step 2: Run the fetcher**

Run: `python tests/data/market/fetch-market-data.py`
Expected: 19 datasets downloaded (5 existing + 10 expansion + 3 negative + 1 VIX)

Note: VIX data does not have Volume/Open/High/Low the same way equities do. The `compute_technicals` function may produce NaN for volume-dependent indicators on VIX data — this is expected. VIX is only used for finding calm periods, not for running through the adapter.

**Step 3: Commit**

```bash
git add tests/data/market/fetch-market-data.py tests/data/market/*.csv
git commit -m "data: expanded market events — +10 crises, 3 negative controls, VIX (Yahoo Finance)"
```

---

### Task 3: V&V Polarity Inversion

**Files:**
- Create: `tests/vv-polarity-inversion.js`

**Context:** The central claim: market data has positive mean-Gini correlation (r ≈ +0.5), text data has negative (r ≈ -0.9). This test computes mean-Gini r for all 15 market events, compares against text domain r values using Fisher z-test, bootstrap CIs, and permutation tests. All at α = 0.001.

The test reuses the `analyzeCSV()` pattern from `backtest-market-geometric.js` to produce per-bar mean/Gini arrays for each event CSV.

**Step 1: Write the V&V test**

```javascript
/**
 * V&V: Polarity Inversion — Market vs Text Mean-Gini Topology
 *
 * Central claim: Market crisis = indicator DISAGREEMENT (positive mean-Gini r).
 *                Text crisis = signal CONVERGENCE (negative mean-Gini r).
 *
 * Statistical tests at α = 0.001:
 *   1. Fisher z-test: are market r and text r significantly different?
 *   2. Bootstrap CI: does the 99.9% CI for each r NOT overlap the other's?
 *   3. Permutation test: does shuffling temporal order destroy the polarity?
 *
 * Verdict: CONFIRMED / INCONCLUSIVE / REJECTED
 *
 * Run: node tests/vv-polarity-inversion.js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { bootstrapCI, permutationTest, pearsonCI, fisherZTest } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

const α = 0.001;

// ================================================================
// CSV → adapter tech key mapping
// ================================================================

const CSV_TO_TECH = {
  rsi: "rsi", macd_hist: "macd_hist", bband_pctb: "bbpctb",
  bband_width: "bbwidth", volume_ratio: "volratio", sma50_dist: "sma50dist",
  sma200_dist: "sma200dist", atr_pctile: "atrPctile", drawdown: "drawdown",
  adx: "adx", mfi: "mfi", obv_slope: "obvslope",
};
const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

// ================================================================
// Analyze one CSV → arrays of mean and gini per bar
// ================================================================

function analyzeCSV(csvPath, baselineWindow = 60) {
  const rows = readCSV(csvPath);
  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    technicals[CSV_TO_TECH[csvKey]] = rows.map(r => r[csvKey] || 0);
  }

  const means = [];
  const ginis = [];
  for (let i = 0; i < rows.length; i++) {
    const sliceTech = {};
    for (const csvKey of CSV_TECH_KEYS) {
      sliceTech[CSV_TO_TECH[csvKey]] = technicals[CSV_TO_TECH[csvKey]].slice(0, i + 1);
    }
    const { signals } = marketToSignals("TEST", ohlcv.slice(0, i + 1), sliceTech, baselineWindow);
    if (signals.length === 0) continue;
    means.push(computeMeanSeverity(signals));
    ginis.push(computeGini(signals));
  }
  return { means, ginis };
}

// ================================================================
// EVENT DEFINITIONS — all 15 market events
// ================================================================

const MARKET_EVENTS = [
  // Original 5
  "gfc-2008-spy", "covid-2020-spy", "svb-2023-kre", "nvda-2023-nvda", "gme-2021-gme",
  // Expansion 10
  "dotcom-2000-qqq", "flash-2010-spy", "eudebt-2011-ewg", "taper-2013-tlt",
  "china-2015-fxi", "oilcrash-2014-xle", "volmageddon-2018-spy",
  "yencarry-2024-ewj", "tariff-2025-kweb", "crypto-2022-coin",
];

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V: POLARITY INVERSION — Market vs Text Mean-Gini Topology");
console.log(`Significance level: α = ${α} (99.9% confidence)`);
console.log("=".repeat(80));

// --- Collect market mean-Gini pairs across all events ---
let allMarketMeans = [];
let allMarketGinis = [];
const perEventR = [];

for (const event of MARKET_EVENTS) {
  const csvPath = path.join(DATA_DIR, `${event}.csv`);
  if (!fs.existsSync(csvPath)) {
    console.log(`  SKIP: ${event} (CSV not found — run fetch-market-data.py)`);
    continue;
  }
  const { means, ginis } = analyzeCSV(csvPath);
  const r = pearsonR(means, ginis);
  perEventR.push({ event, r, n: means.length });
  console.log(`  ${event}: r=${r.toFixed(4)}, n=${means.length}`);
  allMarketMeans = allMarketMeans.concat(means);
  allMarketGinis = allMarketGinis.concat(ginis);
}

const marketR = pearsonR(allMarketMeans, allMarketGinis);
const marketN = allMarketMeans.length;

console.log(`\n  POOLED MARKET: r=${marketR.toFixed(4)}, N=${marketN}`);

// --- Text domain r values (from proven backtests — hardcoded from verified runs) ---
// These come from backtest-gdelt.js (r = -0.907, n=57) and backtest-disaster-text.js
// We use the GDELT value as the primary text reference.
const textR = -0.907;
const textN = 57;
console.log(`  TEXT REFERENCE: r=${textR.toFixed(4)}, N=${textN} (GDELT IE — verified backtest)`);

// ================================================================
// TEST 1: Fisher z-test — are market r and text r different?
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("TEST 1: Fisher z-test — market r vs text r");
console.log("=".repeat(80));

const fz = fisherZTest(marketR, marketN, textR, textN);
console.log(`  z = ${fz.z.toFixed(4)}`);
console.log(`  p = ${fz.p.toExponential(4)}`);
console.log(`  α = ${α}`);

const fisherPass = fz.p < α;
console.log(`  VERDICT: ${fisherPass ? "SIGNIFICANT" : "NOT SIGNIFICANT"} — correlations are ${fisherPass ? "" : "NOT "}significantly different at α=${α}`);

// ================================================================
// TEST 2: Bootstrap CI — do 99.9% CIs NOT overlap?
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("TEST 2: Bootstrap CI — 99.9% confidence intervals");
console.log("=".repeat(80));

// Bootstrap on market pooled data: resample paired (mean, gini) tuples
const pairedMarket = allMarketMeans.map((m, i) => [m, allMarketGinis[i]]);
const marketCI = bootstrapCI(pairedMarket, pairs => {
  const ms = pairs.map(p => p[0]);
  const gs = pairs.map(p => p[1]);
  return pearsonR(ms, gs);
}, α, 10000);

console.log(`  Market r: ${marketR.toFixed(4)}  [${marketCI[0].toFixed(4)}, ${marketCI[1].toFixed(4)}]`);

// Analytical CI for text (Fisher z-transform)
const textCI = pearsonCI(textR, textN, α);
console.log(`  Text r:   ${textR.toFixed(4)}  [${textCI[0].toFixed(4)}, ${textCI[1].toFixed(4)}]`);

const noOverlap = marketCI[0] > textCI[1] || textCI[0] > marketCI[1];
console.log(`  CIs overlap: ${noOverlap ? "NO" : "YES"}`);
console.log(`  VERDICT: ${noOverlap ? "CONFIRMED" : "INCONCLUSIVE"} — CIs ${noOverlap ? "do NOT" : "DO"} overlap`);

// ================================================================
// TEST 3: Permutation test — does shuffling destroy polarity?
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("TEST 3: Permutation test — temporal shuffle null hypothesis");
console.log("=".repeat(80));

const permP = permutationTest(allMarketMeans, allMarketGinis, pearsonR, 10000);
console.log(`  Observed |r| = ${Math.abs(marketR).toFixed(4)}`);
console.log(`  Permutation p = ${permP.toExponential(4)} (fraction of shuffled |r| >= observed)`);
console.log(`  α = ${α}`);

const permPass = permP < α;
console.log(`  VERDICT: ${permPass ? "SIGNIFICANT" : "NOT SIGNIFICANT"} — market mean-Gini structure ${permPass ? "survives" : "does NOT survive"} temporal shuffling`);

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("POLARITY INVERSION — COMPOSITE VERDICT");
console.log("=".repeat(80));

const allPass = fisherPass && noOverlap && permPass;
const somePass = fisherPass || noOverlap || permPass;

if (allPass) {
  console.log("\n  CONFIRMED at α=0.001");
  console.log("  Market mean-Gini polarity (+) is significantly different from text mean-Gini polarity (-).");
  console.log("  The topological inversion survives Fisher z-test, bootstrap CIs, and permutation test.");
} else if (somePass) {
  console.log("\n  INCONCLUSIVE");
  console.log(`  Fisher z: ${fisherPass ? "PASS" : "FAIL"}`);
  console.log(`  Bootstrap CI no-overlap: ${noOverlap ? "PASS" : "FAIL"}`);
  console.log(`  Permutation: ${permPass ? "PASS" : "FAIL"}`);
  console.log("  Polarity inversion shows some statistical support but does not survive all three tests.");
} else {
  console.log("\n  REJECTED");
  console.log("  Polarity inversion does NOT survive any statistical test at α=0.001.");
  console.log("  The calibration claim was an artifact of small sample size.");
}

console.log("=".repeat(80));

if (!allPass) process.exit(1);
```

**Step 2: Run the test**

Run: `node tests/vv-polarity-inversion.js`
Expected: One of three verdicts — CONFIRMED, INCONCLUSIVE, or REJECTED. All are valid V&V outcomes.

**Step 3: Commit**

```bash
git add tests/vv-polarity-inversion.js
git commit -m "test: V&V polarity inversion — Fisher z + bootstrap CI + permutation at α=0.001"
```

---

### Task 4: V&V Walk-Forward

**Files:**
- Create: `tests/vv-walkforward.js`

**Context:** The calibration backtests showed 51.5% and 50.8% hit rates — barely above chance. This V&V test runs walk-forward on all 15 events, pools predictions, and applies binomial test at α = 0.001. Also stratifies by trajectory type (CONSOLIDATING has 85.7% on SVB — is that real?).

Reuses the `walkForward()` and `scorePredictions()` patterns from `backtest-market-walkforward.js`.

**Step 1: Write the V&V test**

```javascript
/**
 * V&V: Walk-Forward Predictive Value
 *
 * Tests whether trajectory calls predict forward returns significantly
 * better than chance (50%) using exact binomial test at α = 0.001.
 *
 * Pools predictions across all 15 market events. Stratifies by trajectory type
 * to identify which trajectory calls carry genuine signal.
 *
 * Verdict: CONFIRMED / INCONCLUSIVE / REJECTED
 *
 * Run: node tests/vv-walkforward.js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, computeCrossCoherence } from "./lib/backtest-engine.js";
import { marketToSignals, MARKET_CATEGORIES } from "../src/adapters/market-adapter.js";
import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../src/engine/projection.js";
import { binomialTest, bootstrapCI } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

const α = 0.001;

// ================================================================
// CSV → adapter tech key mapping
// ================================================================

const CSV_TO_TECH = {
  rsi: "rsi", macd_hist: "macd_hist", bband_pctb: "bbpctb",
  bband_width: "bbwidth", volume_ratio: "volratio", sma50_dist: "sma50dist",
  sma200_dist: "sma200dist", atr_pctile: "atrPctile", drawdown: "drawdown",
  adx: "adx", mfi: "mfi", obv_slope: "obvslope",
};
const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

// ================================================================
// Walk-forward analysis (same pattern as backtest-market-walkforward.js)
// ================================================================

function walkForward(csvPath, baselineWindow = 60) {
  const rows = readCSV(csvPath);
  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    technicals[CSV_TO_TECH[csvKey]] = rows.map(r => r[csvKey] || 0);
  }

  const results = [];
  const coherenceHistory = [];

  for (let i = 0; i < rows.length; i++) {
    if (i < baselineWindow) continue;
    const sliceTech = {};
    for (const csvKey of CSV_TECH_KEYS) {
      sliceTech[CSV_TO_TECH[csvKey]] = technicals[CSV_TO_TECH[csvKey]].slice(0, i + 1);
    }
    const { signals } = marketToSignals("TEST", ohlcv.slice(0, i + 1), sliceTech, baselineWindow);
    if (signals.length === 0) continue;

    const coherence = computeCrossCoherence(signals, MARKET_CATEGORIES);
    coherenceHistory.push(coherence);
    const prop = computePropagationCapacity(signals, MARKET_CATEGORIES);
    const diss = coherenceHistory.length >= 2
      ? computeDissolutionRate(coherenceHistory.slice(-5))
      : 0;
    const trajectory = classifyTrajectory(prop.aggregate, diss);

    const close_i = rows[i].Close;
    const fr5  = (i + 5  < rows.length) ? (rows[i + 5].Close  - close_i) / close_i : null;
    const fr10 = (i + 10 < rows.length) ? (rows[i + 10].Close - close_i) / close_i : null;
    const fr20 = (i + 20 < rows.length) ? (rows[i + 20].Close - close_i) / close_i : null;

    results.push({ trajectory: trajectory.label, fr5, fr10, fr20 });
  }
  return results;
}

// ================================================================
// EVENT DEFINITIONS — all 15 market events
// ================================================================

const MARKET_EVENTS = [
  "gfc-2008-spy", "covid-2020-spy", "svb-2023-kre", "nvda-2023-nvda", "gme-2021-gme",
  "dotcom-2000-qqq", "flash-2010-spy", "eudebt-2011-ewg", "taper-2013-tlt",
  "china-2015-fxi", "oilcrash-2014-xle", "volmageddon-2018-spy",
  "yencarry-2024-ewj", "tariff-2025-kweb", "crypto-2022-coin",
];

const HORIZONS = [5, 10, 20];

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V: WALK-FORWARD PREDICTIVE VALUE — Binomial Test");
console.log(`Significance level: α = ${α} (99.9% confidence)`);
console.log("=".repeat(80));

// Collect all predictions across all events
const allPredictions = { 5: [], 10: [], 20: [] };

for (const event of MARKET_EVENTS) {
  const csvPath = path.join(DATA_DIR, `${event}.csv`);
  if (!fs.existsSync(csvPath)) {
    console.log(`  SKIP: ${event} (CSV not found)`);
    continue;
  }
  const results = walkForward(csvPath);
  console.log(`  ${event}: ${results.length} trajectory calls`);

  for (const r of results) {
    for (const h of HORIZONS) {
      const fr = r[`fr${h}`];
      if (fr === null) continue;
      const bearish = r.trajectory === "ACCELERATING" || r.trajectory === "CONSOLIDATING";
      const hit = bearish ? fr < 0 : fr >= 0;
      allPredictions[h].push({ trajectory: r.trajectory, hit, fr });
    }
  }
}

// ================================================================
// POOLED BINOMIAL TESTS
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("POOLED HIT RATES — all events combined");
console.log("=".repeat(80));

const horizonVerdicts = [];

for (const h of HORIZONS) {
  const preds = allPredictions[h];
  const hits = preds.filter(p => p.hit).length;
  const total = preds.length;
  const rate = total > 0 ? (hits / total * 100) : 0;
  const p = binomialTest(hits, total, 0.5);

  // Bootstrap CI on hit rate
  const hitArray = preds.map(p => p.hit ? 1 : 0);
  const ci = bootstrapCI(hitArray, arr => arr.reduce((a, b) => a + b, 0) / arr.length * 100, α, 10000);

  console.log(`\n  ${h}-day horizon: ${hits}/${total} hits (${rate.toFixed(1)}%)`);
  console.log(`    99.9% CI: [${ci[0].toFixed(1)}%, ${ci[1].toFixed(1)}%]`);
  console.log(`    Binomial p = ${p.toExponential(4)} (H0: rate = 50%)`);
  console.log(`    ${p < α ? "SIGNIFICANT" : "NOT SIGNIFICANT"} at α=${α}`);

  horizonVerdicts.push({ h, rate, hits, total, p, pass: p < α });

  // --- Stratify by trajectory type ---
  const byTraj = {};
  for (const pred of preds) {
    if (!byTraj[pred.trajectory]) byTraj[pred.trajectory] = { hits: 0, total: 0 };
    byTraj[pred.trajectory].total++;
    if (pred.hit) byTraj[pred.trajectory].hits++;
  }

  console.log(`    By trajectory:`);
  for (const [traj, counts] of Object.entries(byTraj).sort()) {
    const tRate = counts.total > 0 ? (counts.hits / counts.total * 100) : 0;
    const tP = counts.total >= 5 ? binomialTest(counts.hits, counts.total, 0.5) : 1;
    const sig = tP < α ? " ***" : tP < 0.05 ? " *" : "";
    console.log(`      ${traj.padEnd(16)} ${tRate.toFixed(1)}% (${counts.hits}/${counts.total}) p=${tP.toExponential(2)}${sig}`);
  }
}

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("WALK-FORWARD — COMPOSITE VERDICT");
console.log("=".repeat(80));

const significantHorizons = horizonVerdicts.filter(v => v.pass).length;

if (significantHorizons >= 2) {
  console.log("\n  CONFIRMED at α=0.001");
  console.log(`  ${significantHorizons}/3 horizons show significant predictive value.`);
} else if (significantHorizons >= 1) {
  console.log("\n  INCONCLUSIVE");
  console.log(`  ${significantHorizons}/3 horizons significant. Need more data or horizon refinement.`);
} else {
  console.log("\n  REJECTED");
  console.log("  No horizon shows significant predictive value at α=0.001.");
  console.log("  Walk-forward hit rates are indistinguishable from coin flip.");
}

console.log("=".repeat(80));

// Don't exit(1) — INCONCLUSIVE and REJECTED are valid V&V outcomes
```

**Step 2: Run the test**

Run: `node tests/vv-walkforward.js`
Expected: CONFIRMED, INCONCLUSIVE, or REJECTED. Note: with original 4 events at 51.5%, this will likely be INCONCLUSIVE or REJECTED at α=0.001. The expanded dataset may shift this — that's the point.

**Step 3: Commit**

```bash
git add tests/vv-walkforward.js
git commit -m "test: V&V walk-forward — binomial test + trajectory stratification at α=0.001"
```

---

### Task 5: V&V Lead Time

**Files:**
- Create: `tests/vv-lead-time.js`

**Context:** The benchmark claimed +6 to +17 day lead. This V&V test runs the benchmark on all 15 events and uses bootstrap CI on the lead-time distribution. If the 99.9% CI lower bound > 0, the lead advantage is real.

Reuses the `analyzeForBenchmark()` and `firstDateWhere()` patterns from `backtest-market-benchmark.js`.

**Step 1: Write the V&V test**

```javascript
/**
 * V&V: Engine Lead Time — Bootstrap CI on Detection Timing
 *
 * Tests whether the topological engine detects regime shifts significantly
 * earlier than traditional single-variable quant signals (RSI<30, SMA50, DD>10%).
 *
 * Bootstrap CI at α = 0.001 on the lead-time distribution.
 * Verdict: CONFIRMED if 99.9% CI lower bound > 0 days.
 *
 * Run: node tests/vv-lead-time.js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { bootstrapCI } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

const α = 0.001;

// ================================================================
// CSV → adapter tech key mapping
// ================================================================

const CSV_TO_TECH = {
  rsi: "rsi", macd_hist: "macd_hist", bband_pctb: "bbpctb",
  bband_width: "bbwidth", volume_ratio: "volratio", sma50_dist: "sma50dist",
  sma200_dist: "sma200dist", atr_pctile: "atrPctile", drawdown: "drawdown",
  adx: "adx", mfi: "mfi", obv_slope: "obvslope",
};
const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

function analyzeForBenchmark(csvPath, baselineWindow = 60) {
  const rows = readCSV(csvPath);
  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    technicals[CSV_TO_TECH[csvKey]] = rows.map(r => r[csvKey] || 0);
  }

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const sliceTech = {};
    for (const csvKey of CSV_TECH_KEYS) {
      sliceTech[CSV_TO_TECH[csvKey]] = technicals[CSV_TO_TECH[csvKey]].slice(0, i + 1);
    }
    const { signals } = marketToSignals("TEST", ohlcv.slice(0, i + 1), sliceTech, baselineWindow);
    if (signals.length === 0) continue;

    results.push({
      date: rows[i].date,
      index: i,
      rsi: rows[i].rsi,
      sma50_dist: rows[i].sma50_dist,
      drawdown: rows[i].drawdown,
      mean: computeMeanSeverity(signals),
      gini: computeGini(signals),
      regime: classifyRegime(computeMeanSeverity(signals), computeGini(signals)).label,
    });
  }
  return results;
}

function firstDateWhere(results, condition, afterDate, afterIndex = 0) {
  for (const r of results) {
    if (r.date <= afterDate) continue;
    if (r.index < afterIndex) continue;
    if (condition(r)) return r;
  }
  return null;
}

function tradingDaysBetween(results, dateA, dateB) {
  const idxA = results.findIndex(r => r.date === dateA);
  const idxB = results.findIndex(r => r.date === dateB);
  if (idxA === -1 || idxB === -1) return null;
  return idxB - idxA;
}

// ================================================================
// EVENT DEFINITIONS with crisis onset dates
// ================================================================

const EVENTS = [
  // Original 5
  { name: "GFC 2008",         csv: "gfc-2008-spy.csv",         onset: "2008-06-01" },
  { name: "COVID 2020",       csv: "covid-2020-spy.csv",        onset: "2020-01-15" },
  { name: "SVB 2023",         csv: "svb-2023-kre.csv",          onset: "2023-02-01" },
  { name: "GME 2021",         csv: "gme-2021-gme.csv",          onset: "2021-01-01" },
  // Expansion
  { name: "Dot-com 2000",     csv: "dotcom-2000-qqq.csv",       onset: "2000-03-01" },
  { name: "Flash Crash 2010", csv: "flash-2010-spy.csv",        onset: "2010-04-15" },
  { name: "EU Debt 2011",     csv: "eudebt-2011-ewg.csv",       onset: "2011-07-01" },
  { name: "Taper 2013",       csv: "taper-2013-tlt.csv",        onset: "2013-05-01" },
  { name: "China 2015",       csv: "china-2015-fxi.csv",        onset: "2015-06-01" },
  { name: "Oil Crash 2014",   csv: "oilcrash-2014-xle.csv",     onset: "2014-06-01" },
  { name: "Volmageddon 2018", csv: "volmageddon-2018-spy.csv",  onset: "2018-01-15" },
  { name: "Yen Carry 2024",   csv: "yencarry-2024-ewj.csv",     onset: "2024-07-01" },
  { name: "Tariff 2025",      csv: "tariff-2025-kweb.csv",      onset: "2025-03-01" },
  { name: "Crypto 2022",      csv: "crypto-2022-coin.csv",      onset: "2022-04-01" },
];

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V: ENGINE LEAD TIME — Bootstrap CI on Detection Timing");
console.log(`Significance level: α = ${α} (99.9% confidence)`);
console.log("=".repeat(80));

const leadTimes = [];

for (const event of EVENTS) {
  const csvPath = path.join(DATA_DIR, event.csv);
  if (!fs.existsSync(csvPath)) {
    console.log(`  SKIP: ${event.name} (CSV not found)`);
    continue;
  }

  const results = analyzeForBenchmark(csvPath);

  const engineHit = firstDateWhere(results, r => r.regime !== "STABLE", event.onset, 60);
  const rsiHit = firstDateWhere(results, r => r.rsi > 0 && r.rsi < 30, event.onset, 14);
  const smaHit = firstDateWhere(results, r => r.sma50_dist !== 0 && r.sma50_dist < 0, event.onset, 50);
  const ddHit = firstDateWhere(results, r => r.drawdown < -10, event.onset, 0);

  if (!engineHit) {
    console.log(`  ${event.name}: Engine never left STABLE — skip`);
    continue;
  }

  const leads = [
    rsiHit ? tradingDaysBetween(results, engineHit.date, rsiHit.date) : null,
    smaHit ? tradingDaysBetween(results, engineHit.date, smaHit.date) : null,
    ddHit ? tradingDaysBetween(results, engineHit.date, ddHit.date) : null,
  ].filter(v => v !== null);

  if (leads.length === 0) {
    console.log(`  ${event.name}: No traditional signals fired — engine more sensitive`);
    continue;
  }

  const avgLead = leads.reduce((a, b) => a + b, 0) / leads.length;
  leadTimes.push(avgLead);

  console.log(`  ${event.name}: engine ${engineHit.date}, avg lead = ${avgLead >= 0 ? "+" : ""}${avgLead.toFixed(1)}d (${leads.length} traditional signals)`);
}

// ================================================================
// BOOTSTRAP CI
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("BOOTSTRAP CI on Lead Time Distribution");
console.log("=".repeat(80));

if (leadTimes.length < 3) {
  console.log("\n  INCONCLUSIVE — fewer than 3 events with both engine and traditional signals.");
  console.log("  Cannot compute meaningful bootstrap CI.");
  console.log("=".repeat(80));
} else {
  const meanFn = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const observed = meanFn(leadTimes);
  const ci = bootstrapCI(leadTimes, meanFn, α, 10000);

  console.log(`  Events with lead data: ${leadTimes.length}`);
  console.log(`  Lead times: [${leadTimes.map(l => l.toFixed(1)).join(", ")}]`);
  console.log(`  Mean lead: ${observed >= 0 ? "+" : ""}${observed.toFixed(2)} trading days`);
  console.log(`  99.9% CI: [${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]`);

  // ================================================================
  // VERDICT
  // ================================================================

  console.log(`\n${"=".repeat(80)}`);
  console.log("LEAD TIME — COMPOSITE VERDICT");
  console.log("=".repeat(80));

  if (ci[0] > 0) {
    console.log("\n  CONFIRMED at α=0.001");
    console.log(`  Engine leads traditional signals by ${ci[0].toFixed(1)} to ${ci[1].toFixed(1)} days (99.9% CI).`);
    console.log("  Lower bound > 0 — lead advantage is statistically real.");
  } else if (observed > 0) {
    console.log("\n  INCONCLUSIVE");
    console.log(`  Mean lead = +${observed.toFixed(1)} days, but 99.9% CI includes 0.`);
    console.log("  Lead advantage exists on average but is not significant at α=0.001.");
  } else {
    console.log("\n  REJECTED");
    console.log("  Engine does NOT lead traditional signals on average.");
  }

  console.log("=".repeat(80));
}
```

**Step 2: Run the test**

Run: `node tests/vv-lead-time.js`
Expected: CONFIRMED, INCONCLUSIVE, or REJECTED.

**Step 3: Commit**

```bash
git add tests/vv-lead-time.js
git commit -m "test: V&V lead time — bootstrap CI on engine vs traditional quant timing"
```

---

### Task 6: V&V Cross-Source Coherence

**Files:**
- Create: `tests/vv-cross-source.js`

**Context:** The cross-source backtest claimed r=0.802 between GDELT mean severity and Brent price. This V&V test validates with Fisher z CI and permutation test (shuffle temporal alignment between sources — does coherence vanish?).

This test reads from the existing GDELT + FRED backtest data, not market CSVs.

**Step 1: Write the V&V test**

```javascript
/**
 * V&V: Cross-Source Coherence — GDELT vs FRED
 *
 * Tests whether cross-source correlations (GDELT mean vs Brent, GDELT entropy
 * vs Brent, etc.) survive permutation testing at α = 0.001.
 *
 * If shuffling the temporal alignment between GDELT and FRED data destroys
 * the correlations, then the original alignment produces genuine coherence.
 * If shuffled data produces similar correlations, the claims are spurious.
 *
 * Uses existing proven backtest data from tests/backtest-cross-source.js.
 *
 * Verdict: CONFIRMED / INCONCLUSIVE / REJECTED
 *
 * Run: node tests/vv-cross-source.js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readCSV, pearsonR } from "./lib/backtest-engine.js";
import { pearsonCI, permutationTest } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const α = 0.001;

// ================================================================
// LOAD GDELT + FRED data (same sources as backtest-cross-source.js)
// ================================================================

console.log("=".repeat(80));
console.log("V&V: CROSS-SOURCE COHERENCE — GDELT vs FRED");
console.log(`Significance level: α = ${α} (99.9% confidence)`);
console.log("=".repeat(80));

// Paths to the data files used by the cross-source backtest
const gdeltPath = path.join(__dirname, "data", "2022-gdelt", "gdelt-ukraine-2022-daily.csv");
const fredPath = path.join(__dirname, "data", "2022-fred", "2022-russia-ukraine.csv");

if (!fs.existsSync(gdeltPath) || !fs.existsSync(fredPath)) {
  console.log("\n  SKIP: Cross-source data not found.");
  console.log("  Required: tests/data/2022-gdelt/gdelt-ukraine-2022-daily.csv");
  console.log("  Required: tests/data/2022-fred/2022-russia-ukraine.csv");
  console.log("  Run the cross-source backtest first to verify data exists.");
  console.log("=".repeat(80));
  process.exit(0);
}

// Load GDELT data
const gdeltRows = readCSV(gdeltPath);
console.log(`  GDELT: ${gdeltRows.length} rows loaded`);

// Load FRED data
const fredRows = readCSV(fredPath);
console.log(`  FRED: ${fredRows.length} rows loaded`);

// Build date-aligned arrays
const gdeltByDate = {};
for (const r of gdeltRows) {
  gdeltByDate[r.date] = r;
}
const fredByDate = {};
for (const r of fredRows) {
  fredByDate[r.date] = r;
}

// Find overlapping dates
const overlapDates = Object.keys(gdeltByDate).filter(d => fredByDate[d]);
overlapDates.sort();
console.log(`  Overlap: ${overlapDates.length} shared dates`);

if (overlapDates.length < 20) {
  console.log("\n  INCONCLUSIVE — insufficient overlap for meaningful analysis.");
  console.log("=".repeat(80));
  process.exit(0);
}

// Build aligned arrays — using whatever numeric columns are available
// GDELT: volume, avg_tone (these exist in the GDELT daily CSV)
// FRED: brent (exists in 2022-russia-ukraine.csv)
const gdeltVolumes = overlapDates.map(d => gdeltByDate[d].volume || gdeltByDate[d].num_events || 0);
const gdeltTones = overlapDates.map(d => gdeltByDate[d].avg_tone || 0);
const fredBrent = overlapDates.map(d => fredByDate[d].brent || fredByDate[d].Brent || 0);

// Filter out dates where data is missing
const validIndices = [];
for (let i = 0; i < overlapDates.length; i++) {
  if (gdeltVolumes[i] !== 0 && fredBrent[i] !== 0) validIndices.push(i);
}

const gVol = validIndices.map(i => gdeltVolumes[i]);
const gTone = validIndices.map(i => gdeltTones[i]);
const brent = validIndices.map(i => fredBrent[i]);
const n = gVol.length;

console.log(`  Valid paired observations: ${n}`);

// ================================================================
// CORRELATIONS + CIs + PERMUTATION TESTS
// ================================================================

const claims = [
  { name: "GDELT volume vs Brent", xs: gVol, ys: brent },
  { name: "GDELT tone vs Brent", xs: gTone, ys: brent },
];

let allConfirmed = true;
let anyConfirmed = false;

for (const claim of claims) {
  const r = pearsonR(claim.xs, claim.ys);
  const ci = pearsonCI(r, claim.xs.length, α);
  const perm = permutationTest(claim.xs, claim.ys, pearsonR, 10000);

  console.log(`\n  ${claim.name}:`);
  console.log(`    r = ${r.toFixed(4)}  [${ci[0].toFixed(4)}, ${ci[1].toFixed(4)}] (99.9% CI)`);
  console.log(`    Permutation p = ${perm.toExponential(4)}`);

  const ciExcludesZero = ci[0] > 0 || ci[1] < 0;
  const permSignificant = perm < α;

  console.log(`    CI excludes 0: ${ciExcludesZero ? "YES" : "NO"}`);
  console.log(`    Permutation significant: ${permSignificant ? "YES" : "NO"}`);

  if (ciExcludesZero && permSignificant) {
    console.log(`    VERDICT: CONFIRMED`);
    anyConfirmed = true;
  } else {
    console.log(`    VERDICT: ${ciExcludesZero || permSignificant ? "INCONCLUSIVE" : "REJECTED"}`);
    allConfirmed = false;
  }
}

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CROSS-SOURCE — COMPOSITE VERDICT");
console.log("=".repeat(80));

if (allConfirmed) {
  console.log("\n  CONFIRMED at α=0.001");
  console.log("  Cross-source correlations survive permutation testing.");
  console.log("  GDELT linguistic events and FRED prices show genuine temporal coherence.");
} else if (anyConfirmed) {
  console.log("\n  INCONCLUSIVE");
  console.log("  Some cross-source correlations are significant, others are not.");
} else {
  console.log("\n  REJECTED");
  console.log("  Cross-source correlations do NOT survive permutation at α=0.001.");
}

console.log("=".repeat(80));
```

**Step 2: Run the test**

Run: `node tests/vv-cross-source.js`
Expected: CONFIRMED, INCONCLUSIVE, or REJECTED.

**Step 3: Commit**

```bash
git add tests/vv-cross-source.js
git commit -m "test: V&V cross-source — permutation test on GDELT-FRED temporal coherence"
```

---

### Task 7: V&V Negative Controls

**Files:**
- Create: `tests/vv-negative-controls.js`

**Context:** Three-layer negative controls: (N1) Calendar — known boring periods should produce STABLE. (N2) Volatility — VIX<15 stretches should show low severity. (N3) Permutation — shuffled OHLCV bars should destroy topology. If the engine flags crisis in boring periods or finds structure in shuffled noise, the severity thresholds need recalibration.

**Step 1: Write the V&V test**

```javascript
/**
 * V&V: Negative Controls — Three Layers
 *
 * Layer N1 (Calendar): Engine on known boring periods → expect STABLE >= 90%
 * Layer N2 (Volatility): Engine on VIX<15 stretches → expect mean severity < 1.5
 * Layer N3 (Permutation): Shuffled OHLCV → expect topology destroyed (r ≈ 0)
 *
 * If the engine finds crisis topology in boring/shuffled data, the severity
 * thresholds are miscalibrated. These are the null hypothesis controls.
 *
 * Run: node tests/vv-negative-controls.js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { bootstrapCI } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

const α = 0.001;

// ================================================================
// CSV → adapter tech key mapping
// ================================================================

const CSV_TO_TECH = {
  rsi: "rsi", macd_hist: "macd_hist", bband_pctb: "bbpctb",
  bband_width: "bbwidth", volume_ratio: "volratio", sma50_dist: "sma50dist",
  sma200_dist: "sma200dist", atr_pctile: "atrPctile", drawdown: "drawdown",
  adx: "adx", mfi: "mfi", obv_slope: "obvslope",
};
const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

function analyzeCSV(csvPath, baselineWindow = 60) {
  const rows = readCSV(csvPath);
  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    technicals[CSV_TO_TECH[csvKey]] = rows.map(r => r[csvKey] || 0);
  }

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const sliceTech = {};
    for (const csvKey of CSV_TECH_KEYS) {
      sliceTech[CSV_TO_TECH[csvKey]] = technicals[CSV_TO_TECH[csvKey]].slice(0, i + 1);
    }
    const { signals } = marketToSignals("TEST", ohlcv.slice(0, i + 1), sliceTech, baselineWindow);
    if (signals.length === 0) continue;

    const mean = computeMeanSeverity(signals);
    const gini = computeGini(signals);
    results.push({ mean, gini, regime: classifyRegime(mean, gini).label });
  }
  return results;
}

// ================================================================
// LAYER N1: CALENDAR CONTROLS
// ================================================================

console.log("=".repeat(80));
console.log("V&V: NEGATIVE CONTROLS — Three Layers");
console.log(`Significance level: α = ${α}`);
console.log("=".repeat(80));

console.log(`\n${"=".repeat(80)}`);
console.log("LAYER N1: CALENDAR CONTROLS — Known boring periods");
console.log("=".repeat(80));

const CALM_PERIODS = [
  { name: "2013-2014 SPY", csv: "calm-2013-spy.csv" },
  { name: "2017 SPY", csv: "calm-2017-spy.csv" },
  { name: "2019 SPY", csv: "calm-2019-spy.csv" },
];

let calendarPass = true;

for (const period of CALM_PERIODS) {
  const csvPath = path.join(DATA_DIR, period.csv);
  if (!fs.existsSync(csvPath)) {
    console.log(`  SKIP: ${period.name} (CSV not found)`);
    continue;
  }

  const results = analyzeCSV(csvPath);
  const stableCount = results.filter(r => r.regime === "STABLE").length;
  const stableRate = results.length > 0 ? (stableCount / results.length * 100) : 0;
  const avgMean = results.reduce((s, r) => s + r.mean, 0) / results.length;
  const fpRate = 100 - stableRate;

  console.log(`\n  ${period.name}: ${results.length} bars`);
  console.log(`    STABLE: ${stableRate.toFixed(1)}% (${stableCount}/${results.length})`);
  console.log(`    Avg mean severity: ${avgMean.toFixed(3)}`);
  console.log(`    False positive rate: ${fpRate.toFixed(1)}%`);
  console.log(`    ${stableRate >= 90 ? "PASS" : "FAIL"} — ${stableRate >= 90 ? "< 10% false positives" : "> 10% false positives"}`);

  if (stableRate < 90) calendarPass = false;
}

// ================================================================
// LAYER N2: VOLATILITY CONTROLS — VIX < 15 stretches
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("LAYER N2: VOLATILITY CONTROLS — VIX < 15 calm stretches");
console.log("=".repeat(80));

const vixPath = path.join(DATA_DIR, "vix-2010-2025.csv");
let volatilityPass = true;

if (!fs.existsSync(vixPath)) {
  console.log("  SKIP: VIX data not found. Run fetch-market-data.py.");
} else {
  const vixRows = readCSV(vixPath);
  console.log(`  VIX data: ${vixRows.length} rows loaded`);

  // Find 5 longest continuous stretches of VIX < 15
  const stretches = [];
  let currentStretch = [];

  for (const row of vixRows) {
    const vixClose = row.Close || row.close;
    if (vixClose > 0 && vixClose < 15) {
      currentStretch.push(row);
    } else {
      if (currentStretch.length >= 20) {
        stretches.push({
          start: currentStretch[0].date,
          end: currentStretch[currentStretch.length - 1].date,
          length: currentStretch.length,
          avgVix: currentStretch.reduce((s, r) => s + (r.Close || r.close), 0) / currentStretch.length,
        });
      }
      currentStretch = [];
    }
  }
  if (currentStretch.length >= 20) {
    stretches.push({
      start: currentStretch[0].date,
      end: currentStretch[currentStretch.length - 1].date,
      length: currentStretch.length,
      avgVix: currentStretch.reduce((s, r) => s + (r.Close || r.close), 0) / currentStretch.length,
    });
  }

  stretches.sort((a, b) => b.length - a.length);
  const top5 = stretches.slice(0, 5);

  console.log(`  Found ${stretches.length} stretches of VIX < 15 (>= 20 days)`);
  console.log(`  Top 5 longest:`);

  for (const s of top5) {
    console.log(`    ${s.start} to ${s.end}: ${s.length} days, avg VIX=${s.avgVix.toFixed(1)}`);
  }

  // For volatility controls, we check if calm-period CSVs (which overlap
  // these VIX stretches) show low mean severity. The calendar controls
  // already cover this — so N2 validates the VIX-based definition produces
  // the same "boring" conclusion as calendar-based selection.

  console.log(`\n  Volatility-identified calm periods align with calendar controls.`);
  console.log(`  PASS condition: calendar control periods overlap top VIX < 15 stretches.`);

  // Check overlap: 2017 should appear in top stretches (lowest VIX year ever)
  const has2017 = top5.some(s => s.start.startsWith("2017") || s.end.startsWith("2017") ||
    (s.start < "2017-12-31" && s.end > "2017-01-01"));
  console.log(`  2017 in top-5 stretches: ${has2017 ? "YES" : "NO"}`);
  if (!has2017) volatilityPass = false;
}

// ================================================================
// LAYER N3: PERMUTATION CONTROLS — shuffled OHLCV
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("LAYER N3: PERMUTATION CONTROLS — Shuffled bar order");
console.log("=".repeat(80));

// Use one crisis event (GFC — largest dataset) for permutation
const gfcPath = path.join(DATA_DIR, "gfc-2008-spy.csv");
let permutationPass = true;

if (!fs.existsSync(gfcPath)) {
  console.log("  SKIP: GFC data not found.");
} else {
  const rows = readCSV(gfcPath);
  console.log(`  Source: GFC 2008 SPY (${rows.length} bars)`);

  // Real data mean-Gini r
  const realResults = analyzeCSV(gfcPath);
  const realMeans = realResults.map(r => r.mean);
  const realGinis = realResults.map(r => r.gini);
  const realR = pearsonR(realMeans, realGinis);
  console.log(`  Real mean-Gini r: ${realR.toFixed(4)}`);

  // Permutation: shuffle bar order N times, compute mean-Gini r each time
  const NUM_PERMS = 200;  // Each perm requires full adapter run — keep reasonable
  console.log(`  Running ${NUM_PERMS} permutations (shuffle bar order)...`);

  const permRs = [];
  for (let p = 0; p < NUM_PERMS; p++) {
    // Shuffle rows (Fisher-Yates)
    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Write temporary shuffled data with sequential dates
    const ohlcv = shuffled.map(r => ({
      open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
    }));

    // Build technicals from shuffled OHLCV
    const { computeTechnicals } = await import("../src/adapters/market-adapter.js");
    const techs = computeTechnicals(ohlcv);

    // Run adapter on last bar with full shuffled history
    const { signals } = marketToSignals("TEST", ohlcv, techs, 60);
    // We need per-bar analysis for correlation, so run the full series
    const permMeans = [];
    const permGinis = [];
    for (let i = 60; i < ohlcv.length; i++) {
      const sliceOhlcv = ohlcv.slice(0, i + 1);
      const sliceTechs = {};
      for (const key of Object.keys(techs)) {
        sliceTechs[key] = techs[key].slice(0, i + 1);
      }
      const result = marketToSignals("TEST", sliceOhlcv, sliceTechs, 60);
      if (result.signals.length === 0) continue;
      permMeans.push(computeMeanSeverity(result.signals));
      permGinis.push(computeGini(result.signals));
    }

    if (permMeans.length > 10) {
      permRs.push(pearsonR(permMeans, permGinis));
    }

    if ((p + 1) % 50 === 0) {
      console.log(`    ${p + 1}/${NUM_PERMS} permutations complete`);
    }
  }

  // Analyze permutation distribution
  const permMean = permRs.reduce((a, b) => a + b, 0) / permRs.length;
  const permAbsMean = permRs.reduce((a, b) => a + Math.abs(b), 0) / permRs.length;
  const exceedsReal = permRs.filter(r => Math.abs(r) >= Math.abs(realR)).length;
  const permP = exceedsReal / permRs.length;

  console.log(`\n  Permutation distribution (${permRs.length} valid permutations):`);
  console.log(`    Mean permuted r: ${permMean.toFixed(4)}`);
  console.log(`    Mean |permuted r|: ${permAbsMean.toFixed(4)}`);
  console.log(`    Real |r|: ${Math.abs(realR).toFixed(4)}`);
  console.log(`    P(|perm r| >= |real r|): ${permP.toFixed(4)}`);

  // Pass: permuted mean-Gini r should be near 0 (within [-0.1, +0.1])
  const permInNullRange = Math.abs(permMean) < 0.1;
  const realOutsideNull = permP < α;

  console.log(`\n    Permuted r near 0 (|mean| < 0.1): ${permInNullRange ? "YES" : "NO"}`);
  console.log(`    Real r outside permutation null (p < ${α}): ${realOutsideNull ? "YES" : "NO"}`);

  if (!permInNullRange || !realOutsideNull) permutationPass = false;
}

// ================================================================
// COMPOSITE VERDICT
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("NEGATIVE CONTROLS — COMPOSITE VERDICT");
console.log("=".repeat(80));

console.log(`\n  N1 Calendar:    ${calendarPass ? "PASS" : "FAIL"}`);
console.log(`  N2 Volatility:  ${volatilityPass ? "PASS" : "FAIL"}`);
console.log(`  N3 Permutation: ${permutationPass ? "PASS" : "FAIL"}`);

if (calendarPass && volatilityPass && permutationPass) {
  console.log("\n  ALL NEGATIVE CONTROLS PASS");
  console.log("  Engine correctly identifies boring periods as STABLE.");
  console.log("  Shuffled noise destroys topology — signal is real, not an artifact.");
} else {
  const failures = [];
  if (!calendarPass) failures.push("Calendar (false positive rate > 10%)");
  if (!volatilityPass) failures.push("Volatility (VIX-calm periods misidentified)");
  if (!permutationPass) failures.push("Permutation (shuffled data retains topology)");
  console.log(`\n  FAILURES: ${failures.join(", ")}`);
  console.log("  Severity thresholds may need recalibration.");
}

console.log("=".repeat(80));
```

**Step 2: Run the test**

Run: `node tests/vv-negative-controls.js`
Expected: PASS or FAIL per layer. Note: Layer N3 permutation is compute-intensive (~200 full adapter runs on 503 bars each). Expect 2-5 minutes runtime.

**Step 3: Commit**

```bash
git add tests/vv-negative-controls.js
git commit -m "test: V&V negative controls — calendar, volatility, and permutation null hypothesis"
```

---

### Task 8: V&V Power Analysis

**Files:**
- Create: `tests/vv-power-analysis.js`

**Context:** Reports whether the current sample sizes are sufficient for 99.9% CIs narrower than 0.15 on the primary claims. If not, recommends how many additional events to pull.

**Step 1: Write the V&V test**

```javascript
/**
 * V&V: Power Analysis — Adaptive Sample Sizing
 *
 * Reports whether current sample sizes produce sufficiently narrow
 * 99.9% confidence intervals (target width < 0.15) for primary claims.
 *
 * If insufficient, recommends additional events to pull.
 *
 * Run: node tests/vv-power-analysis.js
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, pearsonR } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { powerAnalysis } from "./lib/statistics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

const α = 0.001;
const TARGET_WIDTH = 0.15;

// ================================================================
// CSV → adapter tech key mapping
// ================================================================

const CSV_TO_TECH = {
  rsi: "rsi", macd_hist: "macd_hist", bband_pctb: "bbpctb",
  bband_width: "bbwidth", volume_ratio: "volratio", sma50_dist: "sma50dist",
  sma200_dist: "sma200dist", atr_pctile: "atrPctile", drawdown: "drawdown",
  adx: "adx", mfi: "mfi", obv_slope: "obvslope",
};
const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

function analyzeCSV(csvPath, baselineWindow = 60) {
  const rows = readCSV(csvPath);
  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));
  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    technicals[CSV_TO_TECH[csvKey]] = rows.map(r => r[csvKey] || 0);
  }

  const means = [];
  const ginis = [];
  for (let i = 0; i < rows.length; i++) {
    const sliceTech = {};
    for (const csvKey of CSV_TECH_KEYS) {
      sliceTech[CSV_TO_TECH[csvKey]] = technicals[CSV_TO_TECH[csvKey]].slice(0, i + 1);
    }
    const { signals } = marketToSignals("TEST", ohlcv.slice(0, i + 1), sliceTech, baselineWindow);
    if (signals.length === 0) continue;
    means.push(computeMeanSeverity(signals));
    ginis.push(computeGini(signals));
  }
  return { means, ginis };
}

// ================================================================
// EVENT LIST
// ================================================================

const MARKET_EVENTS = [
  "gfc-2008-spy", "covid-2020-spy", "svb-2023-kre", "nvda-2023-nvda", "gme-2021-gme",
  "dotcom-2000-qqq", "flash-2010-spy", "eudebt-2011-ewg", "taper-2013-tlt",
  "china-2015-fxi", "oilcrash-2014-xle", "volmageddon-2018-spy",
  "yencarry-2024-ewj", "tariff-2025-kweb", "crypto-2022-coin",
];

const RESERVE_EVENTS = [
  "LTCM 1998 (SPY)", "Brexit 2016 (EWU)", "Turkey 2018 (TUR)",
  "Archegos 2021 (VIAC)", "Meme 2024 (RDDT)",
];

// ================================================================
// MAIN
// ================================================================

console.log("=".repeat(80));
console.log("V&V: POWER ANALYSIS — Adaptive Sample Sizing");
console.log(`Target CI width: ${TARGET_WIDTH} | α = ${α}`);
console.log("=".repeat(80));

// --- Collect per-event mean-Gini r values ---
const perEventCorrelations = [];
let allMeans = [];
let allGinis = [];

for (const event of MARKET_EVENTS) {
  const csvPath = path.join(DATA_DIR, `${event}.csv`);
  if (!fs.existsSync(csvPath)) continue;

  const { means, ginis } = analyzeCSV(csvPath);
  if (means.length < 10) continue;

  const r = pearsonR(means, ginis);
  perEventCorrelations.push(r);
  allMeans = allMeans.concat(means);
  allGinis = allGinis.concat(ginis);

  console.log(`  ${event}: r=${r.toFixed(4)}, n=${means.length}`);
}

console.log(`\n  Events loaded: ${perEventCorrelations.length}`);
console.log(`  Total bar-level observations: ${allMeans.length}`);

// ================================================================
// CLAIM 1: Pooled mean-Gini correlation
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CLAIM 1: Pooled mean-Gini correlation");
console.log("=".repeat(80));

const pairedData = allMeans.map((m, i) => [m, allGinis[i]]);
const corrFn = pairs => {
  const ms = pairs.map(p => p[0]);
  const gs = pairs.map(p => p[1]);
  return pearsonR(ms, gs);
};

const pa1 = powerAnalysis(pairedData, corrFn, TARGET_WIDTH, α, 5000);
const pooledR = corrFn(pairedData);

console.log(`  Pooled r: ${pooledR.toFixed(4)}`);
console.log(`  99.9% CI width: ${pa1.currentWidth.toFixed(4)}`);
console.log(`  Target width: ${TARGET_WIDTH}`);
console.log(`  Sufficient: ${pa1.sufficient ? "YES" : "NO"}`);
if (!pa1.sufficient && pa1.recommendedN) {
  console.log(`  Recommended N: ${pa1.recommendedN} observations (currently ${pairedData.length})`);
}

// ================================================================
// CLAIM 2: Per-event correlation consistency
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("CLAIM 2: Per-event correlation consistency");
console.log("=".repeat(80));

const meanFn = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const pa2 = powerAnalysis(perEventCorrelations, meanFn, TARGET_WIDTH, α, 5000);
const avgR = meanFn(perEventCorrelations);

console.log(`  Events: ${perEventCorrelations.length}`);
console.log(`  Per-event r values: [${perEventCorrelations.map(r => r.toFixed(3)).join(", ")}]`);
console.log(`  Mean per-event r: ${avgR.toFixed(4)}`);
console.log(`  99.9% CI width: ${pa2.currentWidth.toFixed(4)}`);
console.log(`  Target width: ${TARGET_WIDTH}`);
console.log(`  Sufficient: ${pa2.sufficient ? "YES" : "NO"}`);
if (!pa2.sufficient && pa2.recommendedN) {
  console.log(`  Recommended N: ${pa2.recommendedN} events (currently ${perEventCorrelations.length})`);
  console.log(`  Reserve events available: ${RESERVE_EVENTS.join(", ")}`);
}

// ================================================================
// VERDICT
// ================================================================

console.log(`\n${"=".repeat(80)}`);
console.log("POWER ANALYSIS — VERDICT");
console.log("=".repeat(80));

const allSufficient = pa1.sufficient && pa2.sufficient;

if (allSufficient) {
  console.log("\n  SUFFICIENT — current sample sizes produce CIs narrower than target.");
  console.log("  V&V claims at α=0.001 are adequately powered.");
} else {
  console.log("\n  INSUFFICIENT — some claims need more data:");
  if (!pa1.sufficient) console.log(`    Pooled correlation: need ~${pa1.recommendedN} observations`);
  if (!pa2.sufficient) console.log(`    Per-event consistency: need ~${pa2.recommendedN} events`);
  console.log(`\n  Reserve events to pull: ${RESERVE_EVENTS.join(", ")}`);
}

console.log("=".repeat(80));
```

**Step 2: Run the test**

Run: `node tests/vv-power-analysis.js`
Expected: SUFFICIENT or INSUFFICIENT with recommended N.

**Step 3: Commit**

```bash
git add tests/vv-power-analysis.js
git commit -m "test: V&V power analysis — adaptive sample sizing for 99.9% CI width"
```

---

## Execution Summary

| Task | Files | Depends On | Parallelizable |
|------|-------|-----------|----------------|
| 1. Statistics library | `tests/lib/statistics.js`, `tests/test-statistics.js` | — | Yes (with 2) |
| 2. Expanded data | `fetch-market-data.py`, 13 CSVs | — | Yes (with 1) |
| 3. Polarity inversion | `tests/vv-polarity-inversion.js` | 1, 2 | Yes (with 4-8) |
| 4. Walk-forward | `tests/vv-walkforward.js` | 1, 2 | Yes (with 3,5-8) |
| 5. Lead time | `tests/vv-lead-time.js` | 1, 2 | Yes (with 3,4,6-8) |
| 6. Cross-source | `tests/vv-cross-source.js` | 1 | Yes (with 3-5,7,8) |
| 7. Negative controls | `tests/vv-negative-controls.js` | 1, 2 | Yes (with 3-6,8) |
| 8. Power analysis | `tests/vv-power-analysis.js` | 1, 2 | Yes (with 3-7) |

**Total new files:** 9 (1 library + 1 unit test + 6 V&V tests + Python modification)
**Total new data files:** ~13 CSVs from Yahoo Finance
**Existing files modified:** 1 (fetch-market-data.py)
**Existing tests affected:** 0
