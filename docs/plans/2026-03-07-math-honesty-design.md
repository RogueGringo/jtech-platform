# Mathematical Honesty Pass — Design

**Author**: mr.white@jtech.ai + Claude Code
**Date**: 2026-03-07
**Status**: Approved
**Prerequisite**: Mathematical rigor elevation complete on branch `jtech-platform-rebrand`

---

## Problem

After the first mathematical rigor elevation, the platform has real Gini, cross-category coherence, 2D regime classification, transition intensity, and activity:state. But an audit reveals remaining dishonesty:

### Audit Results

| Term | Glossary Claims | Reality |
|------|----------------|---------|
| Gini trajectory | "Tracks trajectory over time" | `computeGiniTrajectory()` exists in dynamics.js but is **never called** — dead code |
| consolidation | "Positive Gini trajectory" | Static label on gauge endpoint — never dynamically evaluated |
| dispersion | "Negative Gini trajectory" | Static label on gauge endpoint — never dynamically evaluated |
| Gauge header | "SIGNAL COHERENCE — GINI TRAJECTORY" | Shows coherence score, not Gini trajectory — misleading |
| MS-GARCH | "Identifies distinct volatility regimes" | Not implemented — glossary defines it as if it exists |
| backwardation | Defined in glossary | No computation or signal — reference definition only |
| contango | Defined in glossary | No computation or signal — reference definition only |

---

## Solution: Wire Dead Code + Make Glossary Honest

### 1. Wire `computeGiniTrajectory` in App.jsx

Import and call `computeGiniTrajectory(historyBuffer, signals)`. Add result to the coherence object or pass as separate prop to SignalMonitor and Header.

Returns `{ slope, direction }` where direction is "concentrating" | "dispersing" | "stable" | "insufficient data".

### 2. Dynamic Consolidation/Dispersion Labels

Replace the static gauge endpoint labels ("DISPERSING (transient)" / "CONSOLIDATING (structural)") with the live trajectory direction:

- Buffer < 3 snapshots: "ACCUMULATING" / "ACCUMULATING"
- direction = "concentrating": Left label dims, right label highlights "CONSOLIDATING"
- direction = "dispersing": Right label dims, left label highlights "DISPERSING"
- direction = "stable": Both labels neutral, center shows "STABLE TRAJECTORY"

### 3. Trajectory Direction in RegimeBadge

Add a directional arrow and label below the G/x̄/C readout:
- concentrating: up-arrow + "CONSOLIDATING"
- dispersing: down-arrow + "DISPERSING"
- stable: dash + "STABLE"
- insufficient data: "..." (ellipsis)

### 4. Fix Gauge Header

Rename "SIGNAL COHERENCE — GINI TRAJECTORY" to "CROSS-CATEGORY COHERENCE" since the gauge displays coherence (CV-based), not Gini trajectory. Add a separate small trajectory indicator below the gauge.

### 5. Update Glossary Definitions

| Term | Updated Definition |
|------|-------------------|
| Gini trajectory | Add: "Computed as the slope of the Gini coefficient over recent snapshots (minimum 3 required)." |
| consolidation | Add: "Detected when Gini trajectory slope is positive — severity concentrating." |
| dispersion | Add: "Detected when Gini trajectory slope is negative — severity spreading." |
| coherence | Add: "Measured as (1 - CV) where CV is the coefficient of variation across category mean severities." |
| MS-GARCH | Add: "(Planned for future implementation cycle.)" |
| backwardation | Keep as-is — legitimate reference definition, no false computation claim. |
| contango | Keep as-is — legitimate reference definition, no false computation claim. |

---

## Files

| Action | File | Content |
|--------|------|---------|
| Modify | `src/ui/App.jsx` | Import + compute giniTrajectory, pass to SignalMonitor |
| Modify | `src/ui/SignalMonitor.jsx` | Accept giniTrajectory, fix gauge header, dynamic consolidation/dispersion labels, add trajectory indicator |
| Modify | `src/ui/RegimeBadge.jsx` | Accept + display trajectory direction |
| Modify | `src/ui/Header.jsx` | Pass giniTrajectory through to RegimeBadge (already passes coherence) |
| Modify | `src/terms/universal.js` | Update 5 glossary definitions |

---

## Success Criteria

- [ ] `computeGiniTrajectory` is called and its output reaches the UI
- [ ] Consolidation/dispersion labels change dynamically based on trajectory direction
- [ ] Gauge header accurately describes what's displayed (coherence, not Gini trajectory)
- [ ] RegimeBadge shows trajectory direction
- [ ] Glossary definitions match actual computations
- [ ] No glossary term claims computation that doesn't exist
- [ ] Build passes cleanly
