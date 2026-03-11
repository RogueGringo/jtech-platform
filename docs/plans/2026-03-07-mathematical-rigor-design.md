# JtechAi Mathematical Rigor Elevation — Design

**Author**: mr.white@jtech.ai + Claude Code
**Date**: 2026-03-07
**Status**: Approved
**Prerequisite**: 5-layer elevation complete on branch `jtech-platform-rebrand`

---

## Problem

The platform uses sophisticated mathematical vocabulary (Gini trajectory, coherence, phase transition, consolidation/dispersion, regime detection, MS-GARCH, activity:state) but implements simple counting underneath. This gap undermines the platform's claim to be a "reality decoder."

### Audit Results

| Term | Claims to Be | Actually Is |
|------|-------------|-------------|
| Gini trajectory | Gini coefficient over severity distribution | `(critical*1.0 + high*0.6) / n * 100` — weighted count |
| Coherence | Cross-category agreement on system state | Same weighted count — no agreement detection |
| Consolidation | Independent signals pointing same direction | "coherence > X" threshold |
| Phase transition | Nonlinear shift in system rules | Threshold matching (N of M signals at severity X) |
| Regime | Persistent state with distinct statistical properties | Label from three fixed thresholds |
| Activity:state | Rate of change of condition:state over time | Not implemented |
| MS-GARCH | Markov-Switching GARCH | Not implemented (future cycle) |

---

## Solution: Real Math for Real Words

### 1. Real Gini Coefficient

Replace fake coherence score with actual Gini coefficient over the severity rank distribution.

```
G = (sum_i sum_j |x_i - x_j|) / (2 * n^2 * mean(x))
```

Where x = [4, 4, 3, 2, ...] (severity ranks for all signals).

- G near 0: uniform severity (signals agree)
- G near 1: severity concentrated in few signals (signals disagree)

Combined with mean severity, gives 2D regime space:

| | Low Mean | High Mean |
|---|---|---|
| **Low Gini** | STABLE | CRISIS CONSOLIDATION |
| **High Gini** | TRANSIENT SPIKE | BOUNDARY LAYER |

### 2. Cross-Category Coherence

Measure whether categories *agree* on system state.

1. Compute mean severity rank per category
2. Compute coefficient of variation across category means: CV = sigma / mu
3. Coherence = (1 - min(CV, 1)) * 100

Low CV = categories agree = high coherence. High CV = categories disagree = low coherence.

Add directional coherence: percentage of signals sharing the dominant trend direction.

### 3. Signal History Buffer + Activity:State

In-memory ring buffer of 30 snapshots (60 min at 2-min refresh). Computes:

- **Activity:state** per signal: delta in severity rank from baseline (config initial values) and from previous snapshot
- **Acceleration**: second derivative of severity rank (inflection detection)
- **Gini trajectory slope**: direction of (mean, gini) point over recent history

Fallback when buffer empty: compare current severity rank to baseline severity rank from config.

### 4. Phase Transition Detection via Change Vector

Keep threshold-based phase identification. Add transition intensity:

1. Change vector: for each signal, delta_i = currentRank - baselineRank
2. Magnitude: ||delta|| = sqrt(sum(delta_i^2))
3. Alignment: fraction of deltas sharing the dominant sign

- High magnitude + high alignment = phase transition
- High magnitude + low alignment = turbulence
- Low magnitude = stability

### 5. 2D Regime Classification

Replace threshold labels with quadrant classification from (meanSeverity, gini) space. Add transition intensity to indicate how fast the regime is shifting.

---

## Files

| Action | File | Content |
|--------|------|---------|
| Modify | `src/engine/signals.js` | computeGini(), rewrite computeCoherence(), add classifyRegime() |
| Create | `src/engine/dynamics.js` | computeActivityState(), computeTransitionIntensity(), history buffer helpers |
| Modify | `src/engine/patterns.js` | Add transitionIntensity to assessPhase() |
| Modify | `src/ui/App.jsx` | Manage history buffer, compute enriched coherence, pass richer data |
| Modify | `src/ui/RegimeBadge.jsx` | Display 2D regime label + transition intensity |
| Modify | `src/ui/SignalMonitor.jsx` | Real Gini in gauge, activity:state deltas on cards |
| Modify | `src/ui/Header.jsx` | Regime badge uses 2D label |
| Modify | `src/ui/PhaseIndicator.jsx` | Show transition intensity meter |
| Modify | `src/ui/SignalConstellation.jsx` | Gini-weighted node positioning |

---

## Success Criteria

- [ ] computeGini() produces correct Gini coefficient (verified: uniform [2,2,2,2] -> G=0, extreme [4,1,1,1] -> G>0.3)
- [ ] Coherence measures cross-category agreement via coefficient of variation
- [ ] Activity:state shows delta from baseline for each signal on page load
- [ ] History buffer accumulates and trajectory slope computes after 3+ snapshots
- [ ] Transition intensity captures both magnitude and alignment
- [ ] 2D regime classification distinguishes all four quadrants
- [ ] Build passes cleanly
- [ ] Every mathematical term in glossary corresponds to a real computation
