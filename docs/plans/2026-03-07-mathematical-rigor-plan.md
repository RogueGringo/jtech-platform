# Mathematical Rigor Elevation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fake mathematical computations (weighted counts disguised as Gini, coherence, regime, phase transition) with real mathematics so the platform's language matches its implementation.

**Architecture:** Five mathematical fixes implemented bottom-up: new `dynamics.js` engine module for Gini coefficient + history buffer + transition intensity, rewritten `computeCoherence` using cross-category coefficient of variation, new `classifyRegime` using 2D (meanSeverity, gini) quadrant space. UI components updated to display the richer data structures.

**Tech Stack:** React 18, Vite 5, no test runner — verify via `npx vite build`. All engine code is pure functions. Domain-agnostic architecture: `engine/` + `ui/` + `domains/<name>/`.

---

## Context for All Tasks

**Severity rank mapping (used everywhere):**
```js
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };
```

**Categories in config (5 total):** kernel, physical, price, domestic, geopolitical

**Current coherence object shape (will change):**
```js
{ score, label, criticalCount, highCount }
```

**New coherence object shape (after this work):**
```js
{
  gini,              // 0-1, real Gini coefficient
  meanSeverity,      // 1-4, mean severity rank
  coherenceScore,    // 0-100, cross-category CV inverted
  regime: { label, quadrant },  // 2D regime classification
  criticalCount,     // preserved for backward compat
  highCount,         // preserved for backward compat
  // Legacy aliases for components that read .score / .label:
  score,             // alias for coherenceScore
  label,             // alias for regime.label
}
```

---

### Task 1: Create `src/engine/dynamics.js` — Gini + History Buffer + Transition Intensity

**Files:**
- Create: `src/engine/dynamics.js`

**Step 1: Write the dynamics engine module**

Create `src/engine/dynamics.js` with the following complete code:

```js
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

// --- Real Gini Coefficient ---
// G = (sum_i sum_j |x_i - x_j|) / (2 * n^2 * mean(x))
// G near 0: uniform severity (signals agree)
// G near 1: severity concentrated in few signals
export function computeGini(signals) {
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

// --- Mean Severity Rank ---
export function computeMeanSeverity(signals) {
  if (signals.length === 0) return 1;
  const ranks = signals.map(s => SEVERITY_RANK[s.severity] || 1);
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

// --- Cross-Category Coherence via Coefficient of Variation ---
// 1. Compute mean severity rank per category
// 2. CV = sigma / mu across category means
// 3. Coherence = (1 - min(CV, 1)) * 100
export function computeCrossCoherence(signals, categoryKeys) {
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

// --- 2D Regime Classification ---
// Quadrant from (meanSeverity, gini):
//   Low mean + Low gini  = STABLE
//   Low mean + High gini = TRANSIENT SPIKE
//   High mean + Low gini = CRISIS CONSOLIDATION
//   High mean + High gini = BOUNDARY LAYER
export function classifyRegime(meanSeverity, gini) {
  const highMean = meanSeverity >= 2.5;
  const highGini = gini >= 0.2;
  if (!highMean && !highGini) return { label: "STABLE", quadrant: "low-low" };
  if (!highMean && highGini)  return { label: "TRANSIENT SPIKE", quadrant: "low-high" };
  if (highMean && !highGini)  return { label: "CRISIS CONSOLIDATION", quadrant: "high-low" };
  return { label: "BOUNDARY LAYER", quadrant: "high-high" };
}

// --- Signal History Buffer (ring buffer) ---
const MAX_SNAPSHOTS = 30;

export function createHistoryBuffer() {
  return { snapshots: [], cursor: 0 };
}

export function pushSnapshot(buffer, signals) {
  const snapshot = {
    timestamp: Date.now(),
    ranks: {},
  };
  for (const s of signals) {
    snapshot.ranks[s.id] = SEVERITY_RANK[s.severity] || 1;
  }
  if (buffer.snapshots.length < MAX_SNAPSHOTS) {
    buffer.snapshots.push(snapshot);
  } else {
    buffer.snapshots[buffer.cursor] = snapshot;
  }
  buffer.cursor = (buffer.cursor + 1) % MAX_SNAPSHOTS;
  return buffer;
}

// Get snapshots in chronological order
function getOrderedSnapshots(buffer) {
  const len = buffer.snapshots.length;
  if (len < MAX_SNAPSHOTS) return buffer.snapshots;
  // Ring buffer is full — cursor points to oldest
  return [...buffer.snapshots.slice(buffer.cursor), ...buffer.snapshots.slice(0, buffer.cursor)];
}

// --- Activity:State per Signal ---
// Delta from config baseline severity rank + delta from previous snapshot
export function computeActivityState(signals, buffer, baselineSignals) {
  const ordered = getOrderedSnapshots(buffer);
  const prev = ordered.length >= 2 ? ordered[ordered.length - 2] : null;
  const baseRanks = {};
  for (const s of baselineSignals) {
    baseRanks[s.id] = SEVERITY_RANK[s.severity] || 1;
  }
  return signals.map(s => {
    const currentRank = SEVERITY_RANK[s.severity] || 1;
    const baselineRank = baseRanks[s.id] || 1;
    const deltaFromBaseline = currentRank - baselineRank;
    const deltaFromPrev = prev && prev.ranks[s.id] !== undefined
      ? currentRank - prev.ranks[s.id]
      : 0;
    return {
      id: s.id,
      currentRank,
      baselineRank,
      deltaFromBaseline,
      deltaFromPrev,
      direction: deltaFromBaseline > 0 ? "escalating" : deltaFromBaseline < 0 ? "deescalating" : "stable",
    };
  });
}

// --- Transition Intensity via Change Vector ---
// 1. delta_i = currentRank - baselineRank for each signal
// 2. magnitude = sqrt(sum(delta_i^2))
// 3. alignment = fraction of non-zero deltas sharing the dominant sign
export function computeTransitionIntensity(signals, baselineSignals) {
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
  // Normalize magnitude: max possible is sqrt(n * 3^2) where 3 is max delta (4-1)
  const maxMag = Math.sqrt(signals.length * 9);
  const normalized = maxMag > 0 ? magnitude / maxMag : 0;
  let label;
  if (normalized < 0.2) label = "STABLE";
  else if (alignment >= 0.7) label = "PHASE TRANSITION";
  else label = "TURBULENCE";
  return { magnitude, alignment, normalized, label };
}

// --- Gini Trajectory Slope ---
// Direction of (mean, gini) point over recent history
export function computeGiniTrajectory(buffer, signals) {
  const ordered = getOrderedSnapshots(buffer);
  if (ordered.length < 3) return { slope: 0, direction: "insufficient data" };
  // Compute gini for last 3 snapshots using stored ranks
  const recentGinis = ordered.slice(-3).map(snap => {
    const ranks = Object.values(snap.ranks);
    if (ranks.length === 0) return 0;
    const n = ranks.length;
    const mean = ranks.reduce((a, b) => a + b, 0) / n;
    if (mean === 0) return 0;
    let sumAbsDiff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sumAbsDiff += Math.abs(ranks[i] - ranks[j]);
      }
    }
    return sumAbsDiff / (2 * n * n * mean);
  });
  // Simple slope: last minus first over 2 intervals
  const slope = (recentGinis[2] - recentGinis[0]) / 2;
  const direction = slope > 0.01 ? "concentrating" : slope < -0.01 ? "dispersing" : "stable";
  return { slope, direction };
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build (new file has no imports from other project files, only exports)

**Step 3: Commit**

```bash
git add src/engine/dynamics.js
git commit -m "feat: add dynamics engine — real Gini, cross-category coherence, history buffer, transition intensity"
```

---

### Task 2: Rewrite `computeCoherence` in `src/engine/signals.js`

**Files:**
- Modify: `src/engine/signals.js:10-16`

**Step 1: Rewrite computeCoherence to use dynamics.js functions**

Replace the entire `computeCoherence` function with one that uses the real math from dynamics.js and returns the new enriched shape:

```js
import { computeGini, computeMeanSeverity, computeCrossCoherence, classifyRegime } from "./dynamics.js";

export function computeCoherence(signals, categoryKeys) {
  const gini = computeGini(signals);
  const meanSeverity = computeMeanSeverity(signals);
  const coherenceScore = computeCrossCoherence(signals, categoryKeys);
  const regime = classifyRegime(meanSeverity, gini);
  const criticalCount = signals.filter(s => s.severity === "critical").length;
  const highCount = signals.filter(s => s.severity === "high").length;
  return {
    gini,
    meanSeverity,
    coherenceScore,
    regime,
    criticalCount,
    highCount,
    // Legacy aliases — UI components read .score and .label
    score: coherenceScore,
    label: regime.label,
  };
}
```

The old function signature `computeCoherence(signals)` becomes `computeCoherence(signals, categoryKeys)`. The caller in App.jsx must pass category keys.

**Step 2: Verify build**

Run: `npx vite build`
Expected: Build passes (App.jsx call site will be updated in Task 3)

**Step 3: Commit**

```bash
git add src/engine/signals.js
git commit -m "feat: rewrite computeCoherence with real Gini, cross-category CV, 2D regime"
```

---

### Task 3: Update `src/ui/App.jsx` — Pass categoryKeys + History Buffer + Activity State + Transition Intensity

**Files:**
- Modify: `src/ui/App.jsx`

**Step 1: Add imports and history buffer state**

Add dynamics imports and history buffer state. The full replacement of the import block and state additions:

Replace the import line:
```js
import { computeSeverity, computeCoherence } from "../engine/signals.js";
```
with:
```js
import { computeSeverity, computeCoherence } from "../engine/signals.js";
import { createHistoryBuffer, pushSnapshot, computeActivityState, computeTransitionIntensity } from "../engine/dynamics.js";
```

After the `priceStatus` state declaration (`const [priceStatus, setPriceStatus] = useState("loading");`), add:

```js
  const [historyBuffer, setHistoryBuffer] = useState(createHistoryBuffer);
  const baselineSignals = useMemo(() => domainConfig.signals || [], []);
  const categoryKeys = useMemo(() => Object.keys(domainConfig.categories || {}), []);
```

**Step 2: Update coherence computation to pass categoryKeys**

Replace:
```js
  const coherence = useMemo(() => computeCoherence(signals), [signals]);
```
with:
```js
  const coherence = useMemo(() => computeCoherence(signals, categoryKeys), [signals, categoryKeys]);
```

**Step 3: Add history buffer push + derived computations**

After the coherence line, add:

```js
  // Push snapshot to history buffer whenever signals change
  useEffect(() => {
    setHistoryBuffer(prev => pushSnapshot({ ...prev, snapshots: [...prev.snapshots] }, signals));
  }, [signals]);

  // Compute activity:state deltas and transition intensity
  const activityState = useMemo(
    () => computeActivityState(signals, historyBuffer, baselineSignals),
    [signals, historyBuffer, baselineSignals]
  );
  const transitionIntensity = useMemo(
    () => computeTransitionIntensity(signals, baselineSignals),
    [signals, baselineSignals]
  );
```

**Step 4: Pass new props to children**

Replace the monitor tab content line:
```js
    monitor: <SignalMonitor config={domainConfig} terms={allTerms} signals={signals} coherence={coherence} priceStatus={priceStatus} />,
```
with:
```js
    monitor: <SignalMonitor config={domainConfig} terms={allTerms} signals={signals} coherence={coherence} priceStatus={priceStatus} activityState={activityState} transitionIntensity={transitionIntensity} />,
```

Replace the patterns tab content line:
```js
    patterns: <PatternsView config={domainConfig} content={domainContent} terms={allTerms} signals={signals} />,
```
with:
```js
    patterns: <PatternsView config={domainConfig} content={domainContent} terms={allTerms} signals={signals} transitionIntensity={transitionIntensity} />,
```

Also pass coherence to Header (already done, but now it has richer data).

**Step 5: Verify build**

Run: `npx vite build`
Expected: Clean build, 54+ modules

**Step 6: Commit**

```bash
git add src/ui/App.jsx
git commit -m "feat: wire history buffer, activity state, transition intensity through App"
```

---

### Task 4: Update `src/ui/RegimeBadge.jsx` — 2D Regime Display

**Files:**
- Modify: `src/ui/RegimeBadge.jsx`

**Step 1: Update to show 2D regime with Gini + mean severity**

Replace the entire file content with:

```jsx
import { COLORS } from "./DesignSystem.js";

const REGIME_COLORS = {
  "STABLE": COLORS.green,
  "TRANSIENT SPIKE": COLORS.orange,
  "BOUNDARY LAYER": COLORS.orange,
  "CRISIS CONSOLIDATION": COLORS.red,
};

export default function RegimeBadge({ coherence }) {
  const { gini, meanSeverity, regime, criticalCount, highCount, coherenceScore } = coherence;
  const color = REGIME_COLORS[regime.label] || COLORS.textMuted;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 20px", borderRadius: 8,
      background: `${color}15`, border: `1px solid ${color}40`,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        boxShadow: `0 0 8px ${color}80`,
        animation: "pulse 2s infinite",
      }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1.5 }}>{regime.label}</div>
        <div style={{ fontSize: 10, color: COLORS.textDim }}>
          G={gini.toFixed(2)} · x&#x0304;={meanSeverity.toFixed(1)} · C={coherenceScore}%
        </div>
        <div style={{ fontSize: 9, color: COLORS.textMuted }}>
          {criticalCount} critical / {highCount} high
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/ui/RegimeBadge.jsx
git commit -m "feat: RegimeBadge shows 2D regime with Gini, mean severity, coherence"
```

---

### Task 5: Update `src/ui/Header.jsx` — 2D Regime Color Mapping

**Files:**
- Modify: `src/ui/Header.jsx:5-7`

**Step 1: Replace threshold-based color with regime-based color**

Replace:
```js
  const regimeColor = coherence
    ? (coherence.score >= 75 ? COLORS.red : coherence.score >= 50 ? COLORS.orange : COLORS.green)
    : COLORS.textMuted;
```
with:
```js
  const REGIME_COLORS = { "STABLE": COLORS.green, "TRANSIENT SPIKE": COLORS.orange, "BOUNDARY LAYER": COLORS.orange, "CRISIS CONSOLIDATION": COLORS.red };
  const regimeColor = coherence?.regime ? (REGIME_COLORS[coherence.regime.label] || COLORS.textMuted) : COLORS.textMuted;
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/ui/Header.jsx
git commit -m "feat: Header regime badge uses 2D regime color mapping"
```

---

### Task 6: Update `src/ui/SignalMonitor.jsx` — Real Gini Gauge + Activity:State on Cards

**Files:**
- Modify: `src/ui/SignalMonitor.jsx`

This task has two parts: (A) update the coherence gauge to show real Gini, (B) add activity:state deltas to signal cards.

**Step 1: Update function signature to accept new props**

Replace:
```jsx
export default function SignalMonitor({ config, terms, signals, coherence, priceStatus }) {
```
with:
```jsx
export default function SignalMonitor({ config, terms, signals, coherence, priceStatus, activityState, transitionIntensity }) {
```

**Step 2: Update the coherence score destructuring and regime color**

Replace:
```js
  const { score: coherenceScore, criticalCount, highCount } = coherence;
  const regimeColor = coherenceScore >= 75 ? COLORS.red : coherenceScore >= 50 ? COLORS.orange : COLORS.green;
```
with:
```js
  const { gini, meanSeverity, coherenceScore, regime, criticalCount, highCount } = coherence;
  const REGIME_COLORS = { "STABLE": COLORS.green, "TRANSIENT SPIKE": COLORS.orange, "BOUNDARY LAYER": COLORS.orange, "CRISIS CONSOLIDATION": COLORS.red };
  const regimeColor = REGIME_COLORS[regime.label] || COLORS.textMuted;
```

**Step 3: Update the coherence gauge display**

Replace the gauge bar text:
```jsx
              {coherenceScore}% CONSOLIDATION
```
with:
```jsx
              G={gini.toFixed(2)} · x&#x0304;={meanSeverity.toFixed(1)} · C={coherenceScore}%
```

Replace the gauge interpretation text block (the div with `marginTop: 12`):
```jsx
            {coherenceScore >= 75
              ? <>Positive Gini trajectory. <strong style={{ color: COLORS.red }}>{criticalCount} critical</strong> and <strong style={{ color: COLORS.orange }}>{highCount} high</strong> signals consolidating — independent systems confirm structural phase transition.</>
              : coherenceScore >= 50
                ? <>Intermediate coherence. Signals partially aligned — monitoring for consolidation or dispersion trend.</>
                : <>Negative Gini trajectory. Signals dispersing — current perturbation appears transient, not structural.</>
            }
```
with:
```jsx
            {regime.label === "CRISIS CONSOLIDATION"
              ? <>Low Gini ({gini.toFixed(2)}) + high mean severity ({meanSeverity.toFixed(1)}) — <strong style={{ color: COLORS.red }}>{criticalCount} critical</strong> and <strong style={{ color: COLORS.orange }}>{highCount} high</strong> signals consolidating. Independent categories agree on crisis state.</>
              : regime.label === "BOUNDARY LAYER"
                ? <>High Gini ({gini.toFixed(2)}) + high mean severity ({meanSeverity.toFixed(1)}) — severity concentrated in few signals. System at boundary between regimes.</>
                : regime.label === "TRANSIENT SPIKE"
                  ? <>High Gini ({gini.toFixed(2)}) + low mean severity ({meanSeverity.toFixed(1)}) — isolated signals elevated but no structural shift. Likely transient.</>
                  : <>Low Gini ({gini.toFixed(2)}) + low mean severity ({meanSeverity.toFixed(1)}) — signals uniformly calm. System stable.</>
            }
```

**Step 4: Add activity:state deltas to signal cards**

Build an activityMap for easy lookup. After the `liveSignalCount` / `referenceSignalCount` lines, add:

```js
  const activityMap = useMemo(() => {
    const map = {};
    if (activityState) for (const a of activityState) map[a.id] = a;
    return map;
  }, [activityState]);
```

Add `useMemo` to the import if not already there (it's already imported at line 1 — check: `useState, useCallback` — needs `useMemo` added).

In the signal card rendering, after the trend display line (the `<span>` with `trendArrow(s.trend) ... {s.trend.toUpperCase()}`), add the activity:state delta display:

After this closing `</div>` of the trend/source flex container:
```jsx
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  ...trend...
                  ...source...
                </div>
```

Add a new block below it (before the closing `</div>` of the card):
```jsx
                {activityMap[s.id] && activityMap[s.id].deltaFromBaseline !== 0 && (
                  <div style={{
                    marginTop: 6, padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                    letterSpacing: 0.5,
                    background: activityMap[s.id].deltaFromBaseline > 0 ? `${COLORS.red}12` : `${COLORS.green}12`,
                    color: activityMap[s.id].deltaFromBaseline > 0 ? COLORS.red : COLORS.green,
                  }}>
                    {activityMap[s.id].deltaFromBaseline > 0 ? "\u25B2" : "\u25BC"}{" "}
                    {Math.abs(activityMap[s.id].deltaFromBaseline)} from baseline
                    {activityMap[s.id].deltaFromPrev !== 0 && (
                      <span style={{ marginLeft: 6, opacity: 0.7 }}>
                        ({activityMap[s.id].deltaFromPrev > 0 ? "+" : ""}{activityMap[s.id].deltaFromPrev} prev)
                      </span>
                    )}
                  </div>
                )}
```

**Step 5: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 6: Commit**

```bash
git add src/ui/SignalMonitor.jsx
git commit -m "feat: SignalMonitor shows real Gini gauge, 2D regime interpretation, activity:state deltas"
```

---

### Task 7: Update `src/engine/patterns.js` — Add Transition Intensity

**Files:**
- Modify: `src/engine/patterns.js`

**Step 1: Accept transitionIntensity parameter and include in output**

The `assessPhase` function already works well for threshold-based phase identification. We add an optional `transitionIntensity` parameter so the UI can display it alongside phase scores.

Replace the function signature:
```js
export function assessPhase(signals, phases) {
```
with:
```js
export function assessPhase(signals, phases, transitionIntensity) {
```

Replace the return statement:
```js
  return { currentPhase, phaseScores, transitionIndicators };
```
with:
```js
  return { currentPhase, phaseScores, transitionIndicators, transitionIntensity: transitionIntensity || null };
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/engine/patterns.js
git commit -m "feat: assessPhase accepts and passes through transitionIntensity"
```

---

### Task 8: Update `src/ui/PatternsView.jsx` — Pass Transition Intensity Through

**Files:**
- Modify: `src/ui/PatternsView.jsx`

**Step 1: Accept and pass transitionIntensity**

Replace:
```jsx
export default function PatternsView({ config, content, terms, signals }) {
```
with:
```jsx
export default function PatternsView({ config, content, terms, signals, transitionIntensity }) {
```

Replace:
```jsx
        <PhaseIndicator signals={signals || []} phases={config.phases || []} />
```
with:
```jsx
        <PhaseIndicator signals={signals || []} phases={config.phases || []} transitionIntensity={transitionIntensity} />
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/ui/PatternsView.jsx
git commit -m "feat: PatternsView passes transitionIntensity to PhaseIndicator"
```

---

### Task 9: Update `src/ui/PhaseIndicator.jsx` — Transition Intensity Meter

**Files:**
- Modify: `src/ui/PhaseIndicator.jsx`

**Step 1: Accept transitionIntensity and update assessPhase call**

Replace:
```jsx
export default function PhaseIndicator({ signals, phases }) {
  const assessment = useMemo(() => assessPhase(signals, phases), [signals, phases]);
```
with:
```jsx
export default function PhaseIndicator({ signals, phases, transitionIntensity }) {
  const assessment = useMemo(() => assessPhase(signals, phases, transitionIntensity), [signals, phases, transitionIntensity]);
```

**Step 2: Add transition intensity meter after the transition monitor section**

Before the final closing `</div>` of the component (line 109), add:

```jsx
      {assessment.transitionIntensity && assessment.transitionIntensity.normalized > 0 && (
        <div style={{
          marginTop: 12, padding: "12px 16px", borderRadius: 8,
          background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.gold }}>
              TRANSITION INTENSITY
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              padding: "2px 8px", borderRadius: 4,
              color: assessment.transitionIntensity.label === "PHASE TRANSITION" ? COLORS.red
                : assessment.transitionIntensity.label === "TURBULENCE" ? COLORS.orange : COLORS.green,
              background: (assessment.transitionIntensity.label === "PHASE TRANSITION" ? COLORS.red
                : assessment.transitionIntensity.label === "TURBULENCE" ? COLORS.orange : COLORS.green) + "15",
            }}>
              {assessment.transitionIntensity.label}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 4 }}>MAGNITUDE</div>
              <div style={{ height: 6, borderRadius: 3, background: COLORS.bg, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: Math.round(assessment.transitionIntensity.normalized * 100) + "%",
                  background: COLORS.orange, transition: "width 0.5s",
                }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 4 }}>ALIGNMENT</div>
              <div style={{ height: 6, borderRadius: 3, background: COLORS.bg, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: Math.round(assessment.transitionIntensity.alignment * 100) + "%",
                  background: COLORS.blue, transition: "width 0.5s",
                }} />
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>
                {Math.round(assessment.transitionIntensity.normalized * 100)}%
              </div>
              <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                {Math.round(assessment.transitionIntensity.alignment * 100)}% aligned
              </div>
            </div>
          </div>
        </div>
      )}
```

**Step 3: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 4: Commit**

```bash
git add src/ui/PhaseIndicator.jsx
git commit -m "feat: PhaseIndicator shows transition intensity meter with magnitude + alignment"
```

---

### Task 10: Update `src/ui/SignalConstellation.jsx` — Gini-Weighted Node Positioning

**Files:**
- Modify: `src/ui/SignalConstellation.jsx`

**Step 1: Replace simple coherence-based distance with Gini-based distance**

Currently the constellation uses `coherence.score` to scale node distance from center. Replace with `coherence.gini` — low Gini (agreement) pulls nodes toward center, high Gini (disagreement) pushes them outward.

Replace:
```js
    const coherenceFactor = 1 - (coherence.score / 100) * 0.5;
```
with:
```js
    const gini = coherence.gini !== undefined ? coherence.gini : 0.5;
    // Low gini (signals agree) -> nodes closer to center (tighter constellation)
    // High gini (signals disagree) -> nodes spread out
    const coherenceFactor = 0.5 + gini * 0.5;
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/ui/SignalConstellation.jsx
git commit -m "feat: SignalConstellation uses real Gini for node distance weighting"
```

---

### Task 11: Final Build Verification + Fix Any Import Issues

**Files:**
- Potentially: `src/ui/SignalMonitor.jsx` (add `useMemo` to import if missing)

**Step 1: Run full build**

Run: `npx vite build`

**Step 2: Fix any issues found**

Check that `useMemo` is imported in SignalMonitor.jsx. Currently line 1 is:
```js
import { useState, useCallback } from "react";
```
If `useMemo` is not imported, add it:
```js
import { useState, useCallback, useMemo } from "react";
```

**Step 3: Run build again**

Run: `npx vite build`
Expected: Clean build, all modules resolved

**Step 4: Commit if changes were needed**

```bash
git add -A
git commit -m "fix: resolve import issues from mathematical rigor elevation"
```

---

## Success Criteria

- [ ] `computeGini()` produces correct Gini coefficient (uniform [2,2,2,2] -> G=0, extreme [4,1,1,1] -> G>0.3)
- [ ] Coherence measures cross-category agreement via coefficient of variation
- [ ] Activity:state shows delta from baseline for each signal on page load
- [ ] History buffer accumulates and trajectory slope computes after 3+ snapshots
- [ ] Transition intensity captures both magnitude and alignment
- [ ] 2D regime classification distinguishes all four quadrants
- [ ] Build passes cleanly
- [ ] Every mathematical term in glossary corresponds to a real computation
