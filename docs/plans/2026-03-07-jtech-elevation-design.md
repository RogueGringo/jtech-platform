# JtechAi Platform Elevation — 5-Layer Design

**Author**: mr.white@jtech.ai + Claude Code
**Date**: 2026-03-07
**Status**: Approved
**Prerequisite**: Completed Cycle 1 rebrand & framework separation (branch `jtech-platform-rebrand`)

---

## Overview

The platform architecture is built and builds clean. This elevation addresses 5 dimensions where the current implementation has gaps between what was designed and what was wired:

1. **HelpHover** — built but not wired into any view component
2. **RegimeBadge** — only in SignalMonitor, not persistent across tabs
3. **Signal visualization** — flat grid only, no spatial/relational representation
4. **Effect chains** — static display, not connected to live signal data
5. **Patterns of Life** — renders static content, no computed phase detection

---

## Layer 1: Universal HelpHover Wiring

**Problem**: HelpHover component exists (`src/ui/HelpHover.jsx`) with viewport-aware tooltips, but zero views use it. The `terms` prop is passed to every view but never consumed.

**Solution**: Create a `<Term>` wrapper component that looks up a term in the merged glossary and renders HelpHover. Wire it into every view where technical terms appear.

### Implementation

**New file**: `src/ui/Term.jsx`
```jsx
// Looks up term in the allTerms map, renders HelpHover if found
export default function Term({ t, terms, children }) {
  const definition = terms[t] || terms[t.toLowerCase()];
  return <HelpHover term={t} definition={definition}>{children || t}</HelpHover>;
}
```

**Views to wire** (every view that receives `terms`):
- `ThesisView.jsx` — pass terms to ThesisContent, wrap key terms in content.jsx
- `NodesView.jsx` — wrap "condition:state", "boundary layer", "kernel condition", category names
- `EffectChainView.jsx` — wrap "effect chain", "condition:state", classification labels
- `SignalMonitor.jsx` — wrap "coherence", "Gini trajectory", "consolidation", "dispersion", "severity", "semantic prime"
- `LiveFeed.jsx` — wrap "effect", "event", "signal ratio"
- `PatternsView.jsx` — wrap terms in PatternsContent
- `Header.jsx` — wrap "effects-based" in the subtitle description

**Term sources** (already built):
- `src/terms/universal.js` — 17 framework terms
- `src/domains/hormuz-iran/terms.js` — 13 domain terms

---

## Layer 2: Persistent Regime Badge in Header

**Problem**: RegimeBadge only appears inside SignalMonitor. Users on other tabs have no visibility into current system state.

**Solution**: Lift coherence computation to App.jsx, pass it to Header, render a compact RegimeBadge next to the "CONTINUOUS UPDATE" indicator.

### Implementation

**App.jsx changes**:
- Import `computeCoherence` from engine/signals.js
- Import `fetchCommodityPrices` from engine/prices.js
- Run price fetch + coherence computation at App level (shared state)
- Pass `coherence` object to Header and SignalMonitor
- SignalMonitor receives live signals from App instead of fetching independently

**Header.jsx changes**:
- Accept `coherence` prop
- Render compact regime indicator: pulsing dot + label + score, between subtitle and CONTINUOUS UPDATE badge
- Color-coded: red >= 75, orange >= 50, green below

**SignalMonitor.jsx changes**:
- Remove independent price fetch — receive `signals` and `coherence` from parent
- Keep all display logic, filters, semantic analyzer

This means the regime state is visible on EVERY tab, updating live.

---

## Layer 3: Signal Constellation Visualization

**Problem**: SignalMonitor shows signals as a flat 4-column grid. There's no spatial representation of how signals relate to each other — consolidation and dispersion are described in text but not visualized.

**Solution**: Add a radial constellation view above the grid. Signals are positioned radially by category, with distance from center representing severity. When signals consolidate (agree), they visually cluster tighter. When they disperse, they spread apart.

### New file: `src/ui/SignalConstellation.jsx`

**Layout**:
- SVG canvas, ~600x400px
- Center point = "system equilibrium"
- 4 radial sectors (one per category: kernel, physical, price, domestic)
- Each signal = a circle node positioned within its sector
- Node size = proportional to severity weight
- Node color = severity color (red/orange/blue/muted)
- Distance from center = inverse severity (critical = close to center, watch = far out)

**Consolidation/dispersion animation**:
- When coherence score rises, all nodes drift inward (clustering)
- When coherence drops, nodes drift outward (dispersing)
- Transition animated over 500ms
- Connecting lines between same-category signals, opacity = severity agreement

**Interactivity**:
- Hover a node = tooltip with signal name, value, severity, trend
- Click = highlight that signal in the grid below
- Category labels at sector edges

**Integration**: Rendered inside SignalMonitor between the coherence gauge row and the signal grid.

---

## Layer 4: Live Effect Chain Highlighting

**Problem**: EffectChainView renders static chain diagrams from content.jsx. Chain nodes show hardcoded condition:states with no connection to live signal data.

**Solution**: Cross-reference chain nodes against live signal states. When a signal's severity matches a chain node's described condition, highlight that node as "active". Animate pulse propagation down the chain.

### Implementation

**Domain config addition** (`domains/hormuz-iran/config.js`):
```js
chainSignalMap: {
  "Maritime Insurance Cascade": {
    nodes: [
      { chainIndex: 0, signalId: "pni", activeWhen: "critical" },
      { chainIndex: 1, signalId: "tanker_transit", activeWhen: "critical" },
      { chainIndex: 2, signalId: "freight", activeWhen: "high" },
      { chainIndex: 3, signalId: "brent", activeWhen: "high" },
    ]
  },
  // ... other chains
}
```

**EffectChainView.jsx changes**:
- Accept `signals` prop (live signal array from App)
- For each chain section, look up `config.chainSignalMap[section.title]`
- For each chain link, check if the mapped signal's current severity meets `activeWhen`
- Active nodes: bright border glow + pulse animation + "ACTIVE" badge
- Inactive nodes: current dim styling
- Arrow connectors between active consecutive nodes get animated pulse (CSS animation moving a gradient along the connector line)

**Visual**:
- Active chain link: `boxShadow: "0 0 12px ${link.color}60"`, border brightens
- Pulse propagation: sequential 200ms delay per chain link, creating a "cascade wave" effect
- Status badge on each node: "ACTIVE — [signal value]" or "MONITORING"

---

## Layer 5: Computed Patterns of Life

**Problem**: PatternsView renders `PatternsContent` from content.jsx — a static React component with hardcoded prose. No computed analysis, no connection to live data.

**Solution**: Build a phase detection scoring system that evaluates current signal states against defined pattern criteria. Show a computed "phase assessment" dashboard alongside the domain narrative.

### New file: `src/engine/patterns.js`

```js
export function assessPhase(signals, phaseDefinitions) {
  // For each defined phase, count how many of its required signals
  // are at or above the specified severity
  // Returns: { currentPhase, phaseScores[], transitionIndicators[] }
}
```

### Domain config addition (`domains/hormuz-iran/config.js`):
```js
phases: [
  {
    id: "baseline",
    name: "Baseline Operations",
    description: "Normal maritime commerce, full insurance coverage, standard pricing",
    requiredSignals: [], // active when no crisis signals
    color: COLORS.green,
  },
  {
    id: "boundary",
    name: "Boundary Layer",
    description: "Insurance tightening, transit volumes declining, volatility rising",
    requiredSignals: [
      { signalId: "pni", minSeverity: "moderate" },
      { signalId: "ovx", minSeverity: "moderate" },
    ],
    color: COLORS.orange,
  },
  {
    id: "crisis",
    name: "Phase Transition — Crisis",
    description: "Insurance withdrawn, transit collapsed, price regime discontinuity",
    requiredSignals: [
      { signalId: "pni", minSeverity: "critical" },
      { signalId: "tanker_transit", minSeverity: "critical" },
      { signalId: "brent", minSeverity: "high" },
    ],
    color: COLORS.red,
  },
]
```

### New file: `src/ui/PhaseIndicator.jsx`

**Layout**:
- Horizontal phase timeline: BASELINE → BOUNDARY → CRISIS
- Current phase highlighted with glow
- Each phase shows: name, how many required signals are met (e.g., "2/3 conditions active")
- Transition arrows between phases with progress indicators
- Below timeline: list of specific signals driving the assessment with current values

### PatternsView.jsx changes:
- Accept `signals` prop from App
- Render PhaseIndicator above PatternsContent
- PhaseIndicator computes phase from live signals using `assessPhase()`
- PatternsContent remains as domain narrative context below

---

## Data Flow (After Elevation)

```
App.jsx
  ├── fetchCommodityPrices() → live prices
  ├── merge prices into signals array
  ├── computeCoherence(signals) → coherence object
  │
  ├── Header  ← coherence (persistent regime badge)
  ├── ThesisView  ← terms (help hovers)
  ├── NodesView  ← terms (help hovers)
  ├── PatternsView  ← signals, terms (phase indicator + help hovers)
  ├── EffectChainView  ← signals, terms (live chain highlighting + help hovers)
  ├── SignalMonitor  ← signals, coherence, terms (constellation + grid + help hovers)
  └── LiveFeed  ← terms (help hovers)
```

---

## Files Created/Modified

| Action | File | Layer |
|--------|------|-------|
| Create | `src/ui/Term.jsx` | 1 |
| Modify | `src/ui/ThesisView.jsx` | 1 |
| Modify | `src/ui/NodesView.jsx` | 1 |
| Modify | `src/ui/EffectChainView.jsx` | 1, 4 |
| Modify | `src/ui/SignalMonitor.jsx` | 1, 3 |
| Modify | `src/ui/LiveFeed.jsx` | 1 |
| Modify | `src/ui/PatternsView.jsx` | 1, 5 |
| Modify | `src/ui/Header.jsx` | 1, 2 |
| Modify | `src/ui/App.jsx` | 2 |
| Modify | `src/domains/hormuz-iran/content.jsx` | 1 |
| Modify | `src/domains/hormuz-iran/config.js` | 4, 5 |
| Create | `src/ui/SignalConstellation.jsx` | 3 |
| Create | `src/engine/patterns.js` | 5 |
| Create | `src/ui/PhaseIndicator.jsx` | 5 |

---

## Success Criteria

- [ ] Every technical term in every tab has a working HelpHover tooltip
- [ ] Regime badge visible on all tabs, updating from live signal data
- [ ] Signal constellation renders with radial category layout
- [ ] Constellation nodes animate consolidation/dispersion in response to coherence changes
- [ ] Effect chain nodes highlight when mapped signals reach activation threshold
- [ ] Chain pulse animation propagates through active consecutive nodes
- [ ] Phase indicator computes current phase from live signals
- [ ] Phase timeline shows progress through phase definitions
- [ ] Build passes cleanly (npx vite build)
- [ ] No regressions in existing functionality
