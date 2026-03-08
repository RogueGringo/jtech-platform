# Cross-Domain Mathematical Framework via Semantic Primes

**Author:** mr.white@jtech.ai + Claude Code
**Date:** 2026-03-08
**Status:** Approved
**Thesis:** Language as a derivative of individual and collective mindset is the prime function for activity selection.

## Problem

The mathematical framework (Gini, coherence, 2D regime, transition intensity) achieves 90.9% correlation across 3 oil/geopolitical events and 5 analytical frames. The theory claims this is not domain-specific — the math captures a universal property of how human assessment drives activity selection. To prove this, the framework must be tested across fundamentally different crisis domains (financial, pandemic, banking) and the mathematical invariants must hold without tuning the engine.

## Success Criteria

All must hold for each domain tested:

1. **Composite correlation >= 85%** across 5+ domains
2. **Regime accuracy >= 90%** at documented key dates
3. **Mean-Gini Pearson r < -0.5** during consolidation phases
4. **Coherence stratification**: CRISIS CONSOLIDATION avg coherence > TRANSIENT SPIKE avg coherence
5. **Multi-frame sensitivity**: 2+ frames on same data produce different regimes
6. **Cross-domain invariance**: Properties hold independently in every domain without engine changes

## Design

### 1. Semantic Prime Layer

Any crisis narrative decomposes into domain-agnostic structural elements via semantic primes:

| Semantic Prime Group | What it captures | Maps to framework |
|---|---|---|
| ACTORS (someone, people) | Who is involved, how many | Signal count per category |
| INSTRUMENTS (something, body) | What objects/systems are affected | Signal IDs |
| STATE (good, bad, big, small) | Assessment of condition | Severity level (watch/moderate/high/critical) |
| ACTION (do, happen, move) | What participants are doing | Activity/trend direction |
| CAUSE (because, if) | Why — the causal chain | Category relationships (effect chains) |
| TIME (before, after, now) | Temporal position | History buffer, trajectory |
| MAGNITUDE (very, more, much) | Intensity of assessment | Severity rank, transition intensity |
| ALIGNMENT (same, other) | Agreement/disagreement | Gini, cross-coherence |

This is a structured analytical decomposition protocol, not NLP. An analyst asks:
- Who are the ACTORS? -> categories
- What INSTRUMENTS do they control? -> signals
- What STATE are the instruments in? -> severity
- What ACTIONS are being taken? -> trend/activity
- What CAUSES link them? -> effect chains

Emotional content ("panic," "crash," "fear") is stripped. What remains: someone assessed something as bad/big, and did something because of it. That is mathematizable.

### 2. Universal Category Ontology

Every domain maps to 4-6 categories drawn from this universal set:

| Universal Category | Semantic Prime | Oil/Hormuz | Financial Crisis | Pandemic |
|---|---|---|---|---|
| CONDITION | state of core system | Kernel (insurance) | Capital adequacy | Epidemiological state |
| FLOW | movement of primary resource | Physical (tankers) | Liquidity flows | Healthcare throughput |
| PRICE | market valuation signals | Price architecture | Asset prices | Economic indicators |
| CAPACITY | available reserves/ability | Domestic supply | Bank reserves | Hospital/vaccine capacity |
| CONTEXT | external environment | Geopolitical | Regulatory/political | Social compliance |

These map to how humans structurally organize assessment:
- What is the core system's health? (CONDITION)
- Is stuff moving? (FLOW)
- What are prices/values saying? (PRICE)
- How much runway exists? (CAPACITY)
- What is the environment doing? (CONTEXT)

The domain-specific part is only the SIGNALS within each category.

### 3. Propagation and Dissolution Dynamics

Forward-projection layer: "dimensions which extend into the future."

Current framework: (mean severity, Gini) -> regime quadrant (static snapshot)
Extended framework adds: (gini_slope, propagation_capacity, dissolution_rate) -> regime trajectory

**Propagation capacity per category:**
```
P(cat) = max_severity_in_cat - mean_severity_in_cat
```
High P = crisis hasn't fully propagated within the category. Cascades close this gap.

**Dissolution rate** — inverse of cross-category coherence trend:
```
D = -1 * d(coherence)/dt
```
Rising coherence (categories converging) = negative dissolution (deepening).
Falling coherence (categories diverging) = positive dissolution (resolving).

**Forward regime projection (Layer 2):**
```
Propagation HIGH + Dissolution NEGATIVE -> ACCELERATING (crisis will deepen)
Propagation LOW  + Dissolution NEGATIVE -> CONSOLIDATING (crisis is mature/locked in)
Propagation HIGH + Dissolution POSITIVE -> TURBULENT (uncertain, conflicting)
Propagation LOW  + Dissolution POSITIVE -> RESOLVING (crisis is unwinding)
```

Layer 1 (mean, Gini) = current regime state.
Layer 2 (propagation, dissolution) = regime trajectory.

### 4. Domain Backtest Protocol

Each new domain follows:

1. **Decompose** — Using semantic primes, identify 4-6 categories and 15-25 signals
2. **Source** — Find real public time-series data (FRED, WHO, NIST, etc.)
3. **Calibrate** — Set severity thresholds from historical documented levels
4. **Backtest** — Run through math engine, validate against documented regime states
5. **Validate invariants** — Confirm all 6 success criteria

Target domains:

| Domain | Event | Data Source | Key Series |
|---|---|---|---|
| Financial/Banking | 2008 GFC | FRED | VIXCLS, TEDRATE, SP500, BAMLH0A0HYM2, DFF |
| Demand Destruction | 2020 COVID oil | FRED | DCOILBRENTEU, DCOILWTICO, OVXCLS, ICSA |
| Bank Run | 2023 SVB | FRED | VIXCLS, DGS2, T10Y2Y, BAMLH0A0HYM2 |
| Pandemic | 2020 COVID health | HHS/WHO | Cases, ICU util, mortality, positivity |
| Cyber | 2021 Colonial Pipeline | CISA/ICS-CERT | Qualitative baseline + fuel price impact |

### 5. File Architecture

```
src/engine/
  dynamics.js          (unchanged)
  signals.js           (unchanged)
  projection.js        NEW: propagation, dissolution, forward regime
  primes.js            NEW: semantic prime category ontology + validation

src/domains/
  _template/config.js  (enhanced with semantic prime annotations)
  hormuz-iran/         (existing)
  gfc-2008/            NEW
  covid-2020/          NEW
  svb-2023/            NEW

tests/data/
  2008-gfc/            FRED financial time series
  2020-covid/          FRED + HHS time series
  2023-svb/            FRED financial time series

tests/
  backtest-real-data.js      (existing — oil/geopolitical)
  backtest-gfc.js            NEW
  backtest-covid.js          NEW
  backtest-svb.js            NEW
  backtest-cross-domain.js   NEW — validates invariants across ALL domains
```

### 6. Cross-Domain Invariance Test

The capstone: backtest-cross-domain.js validates mathematical properties are domain-invariant:

```
CROSS-DOMAIN INVARIANCE REPORT
================================================================
Property                    | Oil  | GFC  | COVID | SVB  | HOLD?
----------------------------------------------------------------
Mean-Gini inverse (r<-0.5) | -0.97| ???  | ???   | ???  | ?
Coherence stratification    | YES  | ???  | ???   | ???  | ?
Multi-frame sensitivity     | YES  | ???  | ???   | ???  | ?
Transition detection        | YES  | ???  | ???   | ???  | ?
Gini direction matches type | YES  | ???  | ???   | ???  | ?
Forward projection accuracy | n/a  | ???  | ???   | ???  | ?
================================================================
INVARIANCE SCORE: X/Y properties hold across all domains
```

If invariance >= 80%, the theory is proven: the mathematical framework captures a universal property of how human assessment structures crisis dynamics, regardless of domain.

## Implementation Order

1. `src/engine/projection.js` — propagation + dissolution dynamics
2. `src/engine/primes.js` — semantic prime ontology
3. 2008 GFC domain config + FRED data + backtest
4. 2020 COVID domain config + data + backtest
5. 2023 SVB domain config + data + backtest
6. Cross-domain invariance test
7. Template enhancement with semantic prime annotations
