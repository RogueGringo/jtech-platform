# Information Environment Manifold — Design Document

**Author:** mr.white@jtech.ai + Claude Code
**Date:** 2026-03-08
**Status:** Approved
**Thesis:** Under extreme cognitive load, human communication regresses to semantic primes. This regression follows the same mathematical invariants (Gini, coherence, regime, projection) proven across 4 crisis domains at 99% cross-domain invariance. The IE Manifold operationalizes this as a three-panel signal fusion system.

## Background

**Cycle 2 (completed):** Mathematical framework proven domain-agnostic — 4 domains (oil, GFC, COVID, SVB), 34/34 validations, 7/7 cross-domain invariants, 99.0% invariance score. All on structured numeric data (FRED time series).

**Cycle 3 (this design):** Close the loop. Prove the linguistic regression hypothesis on real crisis communication data. Operationalize as a live Information Environment monitor.

## The 37F IE Manifold

The system detects when a Target Audience's linguistic and cognitive options have reduced to semantic primes — the Attractor State where behavior becomes predictable.

### Regime Quadrants (IE Layer)

| Engine Quadrant | IE Manifold State | Meaning |
|---|---|---|
| STABLE (low mean, low Gini) | **STABILITY** | Narrative intact, no influence window |
| TRANSIENT SPIKE (low mean, high Gini) | **VULNERABILITY** | Localized prime regression, narrative gap forming |
| BOUNDARY LAYER (high mean, high Gini) | **OPPORTUNITY** | Manifold unlocking, competing primes, max influence potential |
| CRISIS CONSOLIDATION (high mean, low Gini) | **CRISIS** | Full prime regression, TA in reactive state |

### Projection Layer (Operational Tempo)

| Trajectory | IE Meaning |
|---|---|
| ACCELERATING | Dissolution accelerating — LOE window opening |
| CONSOLIDATING | TA locked on crisis primes — manifold receptive |
| TURBULENT | Competing attractors — narrative space contested |
| RESOLVING | New narrative crystallizing — manifold re-stabilizing |

## Architecture: Three-Panel Signal Fusion

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│  GDELT   │   │ CRISIS   │   │ DISPATCH │
│  (live)  │   │ (batch)  │   │ (batch)  │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     ▼              ▼              ▼
┌──────────────────────────────────────────┐
│         Feed Adapter Layer               │
│  raw data → semantic prime signals[]     │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│      Math Engine (unchanged)             │
│  Gini · Coherence · Regime · Projection  │
└────────────────┬─────────────────────────┘
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   Panel 1   Panel 2   Panel 3
   I&W      VULN ANAL  MOP/MOE
                 │
                 ▼
       Cross-Panel Coherence
       (Conviction / COG)
```

### Panel Roles

| Panel | Source | 37F Role | Detects |
|---|---|---|---|
| 1: MACRO | GDELT (live, 15-min) | Indications & Warnings | Objective stressors (the "what") |
| 2: SENTIMENT | CrisisFACTS/social (batch) | Vulnerability Analysis | Cognitive clearing (the "when") |
| 3: OPERATIONAL | Dispatch/structured (batch) | MOP/MOE | Physical-psychological alignment (the "real") |

### Cross-Panel Conviction Signal

- **High coherence across panels** = COG detected. Manifold locked. Maximum conviction.
- **Macro leads Sentiment** = Events preceding cognitive regression. Lead time window.
- **Sentiment leads Operational** = Psychological state preceding physical reality. Predictive.
- **Divergence** = One lens sees what others don't yet. Leading indicator.

## GDELT Adapter Design (Panel 1 — Live)

### Data Source

- GDELT DOC API: REST, free, no auth, 15-minute update cycle
- Returns events as: (Actor1, EventCode, Actor2, GoldsteinScale, AvgTone, NumMentions)
- CAMEO codes: 20 root categories for event classification

### CAMEO → Universal Category Mapping

| Universal Category | GDELT Signal Source |
|---|---|
| **condition** | Actor type + country stability |
| **flow** | NumMentions × NumSources (information flow rate) |
| **price** | GoldsteinScale (inverted: negative = higher severity) |
| **capacity** | Actor diversity + event density |
| **context** | QuadClass (verbal/material × cooperation/conflict) |

### CAMEO → Severity via GoldsteinScale

| CAMEO Range | Goldstein | Severity | IE Vector |
|---|---|---|---|
| 01-05 (cooperation) | +1 to +8 | watch | Propagation |
| 06-09 (material coop) | +4 to +7 | watch | Propagation |
| 10-14 (verbal conflict) | -2 to -5 | moderate | Transition |
| 15-17 (material conflict) | -5 to -8 | high | Dissolution |
| 18-20 (violence) | -8 to -10 | critical | Dissolution |

### Conflict = Dissolution, Cooperation = Propagation

Material Conflict (CAMEO 18-20) maps to Dissolution (dI/dt < 0) — physical breakdown of the manifold.
Verbal Cooperation (CAMEO 01-05) maps to Propagation (dI/dt > 0) — narrative reinforcement.

### Entropy Measurement

```
S = -Σ P(x) log₂ P(x)
```

Where P(x) = proportion of events at each CAMEO root code.
Low S = events concentrated on few codes = prime regression = manifold primed.

### Adapter Output

Standard `signals[]` array consumed by existing math engine without modification:
```js
[
  { id: "gdelt_condition", category: "condition", severity: "high" },
  { id: "gdelt_flow",      category: "flow",      severity: "critical" },
  { id: "gdelt_price",     category: "price",      severity: "moderate" },
  { id: "gdelt_capacity",  category: "capacity",   severity: "watch" },
  { id: "gdelt_context",   category: "context",    severity: "high" },
]
```

Plus metadata: `{ entropy, primeDensity, dissolutionRate, propagationRate }`

## Phase Plan

### Phase 1: GDELT Live + Batch Proofs
- Build `src/adapters/gdelt-adapter.js` — CAMEO → signals[]
- Build `tests/backtest-gdelt.js` — validate on 2022 Russia-Ukraine (known event)
- Build batch proofs for CrisisFACTS and dispatch data
- Prove cross-source invariance on same historical event

### Phase 2: Three-Panel UI
- Panel component (reusable, wired to any adapter)
- Cross-panel coherence computation
- IE regime overlay (STABILITY / VULNERABILITY / OPPORTUNITY / CRISIS)

### Phase 3: Live Monitor
- GDELT polling (15-min cycle)
- Real-time regime display
- Cross-panel conviction signal
- Entropy trend visualization

## Success Criteria

1. GDELT adapter produces valid signals[] consumed by unchanged math engine
2. Backtest on 2022 Russia-Ukraine GDELT data shows geometric validation (escalation, peak, recovery)
3. Cross-source invariance: GDELT + FRED backtests on same event produce correlated regime trajectories
4. Entropy S drops measurably during documented crisis onset
5. Three-panel cross-coherence identifies COG on at least one historical event

## Data Sources

| Source | Access | Format | Update | Auth |
|---|---|---|---|---|
| GDELT DOC API | REST | JSON | 15 min | None |
| GDELT Events (BigQuery) | BigQuery | CSV/JSON | 15 min | Google Cloud |
| CrisisFACTS | Download | JSONL | Static | TREC registration |
| CrisisLex | GitHub/Zenodo | CSV | Static | None |
| 911 Dispatch (NYC/Chicago/Seattle) | Open Data Portal | CSV/API | Daily | None |
| FRED (existing) | API/CSV | CSV | Daily | None |
