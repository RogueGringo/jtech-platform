# 3D IE Manifold Visualization + LM Studio Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three.js 3D visualization of the JtechAi IE Manifold engine processes, integrated with local LM Studio (LFM2.5-1.2B) for real-time briefing generation. Self-validating against objective geometric invariants only — no synthetic data.

**Architecture:** React 18 + Three.js (via react-three-fiber) rendering three cycling 3D scenes — fiber bundle, signal pipeline, regime manifold — driven by the proven geometric engine. LM Studio v1 stateful API generates analyst briefings at sub-second latency. Replay mode (21K disaster messages) and live mode (GDELT + RSS feeds) as toggle.

**Tech Stack:** React 18, Vite 5, @react-three/fiber, @react-three/drei, LM Studio v1 REST API, existing math engine (topology.js, primes.js, backtest-engine.js, crisisfacts-adapter.js)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vite Dev Server                        │
│                  localhost:5173                           │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ Data      │   │ Geometric    │   │ Three.js 3D     │  │
│  │ Sources   │──▶│ Engine       │──▶│ Renderer        │  │
│  │           │   │              │   │                 │  │
│  │ • Replay  │   │ • primes.js  │   │ Scene A: Fiber  │  │
│  │ • GDELT   │   │ • topology.js│   │ Scene B: Flow   │  │
│  │ • RSS     │   │ • Gini/Ent.  │   │ Scene C: Regime │  │
│  └──────────┘   └──────┬───────┘   └────────┬────────┘  │
│                        │                     │           │
│                        ▼                     │           │
│               ┌────────────────┐             │           │
│               │ LM Studio API  │─────────────┘           │
│               │ 192.168.1.121  │  briefings → 3D overlay │
│               │ :1234          │                         │
│               │                │                         │
│               │ • v1 stateful  │                         │
│               │ • LFM2.5 Q8   │                         │
│               │ • Nomic embed  │                         │
│               └────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## 2. Three Cycling 3D Scenes

### Scene A: Fiber Bundle (Topological Evolution)

The Jones framework rendered in 3D space.

- **X-axis**: Time (batch index or real timestamp)
- **Y-axis**: Mean severity
- **Z-axis**: Gini coefficient
- **Fiber tubes**: Each domain traces a 3D curve through (time, mean, Gini) space
- **Color**: Regime classification (gold=STABILITY, blue=VULNERABILITY, orange=OPPORTUNITY, red=CRISIS)
- **Discontinuities**: Phase transitions render as visible breaks/flares in the tube
- **Waypoints**: Bifurcation points glow as topological markers
- **Camera**: Orbits slowly, user can grab and rotate

Data source: `multiScaleGini()` output from topology.js, `batchResults` from backtests.

### Scene B: Signal Flow Pipeline

The engine's internal processing visualized as a spatial flow.

- **Left cluster**: Data source nodes (text particles flowing in)
- **Center mesh**: Prime extraction lattice — particles hit the 200-word dictionary, dissolution particles glow red, propagation particles glow green, unmatched particles fade
- **Right cluster**: 5 universal category collectors (condition, flow, price, capacity, context)
- **Above**: Gini gauge (3D torus that tightens/loosens with inequality)
- **Below**: Entropy gauge (particle dispersion visualization)
- **Output plane**: Regime classification badge renders at the exit
- **LM Studio overlay**: Briefing text materializes as floating 3D text at output

Data source: `crisisTextToSignals()` running on streaming batches.

### Scene C: Regime Manifold Landscape

The 2D regime space as a 3D terrain.

- **X-axis**: Mean severity (1.0 → 4.0)
- **Y-axis**: Gini coefficient (0.0 → 0.5)
- **Z-axis (height)**: Prime density or signal count (terrain elevation)
- **Quadrants**: Four regime zones as colored terrain regions
  - STABILITY (low mean, low Gini) = calm plateau, gold
  - VULNERABILITY (rising mean, low Gini) = warming slope, blue
  - OPPORTUNITY (moderate mean, high Gini) = ridge line, orange
  - CRISIS (high mean, converging Gini) = deep valley/crater, red
- **Domain traces**: Each proven domain draws a glowing trajectory across the landscape
- **Current position**: Pulsing sphere at current regime coordinates
- **Prediction cone**: Forward trajectory projection from current state

Data source: `classifyRegime()` outputs across all 6 domains.

### Scene Cycling

- Auto-cycle every 15 seconds (configurable)
- Manual override via keyboard (1/2/3) or click
- Smooth camera transition between scenes (2s lerp)
- Each scene updates independently from engine data

## 3. LM Studio Integration

### API Contract

```javascript
const LM_STUDIO = "http://192.168.1.121:1234";

// Native v1 (stateful, preferred)
POST ${LM_STUDIO}/api/v1/chat
{
  model: "liquid/lfm2.5-1.2b",
  input: "...",
  previous_response_id: "resp_...",  // chain stateful sessions
  stream: false
}

// OpenAI-compat (stateless, fallback)
POST ${LM_STUDIO}/v1/chat/completions
{
  model: "liquid/lfm2.5-1.2b",
  messages: [...],
  temperature: 0.25,
  max_tokens: 200
}
```

### Two Modes

**Mode A: Jones Epistemic Engine (Exploration)**
- Full system prompt loaded (72 axioms, ~1,457 tokens)
- Stateful session via `previous_response_id` chaining
- First request: 5s (prompt processing), subsequent: 0.4s
- Used for open-ended analysis, substrate postulation
- Triggered by: regime transitions, phase bifurcations, user queries

**Mode B: Geometric Narrator (Operational)**
- Minimal system prompt: "You are the JtechAi IE Manifold briefing engine. Translate geometric invariants into 2-sentence actionable intelligence."
- Receives structured invariant injection: `{regime, gini, mean, pd, trajectory, onset}`
- Fast stateless calls via OpenAI-compat endpoint
- Used for continuous 3D overlay briefings during cycling

### Briefing Triggers

The engine generates a briefing when:
1. Regime changes (phase transition detected)
2. Gini trajectory changes sign (bifurcation)
3. Prime density crosses a threshold boundary
4. Scene cycles (brief summary for each view)
5. User clicks any data point (detail on demand)

### Validation Oracle (Toggle)

When enabled, the LFM2.5 independently assesses the same raw text batch:
- Engine output: `{regime, gini, pd}` from 200-word dictionary
- LLM output: free-form assessment from raw text
- Convergence indicator: rendered in 3D as alignment gauge
- Divergence: proves the dictionary is cheaper AND correct

## 4. Data Pipeline

### Replay Mode (Default)

```javascript
// Load proven dataset
const messages = loadCSV("tests/data/disaster-response/messages.csv");

// Batch and stream through engine
for (let i = 0; i < messages.length; i += BATCH_SIZE) {
  const batch = messages.slice(i, i + BATCH_SIZE);
  const result = crisisTextToSignals(batch, thresholds);
  const gini = computeGini(result.signals);
  const topo = multiScaleGini(signalHistory, scales);

  // Push to 3D renderer
  updateSceneA(topo);
  updateSceneB(result);
  updateSceneC(gini, mean, regime);

  // Trigger LM Studio if regime changed
  if (regimeChanged) requestBriefing(invariants);
}
```

Playback speed: configurable (1x real-time, 10x, 100x, instant)

### Live Mode

```javascript
// Connect to existing proxy
const prices = await fetch("/api/prices");
const feeds = await fetch("/api/feeds");

// Also fetch GDELT (direct REST, no auth)
const gdelt = await fetch(GDELT_DOC_API_URL);

// Prime-extract from feed text
const result = crisisTextToSignals(feedRecords, thresholds);
// ... same pipeline as replay
```

Refresh interval: 2 minutes (matches existing proxy cache)

## 5. Component Structure

```
src/
  ui/
    App.jsx                    (existing — add 3D tab)
    manifold-3d/
      ManifoldViewer.jsx       (main Three.js canvas + scene switcher)
      scenes/
        FiberBundle.jsx        (Scene A)
        SignalPipeline.jsx     (Scene B)
        RegimeLandscape.jsx    (Scene C)
      overlays/
        BriefingOverlay.jsx    (LM Studio text overlay)
        MetricsHUD.jsx         (real-time Gini/PD/regime readout)
        ValidationOracle.jsx   (engine vs LLM comparison)
      hooks/
        useLMStudio.js         (v1 API client + stateful session)
        useGeometricEngine.js  (engine wrapper for 3D data)
        useReplayData.js       (CSV replay with playback control)
      data/
        sceneConfigs.js        (camera positions, colors, timing)
```

## 6. Dependencies

```json
{
  "@react-three/fiber": "^9.0.0",
  "@react-three/drei": "^10.0.0",
  "three": "^0.170.0"
}
```

No other dependencies. The geometric engine is pure JS. LM Studio is HTTP. Design system already exists.

## 7. Design System Integration

- Dark background: `#0a0c10` (matches existing)
- Gold accent: `#d4a843` for STABILITY regime elements
- Red: `#e04040` for CRISIS
- Blue: `#4a8fd4` for VULNERABILITY
- Orange: `#e08840` for OPPORTUNITY
- Typography: DM Sans for HUD overlays, Playfair Display for briefing text
- All 3D elements respect existing DesignSystem.js color palette

## 8. Performance Budget

| Component | CPU Cost | Memory |
|-----------|----------|--------|
| Three.js render (3 scenes) | ~16ms/frame (60fps) | ~50MB GPU |
| Prime extraction (500 msgs) | <1ms | <1MB |
| Gini + topology computation | <0.1ms | negligible |
| LM Studio call (stateful) | 0.4s network | 0 (remote) |
| LM Studio call (first) | 5s network | 0 (remote) |
| Replay CSV in memory | — | ~15MB |

Total: <100MB client-side. The heavy compute (LLM) is on the LM Studio machine.

## 9. Self-Validation Metrics

The visualization proves itself by displaying these objective metrics in real-time:

1. **Geometric invariant pass rate**: X/8 (must stay 100%)
2. **Mean-PD correlation**: r value (must stay positive)
3. **Baseline separation**: Baseline PD vs crisis PD ratio
4. **Cross-domain invariance**: consistency across all 6 domains
5. **LLM convergence rate**: % agreement between engine and LLM assessments

No synthetic data. No hardcoded values. The 3D scenes render what the math computes from real data. If an invariant fails, it shows red. The system is its own proof.

## 10. Success Criteria

- [ ] Three.js renders all 3 scenes at 60fps on dev machine
- [ ] Scenes auto-cycle with smooth transitions
- [ ] Replay mode processes 21K messages with visible topology evolution
- [ ] LM Studio generates briefings on regime transitions (<1s latency)
- [ ] Stateful session maintains context across multiple briefing requests
- [ ] Validation oracle shows engine-LLM convergence
- [ ] All 6 proven domains visualizable in Scene C
- [ ] Live mode connects to existing GDELT/RSS proxy
- [ ] Design system colors and typography consistent
- [ ] Zero synthetic data in any visualization
