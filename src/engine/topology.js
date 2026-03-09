/**
 * Topological Evolution Layer — Jones Framework Integration
 *
 * Implements multi-scale Gini trajectory tracking and topological waypoint
 * detection, formalizing the JtechAi math engine in the language of
 * Adaptive Topological Field Theory (Jones, 2026).
 *
 * Key isomorphism:
 *   Jones' Gini curve G(ε)     ↔  JtechAi Gini at multiple temporal scales
 *   Topological waypoints       ↔  Regime transitions (STABLE → CRISIS)
 *   Persistence (d_i - b_i)     ↔  Prime density / conviction signal
 *   Feature map φ               ↔  Adapter (GDELT/CrisisFACTS → signals[])
 *   Sheaf fibers                ↔  Universal categories (condition, flow, price, capacity, context)
 *   2D Betti curve (ε, β₁)     ↔  2D regime space (mean, Gini)
 *
 * "Topology at multiple scales is more fundamental than geometry at a single scale."
 *   — Jones, Adaptive TFT §10
 */

import { SEVERITY_RANK } from "../../tests/lib/backtest-engine.js";

// ================================================================
// MULTI-SCALE GINI TRAJECTORY
// ================================================================

/**
 * Compute Gini coefficient from an array of severity ranks.
 */
function giniFromRanks(ranks) {
  const n = ranks.length;
  if (n === 0) return 0;
  const mean = ranks.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sum += Math.abs(ranks[i] - ranks[j]);
    }
  }
  return sum / (2 * n * n * mean);
}

/**
 * Compute mean severity from an array of ranks.
 */
function meanFromRanks(ranks) {
  if (ranks.length === 0) return 0;
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

/**
 * Multi-scale Gini trajectory — the core Jones integration.
 *
 * Instead of computing Gini at a single scale (one batch), we compute
 * it across multiple temporal windows (scales). The trajectory of
 * Gini across scales IS the topological evolution curve.
 *
 * Jones §2.2: "The Gini trajectory — how G(ε) evolves across scales —
 * is the strongest predictor of reasoning quality in neural networks."
 *
 * For crisis detection: positive trajectory (hierarchicalization) means
 * one dominant signal is emerging = COG forming.
 * Negative trajectory (flattening) means chaos, no clear center of gravity.
 *
 * @param {Object[][]} signalHistory - Array of signal snapshots over time
 * @param {number[]} scales - Window sizes to compute Gini at (e.g., [1, 3, 7, 14, 30])
 * @returns {Object} { giniCurve, trajectory, onset, waypoints, derivative }
 */
export function multiScaleGini(signalHistory, scales = [1, 3, 7, 14, 30]) {
  if (signalHistory.length === 0) {
    return { giniCurve: [], trajectory: 0, onset: null, waypoints: [], derivative: [] };
  }

  const giniCurve = [];

  for (const scale of scales) {
    if (signalHistory.length < scale) {
      giniCurve.push({ scale, gini: null, mean: null });
      continue;
    }

    // Aggregate signals across the window
    const window = signalHistory.slice(-scale);
    const allRanks = [];
    for (const snapshot of window) {
      for (const s of snapshot) {
        allRanks.push(SEVERITY_RANK[s.severity] || 1);
      }
    }

    giniCurve.push({
      scale,
      gini: giniFromRanks(allRanks),
      mean: meanFromRanks(allRanks),
    });
  }

  // Compute trajectory: slope of Gini across valid scales
  const validPoints = giniCurve.filter(p => p.gini !== null);
  let trajectory = 0;
  if (validPoints.length >= 2) {
    const first = validPoints[0];
    const last = validPoints[validPoints.length - 1];
    trajectory = last.gini - first.gini;
  }

  // Topological derivative: rate of change between adjacent scales
  // Jones §2.4: δ(ε) = dβ/dε — sharp inflections = phase transitions
  const derivative = [];
  for (let i = 1; i < validPoints.length; i++) {
    const dGini = validPoints[i].gini - validPoints[i - 1].gini;
    const dScale = validPoints[i].scale - validPoints[i - 1].scale;
    derivative.push({
      fromScale: validPoints[i - 1].scale,
      toScale: validPoints[i].scale,
      dGini,
      rate: dScale > 0 ? dGini / dScale : 0,
    });
  }

  // Onset scale: the smallest scale at which Gini exceeds threshold
  // Jones §2.6: ε* = inf{ε : β_k(ε) > 0}
  // For us: the smallest temporal window where hierarchy appears
  const GINI_ONSET_THRESHOLD = 0.15;
  const onsetPoint = validPoints.find(p => p.gini >= GINI_ONSET_THRESHOLD);
  const onset = onsetPoint ? onsetPoint.scale : null;

  // Topological waypoints: scales where derivative changes sign or magnitude spikes
  // Jones §4.1: "special scales with critical points, inflections, bifurcations"
  const waypoints = [];
  for (let i = 1; i < derivative.length; i++) {
    const prev = derivative[i - 1];
    const curr = derivative[i];
    // Sign change = bifurcation
    if ((prev.rate > 0 && curr.rate < 0) || (prev.rate < 0 && curr.rate > 0)) {
      waypoints.push({
        scale: curr.fromScale,
        type: "BIFURCATION",
        magnitude: Math.abs(curr.rate - prev.rate),
      });
    }
    // Large magnitude = sharp transition
    if (Math.abs(curr.rate) > 0.02) {
      waypoints.push({
        scale: curr.fromScale,
        type: curr.rate > 0 ? "DISPERSING" : "CONCENTRATING",
        magnitude: Math.abs(curr.rate),
      });
    }
  }

  return { giniCurve, trajectory, onset, waypoints, derivative };
}

// ================================================================
// WAYPOINT SIGNATURE
// ================================================================

/**
 * Compute the waypoint signature for a signal history.
 *
 * Jones §4.2: W(C) = (ε*, {ε_w,i}, {δ(ε_w,i)}, G(ε*), dG/dε|ε*)
 *
 * For the IE Manifold, this is the finite-dimensional vector that
 * captures the essential topological content of a crisis evolution.
 *
 * @param {Object[][]} signalHistory - Full signal history
 * @param {number[]} scales - Multi-scale windows
 * @returns {Object} Waypoint signature
 */
export function waypointSignature(signalHistory, scales) {
  const topo = multiScaleGini(signalHistory, scales);

  const onsetGini = topo.onset !== null
    ? (topo.giniCurve.find(p => p.scale === topo.onset)?.gini || 0)
    : 0;

  const onsetDerivative = topo.onset !== null && topo.derivative.length > 0
    ? topo.derivative[0].rate
    : 0;

  return {
    onsetScale: topo.onset,
    waypointScales: topo.waypoints.map(w => w.scale),
    waypointDerivatives: topo.waypoints.map(w => w.magnitude),
    giniAtOnset: onsetGini,
    giniTrajectoryAtOnset: onsetDerivative,
    // Full trajectory for comparison
    trajectory: topo.trajectory,
    giniCurve: topo.giniCurve,
    waypoints: topo.waypoints,
  };
}

// ================================================================
// PERSISTENCE — Feature lifetime across batches
// ================================================================

/**
 * Compute feature persistence across a signal history.
 *
 * Jones §1.2: persistence p_i = d_i - b_i measures feature lifetime.
 * For crisis signals: how many consecutive batches does a signal
 * stay at a given severity before dropping?
 *
 * Long persistence = robust physical structure (real crisis).
 * Short persistence = noise or transient event.
 *
 * @param {Object[][]} signalHistory - Signal snapshots over time
 * @returns {Object} { features, totalPersistence, maxPersistence }
 */
export function computePersistence(signalHistory) {
  if (signalHistory.length === 0) {
    return { features: [], totalPersistence: 0, maxPersistence: 0 };
  }

  // Track birth/death of severity states per signal ID
  const active = new Map(); // signalId → { severity, birthIndex }
  const features = [];

  for (let t = 0; t < signalHistory.length; t++) {
    const currentIds = new Set();

    for (const signal of signalHistory[t]) {
      const key = `${signal.id}:${signal.severity}`;
      currentIds.add(key);

      if (!active.has(key)) {
        // Birth: new feature appears
        active.set(key, { severity: signal.severity, signalId: signal.id, birthIndex: t });
      }
    }

    // Check for deaths: features that were active but aren't in current snapshot
    for (const [key, feature] of active) {
      if (!currentIds.has(key)) {
        const persistence = t - feature.birthIndex;
        if (persistence > 0) {
          features.push({
            signalId: feature.signalId,
            severity: feature.severity,
            birth: feature.birthIndex,
            death: t,
            persistence,
          });
        }
        active.delete(key);
      }
    }
  }

  // Close remaining active features
  for (const [key, feature] of active) {
    const persistence = signalHistory.length - feature.birthIndex;
    features.push({
      signalId: feature.signalId,
      severity: feature.severity,
      birth: feature.birthIndex,
      death: signalHistory.length,
      persistence,
    });
  }

  const totalPersistence = features.reduce((s, f) => s + f.persistence, 0);
  const maxPersistence = features.length > 0
    ? Math.max(...features.map(f => f.persistence))
    : 0;

  return { features, totalPersistence, maxPersistence };
}

// ================================================================
// TOPOLOGICAL PHASE DETECTION
// ================================================================

/**
 * Detect topological phase transitions in a signal history.
 *
 * Jones §6.1: Phase transitions manifest as discontinuities
 * in the onset scale as a control parameter crosses a critical value.
 *
 * For crisis detection: the "control parameter" is time.
 * A phase transition occurs when:
 *   1. Gini trajectory changes sign (Jones: Gini curve inflection)
 *   2. Mean crosses a regime boundary (Jones: onset scale discontinuity)
 *   3. Dissolution rate spikes (Jones: topological derivative peak)
 *
 * @param {Object[]} results - Array of { mean, gini, regime, ... } from backtest
 * @returns {Object[]} Array of detected phase transitions
 */
export function detectPhaseTransitions(results) {
  const transitions = [];

  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];

    // Regime change = waypoint
    if (prev.regime !== curr.regime) {
      transitions.push({
        index: i,
        date: curr.date,
        from: prev.regime,
        to: curr.regime,
        type: "REGIME_CHANGE",
        // Topological derivative at transition point
        dMean: curr.mean - prev.mean,
        dGini: curr.gini - prev.gini,
      });
    }
  }

  return transitions;
}

// ================================================================
// FIBER BUNDLE SUMMARY
// ================================================================

/**
 * Compute the fiber bundle summary for a complete crisis timeline.
 *
 * Jones §7.2:
 *   Base space = filtration parameter ε (for us: time)
 *   Fiber = sheaf cohomology at scale ε (for us: (mean, Gini, coherence) tuple)
 *   Connection = persistent homology maps (for us: Gini trajectory between windows)
 *
 * @param {Object[]} results - Full backtest results
 * @param {Object[][]} signalHistory - Full signal history
 * @returns {Object} Complete topological summary
 */
export function fiberBundleSummary(results, signalHistory) {
  const phases = detectPhaseTransitions(results);
  const persistence = computePersistence(signalHistory);
  const signature = waypointSignature(signalHistory);
  const scales = [1, 3, 7, 14, 30].filter(s => s <= signalHistory.length);
  const multiScale = multiScaleGini(signalHistory, scales);

  // Jones §5.2: "The most compressed faithful representation is a 2D curve"
  // Our 2D curve: (mean(t), Gini(t)) over time
  const evolutionCurve = results.map(r => ({
    date: r.date,
    mean: r.mean,
    gini: r.gini,
    regime: r.regime,
  }));

  // Gini trajectory classification (Jones §6.4 / §10)
  // Positive trajectory = hierarchicalization = COG forming
  // Negative trajectory = flattening = dissolution
  const giniValues = results.map(r => r.gini);
  const firstHalf = giniValues.slice(0, Math.floor(giniValues.length / 2));
  const secondHalf = giniValues.slice(Math.floor(giniValues.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
  const giniDirection = secondAvg > firstAvg + 0.01 ? "HIERARCHICALIZING"
    : secondAvg < firstAvg - 0.01 ? "FLATTENING"
    : "STABLE";

  return {
    // Fiber bundle structure
    baseSpace: "time",
    fiberType: "(mean, Gini, coherence)",
    connectionType: "Gini trajectory",

    // Topological summary
    phaseTransitions: phases,
    phaseCount: phases.length,
    persistence,

    // Multi-scale
    multiScaleGini: multiScale,
    waypointSignature: signature,

    // 2D evolution curve (Jones §5.2)
    evolutionCurve,

    // Gini direction (Jones §6.4)
    giniDirection,
    giniSlope: secondAvg - firstAvg,

    // Domain-agnostic invariants
    regimesCovered: [...new Set(results.map(r => r.regime))].length,
    maxMean: Math.max(...results.map(r => r.mean)),
    minGini: Math.min(...results.map(r => r.gini)),
    maxGini: Math.max(...results.map(r => r.gini)),
  };
}
