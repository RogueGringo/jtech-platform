/**
 * GDELT Adapter — transforms GDELT event data into signals[]
 * for the JtechAi math engine.
 *
 * Input: array of GDELT events (from API or static CSV)
 * Output: { signals[], entropy, primeDensity, dissolutionRate, propagationRate }
 */

const CAMEO_COOPERATION = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const CAMEO_VERBAL_CONFLICT = new Set([10, 11, 12, 13, 14]);
const CAMEO_MATERIAL_CONFLICT = new Set([15, 16, 17]);
const CAMEO_VIOLENCE = new Set([18, 19, 20]);

export function cameoToSeverity(rootCode) {
  if (CAMEO_VIOLENCE.has(rootCode)) return "critical";
  if (CAMEO_MATERIAL_CONFLICT.has(rootCode)) return "high";
  if (CAMEO_VERBAL_CONFLICT.has(rootCode)) return "moderate";
  return "watch";
}

export function cameoToVector(rootCode) {
  // Strict IE Manifold thresholds:
  // Dissolution ONLY on genuine cognitive breakdown events (17-20)
  // Propagation ONLY on active cooperation/reinforcement (01-05)
  // Everything else is transition noise (06-16)
  if (rootCode >= 17) return "dissolution";
  if (rootCode <= 5) return "propagation";
  return "transition";
}

/**
 * Shannon entropy over CAMEO root code distribution.
 * Low S = events concentrated on few codes = prime regression.
 */
export function computeEventEntropy(events) {
  if (events.length === 0) return 0;
  const codeCounts = {};
  for (const e of events) {
    const root = e.cameoRoot || Math.floor(e.EventRootCode || 0);
    codeCounts[root] = (codeCounts[root] || 0) + 1;
  }
  const total = events.length;
  let S = 0;
  for (const count of Object.values(codeCounts)) {
    const p = count / total;
    if (p > 0) S -= p * Math.log2(p);
  }
  return S;
}

/**
 * Prime density: % of events at CAMEO 17+ (coerce + assault + fight + mass violence).
 * Strict threshold — only genuine cognitive breakdown events count as primes.
 */
export function computePrimeDensity(events) {
  if (events.length === 0) return 0;
  const primeCount = events.filter(e => {
    const root = e.cameoRoot || Math.floor(e.EventRootCode || 0);
    return root >= 17;
  }).length;
  return primeCount / events.length;
}

/**
 * Transform a batch of GDELT events into signals[] for the math engine.
 */
export function gdeltToSignals(events, thresholds) {
  if (events.length === 0) {
    return { signals: [], entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0, eventCount: 0 };
  }

  const goldsteinValues = events.map(e => e.GoldsteinScale).filter(v => v !== null && v !== undefined);
  const toneValues = events.map(e => e.AvgTone).filter(v => v !== null && v !== undefined);

  const avgGoldstein = goldsteinValues.length > 0
    ? goldsteinValues.reduce((a, b) => a + b, 0) / goldsteinValues.length : 0;
  const avgTone = toneValues.length > 0
    ? toneValues.reduce((a, b) => a + b, 0) / toneValues.length : 0;

  const vectors = events.map(e => cameoToVector(e.cameoRoot || Math.floor(e.EventRootCode || 0)));
  const dissCount = vectors.filter(v => v === "dissolution").length;
  const propCount = vectors.filter(v => v === "propagation").length;

  const conflictCount = events.filter(e => {
    const root = e.cameoRoot || Math.floor(e.EventRootCode || 0);
    return root >= 10;
  }).length;
  const conflictRatio = (conflictCount / events.length) * 100;

  const sources = new Set(events.map(e => e.SOURCEURL || e.source || "unknown"));
  const sourceConcentration = Math.round((1 - Math.min(sources.size / events.length, 1)) * 100);

  const goldsteinInv = 6.0 - avgGoldstein;
  const toneInv = Math.abs(Math.min(0, avgTone));

  function computeSev(id, value) {
    const levels = thresholds[id];
    if (!levels || value === null || value === undefined) return "watch";
    for (const [level, threshold] of levels) {
      if (value >= threshold) return level;
    }
    return "watch";
  }

  const signals = [
    { id: "gdelt_actor_state", category: "actor_state", severity: computeSev("goldstein_inv", goldsteinInv) },
    { id: "gdelt_info_flow", category: "info_flow", severity: computeSev("event_density", events.length) },
    { id: "gdelt_conflict_intensity", category: "conflict_intensity", severity: computeSev("conflict_ratio", conflictRatio) },
    { id: "gdelt_actor_capacity", category: "actor_capacity", severity: computeSev("source_concentration", sourceConcentration) },
    { id: "gdelt_event_context", category: "event_context", severity: computeSev("tone_inv", toneInv) },
  ];

  return {
    signals,
    entropy: computeEventEntropy(events),
    primeDensity: computePrimeDensity(events),
    dissolutionRate: dissCount / events.length,
    propagationRate: propCount / events.length,
    eventCount: events.length,
  };
}

export const IE_REGIME_MAP = {
  "STABLE": "STABILITY",
  "TRANSIENT SPIKE": "VULNERABILITY",
  "BOUNDARY LAYER": "OPPORTUNITY",
  "CRISIS CONSOLIDATION": "CRISIS",
};

export const IE_TRAJECTORY_MAP = {
  "ACCELERATING": "LOE WINDOW OPENING",
  "CONSOLIDATING": "MANIFOLD RECEPTIVE",
  "TURBULENT": "NARRATIVE CONTESTED",
  "RESOLVING": "MANIFOLD RE-STABILIZING",
};

export function classifyIERegime(engineLabel) {
  return IE_REGIME_MAP[engineLabel] || engineLabel;
}

export function classifyIETrajectory(engineLabel) {
  return IE_TRAJECTORY_MAP[engineLabel] || engineLabel;
}
