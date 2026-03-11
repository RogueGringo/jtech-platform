# Cross-Domain Mathematical Framework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove the mathematical framework (Gini, coherence, 2D regime, transition intensity) captures universal crisis dynamics across 4+ domains with real data, achieving 85%+ correlation and cross-domain invariance.

**Architecture:** Extract shared backtest engine from oil backtest. Add projection layer (propagation/dissolution) to dynamics engine. Create domain configs for 2008 GFC, 2020 COVID, 2023 SVB using semantic prime ontology. Each domain backtest validates the same invariants. Capstone cross-domain test confirms all properties hold without engine changes.

**Tech Stack:** Node.js ESM modules, no test runner (verify via `node tests/*.js`), Vite 5 build check (`npx vite build`), FRED public data.

**CRITICAL:** NO SYNTHETIC DATA. All test data from FRED (fred.stlouisfed.org) or documented public sources. All non-price baselines must cite authoritative sources.

---

### Task 1: Projection Engine — Propagation & Dissolution

**Files:**
- Create: `src/engine/projection.js`
- Test: `tests/test-projection.js`

**Step 1: Write the test file**

```js
// tests/test-projection.js
import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../src/engine/projection.js";

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

let passed = 0, failed = 0;
function assert(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); failed++; }
}

// --- Propagation capacity ---
// Category with max=critical(4), others=watch(1) → high propagation
const mixedSignals = [
  { id: "a", category: "cond", severity: "critical" },
  { id: "b", category: "cond", severity: "watch" },
  { id: "c", category: "cond", severity: "watch" },
  { id: "d", category: "flow", severity: "moderate" },
  { id: "e", category: "flow", severity: "moderate" },
];
const prop = computePropagationCapacity(mixedSignals, ["cond", "flow"]);
assert(prop.perCategory.cond > prop.perCategory.flow,
  "Mixed category has higher propagation than uniform",
  `cond=${prop.perCategory.cond}, flow=${prop.perCategory.flow}`);
assert(prop.aggregate > 0, "Aggregate propagation > 0", `got ${prop.aggregate}`);

// Uniform signals → zero propagation
const uniformSignals = [
  { id: "a", category: "cond", severity: "critical" },
  { id: "b", category: "cond", severity: "critical" },
  { id: "c", category: "flow", severity: "critical" },
];
const propUniform = computePropagationCapacity(uniformSignals, ["cond", "flow"]);
assert(propUniform.aggregate === 0, "Uniform signals = zero propagation", `got ${propUniform.aggregate}`);

// --- Dissolution rate ---
// Rising coherence → negative dissolution (deepening)
const risingCoherence = [60, 65, 70, 75, 80];
const dissRising = computeDissolutionRate(risingCoherence);
assert(dissRising < 0, "Rising coherence = negative dissolution (deepening)", `got ${dissRising}`);

// Falling coherence → positive dissolution (resolving)
const fallingCoherence = [80, 75, 70, 65, 60];
const dissFalling = computeDissolutionRate(fallingCoherence);
assert(dissFalling > 0, "Falling coherence = positive dissolution (resolving)", `got ${dissFalling}`);

// --- Trajectory classification ---
assert(classifyTrajectory(0.8, -0.5).label === "ACCELERATING",
  "High prop + negative diss = ACCELERATING", `got ${classifyTrajectory(0.8, -0.5).label}`);
assert(classifyTrajectory(0.1, -0.5).label === "CONSOLIDATING",
  "Low prop + negative diss = CONSOLIDATING", `got ${classifyTrajectory(0.1, -0.5).label}`);
assert(classifyTrajectory(0.8, 0.5).label === "TURBULENT",
  "High prop + positive diss = TURBULENT", `got ${classifyTrajectory(0.8, 0.5).label}`);
assert(classifyTrajectory(0.1, 0.5).label === "RESOLVING",
  "Low prop + positive diss = RESOLVING", `got ${classifyTrajectory(0.1, 0.5).label}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-projection.js`
Expected: FAIL — module not found

**Step 3: Write implementation**

```js
// src/engine/projection.js
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

// Propagation capacity per category:
// P(cat) = max_rank - mean_rank within each category
// High P = crisis hasn't fully propagated; cascades will close the gap
export function computePropagationCapacity(signals, categoryKeys) {
  const perCategory = {};
  let totalP = 0, catCount = 0;
  for (const cat of categoryKeys) {
    const ranks = signals.filter(s => s.category === cat)
      .map(s => SEVERITY_RANK[s.severity] || 1);
    if (ranks.length === 0) { perCategory[cat] = 0; continue; }
    const max = Math.max(...ranks);
    const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    perCategory[cat] = max - mean;
    totalP += perCategory[cat];
    catCount++;
  }
  const aggregate = catCount > 0 ? totalP / catCount : 0;
  return { perCategory, aggregate };
}

// Dissolution rate: -1 * slope of coherence over recent history
// Negative = coherence rising = crisis deepening
// Positive = coherence falling = crisis resolving
export function computeDissolutionRate(coherenceHistory) {
  if (coherenceHistory.length < 2) return 0;
  const n = coherenceHistory.length;
  const last = coherenceHistory[n - 1];
  const first = coherenceHistory[0];
  return -1 * (last - first) / (n - 1);
}

// Forward trajectory from (propagation, dissolution)
// Layer 2 of the regime system
export function classifyTrajectory(propagation, dissolution) {
  const highProp = propagation >= 0.5;
  const negativeDiss = dissolution < 0;
  if (highProp && negativeDiss)   return { label: "ACCELERATING", quadrant: "high-neg" };
  if (!highProp && negativeDiss)  return { label: "CONSOLIDATING", quadrant: "low-neg" };
  if (highProp && !negativeDiss)  return { label: "TURBULENT", quadrant: "high-pos" };
  return { label: "RESOLVING", quadrant: "low-pos" };
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-projection.js`
Expected: All PASS

**Step 5: Verify build**

Run: `npx vite build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/engine/projection.js tests/test-projection.js
git commit -m "feat: add projection engine — propagation, dissolution, forward trajectory"
```

---

### Task 2: Semantic Prime Ontology

**Files:**
- Create: `src/engine/primes.js`
- Test: `tests/test-primes.js`

**Step 1: Write the test**

```js
// tests/test-primes.js
import { UNIVERSAL_CATEGORIES, validateDomainMapping, mapToUniversal } from "../src/engine/primes.js";

let passed = 0, failed = 0;
function assert(cond, label, detail) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label} — ${detail}`); failed++; }
}

// Universal categories exist
assert(UNIVERSAL_CATEGORIES.length === 5, "5 universal categories", `got ${UNIVERSAL_CATEGORIES.length}`);
assert(UNIVERSAL_CATEGORIES.includes("condition"), "Has 'condition'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("flow"), "Has 'flow'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("price"), "Has 'price'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("capacity"), "Has 'capacity'", "missing");
assert(UNIVERSAL_CATEGORIES.includes("context"), "Has 'context'", "missing");

// Valid mapping passes
const validMapping = {
  kernel: "condition",
  physical: "flow",
  price: "price",
  domestic: "capacity",
  geopolitical: "context",
};
const validResult = validateDomainMapping(validMapping);
assert(validResult.valid === true, "Valid mapping passes", `errors: ${validResult.errors}`);

// Invalid mapping caught — unknown universal category
const badMapping = { kernel: "bogus" };
const badResult = validateDomainMapping(badMapping);
assert(badResult.valid === false, "Invalid mapping caught", "should have failed");

// mapToUniversal translates domain categories
const signals = [
  { id: "pni", category: "kernel", severity: "critical" },
  { id: "ais", category: "physical", severity: "high" },
];
const mapped = mapToUniversal(signals, validMapping);
assert(mapped[0].universalCategory === "condition", "kernel -> condition", `got ${mapped[0].universalCategory}`);
assert(mapped[1].universalCategory === "flow", "physical -> flow", `got ${mapped[1].universalCategory}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

**Step 2: Run test — expected FAIL**

Run: `node tests/test-primes.js`

**Step 3: Write implementation**

```js
// src/engine/primes.js

// The 5 universal categories derived from semantic primes.
// Every domain maps its specific categories to these.
//   CONDITION — state of core system (ACTORS + STATE)
//   FLOW      — movement of primary resource (ACTION + INSTRUMENTS)
//   PRICE     — market valuation signals (MAGNITUDE + INSTRUMENTS)
//   CAPACITY  — available reserves/ability (MAGNITUDE + STATE)
//   CONTEXT   — external environment (CAUSE + ACTORS)
export const UNIVERSAL_CATEGORIES = [
  "condition", "flow", "price", "capacity", "context",
];

// Validate that a domain's category mapping covers universal categories
export function validateDomainMapping(mapping) {
  const errors = [];
  for (const [domainCat, universalCat] of Object.entries(mapping)) {
    if (!UNIVERSAL_CATEGORIES.includes(universalCat)) {
      errors.push(`"${domainCat}" maps to unknown universal category "${universalCat}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// Annotate signals with their universal category
export function mapToUniversal(signals, mapping) {
  return signals.map(s => ({
    ...s,
    universalCategory: mapping[s.category] || s.category,
  }));
}
```

**Step 4: Run test — expected PASS**

Run: `node tests/test-primes.js`

**Step 5: Commit**

```bash
git add src/engine/primes.js tests/test-primes.js
git commit -m "feat: add semantic prime ontology — universal categories + domain mapping"
```

---

### Task 3: Shared Backtest Library

Extract duplicated math functions from `tests/backtest-real-data.js` into a shared module so new domain backtests are ~100 lines instead of ~500.

**Files:**
- Create: `tests/lib/backtest-engine.js`
- Modify: `tests/backtest-real-data.js` (import from shared lib instead of inlining)

**Step 1: Create the shared library**

Extract from `tests/backtest-real-data.js` into `tests/lib/backtest-engine.js`:
- `SEVERITY_RANK`
- `computeSeverity`, `computeGini`, `computeMeanSeverity`, `computeCrossCoherence`, `classifyRegime`
- `createBuffer`, `pushBuffer`, `getOrdered`, `giniFromRanks`, `giniTrajectory`
- `transitionIntensity`
- `rollingAvg`, `kendallTau`
- `readCSV`, `buildSignals`, `backtestEvent`

Export all as named exports. The `buildSignals` function should accept `thresholds` and `nonPriceBaseline` as parameters (not use globals).

The `backtestEvent` function signature becomes:
```js
export function backtestEvent(name, csvPath, baseline, keyDates, thresholds, categoryKeys, options = {})
```

**Step 2: Refactor `backtest-real-data.js` to import from shared lib**

Replace inlined math functions with:
```js
import { backtestEvent, readCSV, buildSignals, computeGini, computeMeanSeverity,
  computeCrossCoherence, classifyRegime, kendallTau, rollingAvg,
  transitionIntensity, SEVERITY_RANK, computeSeverity,
  categoryProfile } from "./lib/backtest-engine.js";
```

**Step 3: Run existing backtest to verify refactor didn't break anything**

Run: `node tests/backtest-real-data.js`
Expected: 14 passed, 0 failed, Correlation: 90.9%

**Step 4: Commit**

```bash
git add tests/lib/backtest-engine.js tests/backtest-real-data.js
git commit -m "refactor: extract shared backtest engine — DRY across domain tests"
```

---

### Task 4: Acquire 2008 GFC FRED Data

**Files:**
- Create: `tests/data/2008-gfc/README.md`
- Create: `tests/data/2008-gfc/financial-crisis.csv`

**Step 1: Document data sources**

Create `tests/data/2008-gfc/README.md`:
```markdown
# 2008 Global Financial Crisis — Data Sources

## FRED Series

| Column | FRED Series | Description |
|--------|-------------|-------------|
| vix | VIXCLS | CBOE Volatility Index, daily close |
| ted | TEDRATE | TED Spread (3M LIBOR - 3M T-bill), daily |
| sp500 | SP500 | S&P 500 Index, daily close |
| hy_spread | BAMLH0A0HYM2 | ICE BofA US High Yield OAS, daily |
| fed_funds | DFF | Effective Federal Funds Rate, daily |

## Date Range
2007-06-01 to 2009-06-30

## Key Dates
- 2007-08-09: BNP Paribas freezes funds
- 2008-03-16: Bear Stearns collapse
- 2008-09-15: Lehman Brothers bankruptcy
- 2008-10-10: Peak TED spread
- 2008-11-20: VIX peak (80.86)
- 2009-03-09: S&P 500 bottom

## Download URLs
- https://fred.stlouisfed.org/series/VIXCLS
- https://fred.stlouisfed.org/series/TEDRATE
- https://fred.stlouisfed.org/series/SP500
- https://fred.stlouisfed.org/series/BAMLH0A0HYM2
- https://fred.stlouisfed.org/series/DFF
```

**Step 2: Download data from FRED**

For each series, download CSV from FRED website:
1. Navigate to series URL
2. Click "Download" → CSV
3. Select date range 2007-06-01 to 2009-06-30
4. Merge into single CSV with columns: `date,vix,ted,sp500,hy_spread,fed_funds`

Save to `tests/data/2008-gfc/financial-crisis.csv`

**Step 3: Verify CSV loads correctly**

Run: `node -e "import fs from 'fs'; const d = fs.readFileSync('tests/data/2008-gfc/financial-crisis.csv','utf-8'); const lines = d.trim().split('\n'); console.log(lines[0]); console.log(lines[1]); console.log(lines.length + ' rows');"`

Expected: Header row, first data row, ~500 rows

**Step 4: Commit**

```bash
git add tests/data/2008-gfc/
git commit -m "data: add 2008 GFC FRED time series — VIX, TED, SP500, HY spread, FFR"
```

---

### Task 5: 2008 GFC Domain Config

**Files:**
- Create: `src/domains/gfc-2008/config.js`

**Step 1: Define signal structure using semantic primes**

Categories (mapped to universal ontology):
- `credit` → CONDITION — interbank trust, counterparty risk
- `liquidity` → FLOW — funding markets, commercial paper
- `asset_prices` → PRICE — VIX, S&P 500, high yield spread
- `reserves` → CAPACITY — Fed funds, bank reserves, policy tools
- `regulatory` → CONTEXT — bailouts, policy announcements, systemic risk assessment

**Step 2: Write domain config**

```js
// src/domains/gfc-2008/config.js
export default {
  id: "gfc-2008",
  name: "2008 Global Financial Crisis",
  subtitle: "Credit Contagion Cascade",

  primeMapping: {
    credit: "condition",
    liquidity: "flow",
    asset_prices: "price",
    reserves: "capacity",
    regulatory: "context",
  },

  categories: {
    credit: { label: "CREDIT CONDITION", color: "red" },
    liquidity: { label: "LIQUIDITY FLOWS", color: "orange" },
    asset_prices: { label: "ASSET PRICES", color: "blue" },
    reserves: { label: "RESERVE CAPACITY", color: "purple" },
    regulatory: { label: "REGULATORY CONTEXT", color: "gold" },
  },

  severityThresholds: {
    vix:       [["critical", 60], ["high", 40], ["moderate", 25]],
    ted:       [["critical", 3.0], ["high", 1.5], ["moderate", 0.5]],
    sp500_chg: [["critical", -40], ["high", -20], ["moderate", -10]],
    hy_spread: [["critical", 1500], ["high", 800], ["moderate", 400]],
    fed_funds: [["critical", 0.5], ["high", 1.0], ["moderate", 2.0]],
    // Note: fed_funds inverts — lower = more emergency = higher severity
    // Handled in backtest with custom logic
  },
};
```

**Step 3: Commit**

```bash
git add src/domains/gfc-2008/config.js
git commit -m "feat: add 2008 GFC domain config — credit contagion cascade"
```

---

### Task 6: 2008 GFC Backtest

**Files:**
- Create: `tests/backtest-gfc.js`

**Step 1: Write the backtest**

Use shared lib from Task 3. Define:
- Thresholds from domain config
- Non-price baselines for each crisis phase:
  - Pre-crisis (2007 H2): credit=watch, liquidity=watch, reserves=watch, regulatory=watch
  - Bear Stearns phase (2008 Q1): credit=moderate, liquidity=moderate, reserves=watch, regulatory=moderate
  - Lehman phase (2008 Q3-Q4): credit=critical, liquidity=critical, reserves=high, regulatory=high
  - QE phase (2009 Q1-Q2): credit=high, liquidity=high, reserves=moderate (QE easing), regulatory=moderate

Non-price baseline sources:
- Credit: BIS Quarterly Review, Federal Reserve Board H.15
- Liquidity: Fed commercial paper data, repo market reports
- Regulatory: TARP timeline, Fed emergency facilities timeline

Signal structure (20 signals):
- credit: 3 signals (interbank trust, counterparty CDS, money market stress)
- liquidity: 5 signals (commercial paper, repo, bank lending, credit availability, corporate issuance)
- asset_prices: 5 signals (VIX, S&P 500 change from peak, HY spread, investment-grade spread, equity vol)
- reserves: 3 signals (fed funds rate, bank excess reserves, emergency facility usage)
- regulatory: 4 signals (bailout status, TARP, Fed emergency lending, international coordination)

Key date validations:
- 2007-08-09 (BNP Paribas): Should be TRANSIENT SPIKE (price signals spiking, rest calm)
- 2008-09-15 (Lehman): Should be BOUNDARY LAYER or CRISIS CONSOLIDATION
- 2008-11-20 (VIX peak): Should be CRISIS CONSOLIDATION (everything converged)
- 2009-03-09 (S&P bottom): Should be CRISIS CONSOLIDATION or starting to shift

Multi-frame test: Run 2008-09-15 through "bank regulator" frame vs "equity trader" frame — should produce different regimes.

**Step 2: Run backtest**

Run: `node tests/backtest-gfc.js`
Expected: Correlation >= 85%, all key-date regimes match documented states

**Step 3: Commit**

```bash
git add tests/backtest-gfc.js
git commit -m "test: 2008 GFC backtest — credit contagion through mathematical framework"
```

---

### Task 7: Acquire 2020 COVID Data + Domain Config + Backtest

**Files:**
- Create: `tests/data/2020-covid/README.md`
- Create: `tests/data/2020-covid/covid-crisis.csv`
- Create: `src/domains/covid-2020/config.js`
- Create: `tests/backtest-covid.js`

**Step 1: Document data sources and download**

FRED series for 2020 COVID:
- DCOILBRENTEU (Brent crude) — went from $65 to below $20
- DCOILWTICO (WTI) — went NEGATIVE on Apr 20, 2020
- OVXCLS (Oil VIX) — spiked to 325+
- VIXCLS (Equity VIX) — spiked to 82.69 on Mar 16
- ICSA (Initial jobless claims) — spiked from 200K to 6.8M

Date range: 2020-01-02 to 2020-09-30

Key dates:
- 2020-01-21: First US COVID case
- 2020-03-09: Oil price war begins (Saudi-Russia)
- 2020-03-11: WHO declares pandemic
- 2020-03-16: VIX peak (82.69)
- 2020-04-20: WTI goes negative (-$37.63)
- 2020-06-08: NBER declares recession started Feb 2020

**Step 2: Define categories using semantic primes**

```
primeMapping: {
  demand: "condition",     // demand destruction state
  supply_chain: "flow",    // physical supply disruption
  energy_prices: "price",  // oil and energy market
  labor: "capacity",       // workforce/economic capacity
  policy: "context",       // lockdowns, stimulus, Fed response
}
```

**Step 3: Write backtest with baselines**

Non-price baselines (documented):
- Pre-pandemic (Jan 2020): demand=watch, supply_chain=watch, labor=watch, policy=watch
- Pandemic onset (Mar 2020): demand=critical, supply_chain=critical, labor=critical, policy=critical
- Recovery (Jun-Sep 2020): demand=high, supply_chain=moderate, labor=high, policy=moderate (stimulus flowing)

Sources: WHO situation reports, BLS employment data, Federal Reserve minutes

**Step 4: Run and validate**

Run: `node tests/backtest-covid.js`
Expected: Correlation >= 85%, regime correctly identifies demand destruction pattern

**Step 5: Commit**

```bash
git add tests/data/2020-covid/ src/domains/covid-2020/ tests/backtest-covid.js
git commit -m "test: 2020 COVID backtest — demand destruction through mathematical framework"
```

---

### Task 8: Acquire 2023 SVB Data + Domain Config + Backtest

**Files:**
- Create: `tests/data/2023-svb/README.md`
- Create: `tests/data/2023-svb/svb-crisis.csv`
- Create: `src/domains/svb-2023/config.js`
- Create: `tests/backtest-svb.js`

**Step 1: Document data sources and download**

FRED series for 2023 SVB:
- VIXCLS (VIX) — spiked from ~20 to ~30 on SVB collapse
- BAMLH0A0HYM2 (HY spread) — widened on contagion fears
- DGS2 (2Y Treasury) — crashed from 5% to 3.8% in days (flight to safety)
- T10Y2Y (2Y-10Y spread) — yield curve dynamics
- DTWEXBGS (Trade-weighted USD) — safe haven flows

Date range: 2023-01-03 to 2023-06-30

Key dates:
- 2023-03-08: SVB announces stock sale / AFS losses
- 2023-03-10: SVB seized by FDIC
- 2023-03-12: Signature Bank seized, Fed announces BTFP
- 2023-03-15: Credit Suisse crisis
- 2023-03-19: UBS acquires Credit Suisse
- 2023-05-01: First Republic seized

**Step 2: Define categories**

```
primeMapping: {
  solvency: "condition",      // bank capital/solvency state
  deposits: "flow",           // deposit flight dynamics
  market_prices: "price",     // VIX, yields, spreads
  backstop: "capacity",       // FDIC, Fed BTFP, Treasury capacity
  contagion: "context",       // systemic risk assessment, other banks
}
```

**Step 3: Write backtest**

This event is key because it was a RAPID phase transition (3 days from stable to crisis) followed by RAPID resolution (BTFP stabilized). The framework should detect:
- Pre-crisis: STABLE
- Mar 8-12: PHASE TRANSITION (transition intensity spike)
- Mar 12-19: BOUNDARY LAYER or CRISIS CONSOLIDATION (contagion fear)
- Post-BTFP: Rapid return toward STABLE

**Step 4: Run and validate**

Run: `node tests/backtest-svb.js`
Expected: Correlation >= 85%, fast transition detection matches documented 3-day crisis onset

**Step 5: Commit**

```bash
git add tests/data/2023-svb/ src/domains/svb-2023/ tests/backtest-svb.js
git commit -m "test: 2023 SVB backtest — bank run through mathematical framework"
```

---

### Task 9: Add Projection to Oil Backtest

**Files:**
- Modify: `tests/backtest-real-data.js`

**Step 1: Import projection functions**

Add to imports:
```js
import { computePropagationCapacity, computeDissolutionRate, classifyTrajectory } from "../src/engine/projection.js";
```

Or inline them in the shared lib.

**Step 2: Compute propagation + dissolution per day**

In backtestEvent loop, after computing regime, add:
```js
const prop = computePropagationCapacity(signals, categoryKeys);
coherenceHistory.push(coherence);
const diss = coherenceHistory.length >= 3
  ? computeDissolutionRate(coherenceHistory.slice(-5))
  : 0;
const trajectory = classifyTrajectory(prop.aggregate, diss);
```

**Step 3: Add trajectory column to output**

Add trajectory label to per-day output line.

**Step 4: Add forward projection validations**

For 2026 Hormuz:
- Early Jan: ACCELERATING (propagation high — price signals lagging non-price)
- Late Feb: CONSOLIDATING (propagation low — signals converging)

**Step 5: Run and verify existing tests still pass**

Run: `node tests/backtest-real-data.js`
Expected: All existing validations pass, new trajectory data visible

**Step 6: Commit**

```bash
git add tests/backtest-real-data.js
git commit -m "feat: add propagation/dissolution forward projection to oil backtest"
```

---

### Task 10: Cross-Domain Invariance Test

**Files:**
- Create: `tests/backtest-cross-domain.js`

**Step 1: Write the capstone test**

This script imports results from all domain backtests and validates mathematical invariants hold across every domain.

```js
// tests/backtest-cross-domain.js
// Imports each domain's backtest module or re-runs key computations.
// Validates 6 cross-domain invariants.
```

Invariants to test:

1. **Mean-Gini Inverse Correlation**: During consolidation phases in each domain, Pearson r(mean, Gini) < -0.5
2. **Coherence Stratification**: For every domain, CRISIS CONSOLIDATION avg coherence > TRANSIENT SPIKE avg coherence
3. **Multi-Frame Sensitivity**: For every domain with 2+ frames, different frames produce different regimes
4. **Transition Detection**: For every domain, transition intensity at event onset > pre-event baseline
5. **Gini Direction**: During consolidation, Gini decreases; during transient events, Gini remains stable/elevated
6. **Forward Projection**: Trajectory labels match documented crisis evolution (ACCELERATING → CONSOLIDATING → RESOLVING)

Output format:
```
CROSS-DOMAIN INVARIANCE REPORT
================================================================
Property                    | Oil  | GFC  | COVID | SVB  | HOLD?
----------------------------------------------------------------
Mean-Gini inverse (r<-0.5) |  Y   |  ?   |  ?    |  ?   |  ?
Coherence stratification    |  Y   |  ?   |  ?    |  ?   |  ?
Multi-frame sensitivity     |  Y   |  ?   |  ?    |  ?   |  ?
Transition detection        |  Y   |  ?   |  ?    |  ?   |  ?
Gini direction matches type |  Y   |  ?   |  ?    |  ?   |  ?
Forward projection accuracy |  ?   |  ?   |  ?    |  ?   |  ?
================================================================
INVARIANCE SCORE: X/24 properties hold
THEORY STATUS: PROVEN / PARTIAL / UNPROVEN
```

**Step 2: Run**

Run: `node tests/backtest-cross-domain.js`
Expected: Invariance score >= 80% (20/24+ properties hold)

**Step 3: Commit**

```bash
git add tests/backtest-cross-domain.js
git commit -m "test: cross-domain invariance — capstone proof of universal framework"
```

---

### Task 11: Enhance Domain Template

**Files:**
- Modify: `src/domains/_template/config.js`

**Step 1: Add semantic prime annotations to template**

```js
export default {
  id: "my-domain",
  name: "Domain Name",
  subtitle: "Brief description",

  // REQUIRED: Map domain categories to universal semantic prime categories
  // Universal categories: condition, flow, price, capacity, context
  primeMapping: {
    // my_condition_cat: "condition",
    // my_flow_cat: "flow",
    // my_price_cat: "price",
    // my_capacity_cat: "capacity",
    // my_context_cat: "context",
  },

  // ... rest of template with comments explaining semantic prime decomposition
};
```

**Step 2: Commit**

```bash
git add src/domains/_template/config.js
git commit -m "docs: enhance domain template with semantic prime annotations"
```

---

### Task 12: Update Memory + Documentation

**Files:**
- Modify: `C:\Users\JT-Light\.claude\projects\C--JTOD1-IntelBrief-Hormuz-Iran\memory\MEMORY.md`
- Modify: `tests/data/README.md`

**Step 1: Update MEMORY.md with cross-domain architecture**

Add:
- Cross-domain framework status
- Semantic prime ontology reference
- New file paths (projection.js, primes.js, domain configs)
- Backtest pattern (shared lib)

**Step 2: Update tests/data/README.md**

Add all new data sources and FRED series for GFC, COVID, SVB.

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: update memory and data README for cross-domain framework"
```
