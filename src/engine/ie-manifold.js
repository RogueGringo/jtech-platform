/**
 * IE Manifold Overlay — maps math engine output to Information Environment labels.
 * Computes cross-panel coherence (conviction signal / COG detection).
 */

export const IE_REGIMES = {
  STABILITY: { label: "STABILITY", description: "Narrative intact, no influence window", color: "#22c55e" },
  VULNERABILITY: { label: "VULNERABILITY", description: "Localized prime regression, narrative gap forming", color: "#f59e0b" },
  OPPORTUNITY: { label: "OPPORTUNITY", description: "Manifold unlocking, competing primes, max influence potential", color: "#ef4444" },
  CRISIS: { label: "CRISIS", description: "Full prime regression, TA in reactive state", color: "#dc2626" },
};

export const IE_TRAJECTORIES = {
  "LOE WINDOW OPENING": { label: "LOE WINDOW OPENING", description: "Dissolution accelerating", color: "#ef4444" },
  "MANIFOLD RECEPTIVE": { label: "MANIFOLD RECEPTIVE", description: "TA locked on crisis primes", color: "#f59e0b" },
  "NARRATIVE CONTESTED": { label: "NARRATIVE CONTESTED", description: "Competing attractors", color: "#8b5cf6" },
  "MANIFOLD RE-STABILIZING": { label: "MANIFOLD RE-STABILIZING", description: "New narrative crystallizing", color: "#22c55e" },
};

const ENGINE_TO_IE = {
  "STABLE": "STABILITY",
  "TRANSIENT SPIKE": "VULNERABILITY",
  "BOUNDARY LAYER": "OPPORTUNITY",
  "CRISIS CONSOLIDATION": "CRISIS",
};

const ENGINE_TRAJ_TO_IE = {
  "ACCELERATING": "LOE WINDOW OPENING",
  "CONSOLIDATING": "MANIFOLD RECEPTIVE",
  "TURBULENT": "NARRATIVE CONTESTED",
  "RESOLVING": "MANIFOLD RE-STABILIZING",
};

export function toIERegime(engineLabel) {
  return ENGINE_TO_IE[engineLabel] || engineLabel;
}

export function toIETrajectory(engineLabel) {
  return ENGINE_TRAJ_TO_IE[engineLabel] || engineLabel;
}

/**
 * Cross-panel coherence: agreement across multiple panel outputs.
 * If all panels agree on regime, coherence = 1.0 (COG detected).
 *
 * @param {Object[]} panels - [{ name, mean, gini, regime, ieRegime }]
 * @returns {Object} { coherence, cogDetected, leadingPanel, divergences }
 */
export function crossPanelCoherence(panels) {
  if (panels.length === 0) return { coherence: 0, cogDetected: false, leadingPanel: null, divergences: [] };

  const regimes = panels.map(p => p.ieRegime);
  const uniqueRegimes = new Set(regimes);
  const regimeCoherence = 1 - (uniqueRegimes.size - 1) / Math.max(panels.length - 1, 1);

  const means = panels.map(p => p.mean);
  const meanOfMeans = means.reduce((a, b) => a + b, 0) / means.length;
  const meanVariance = means.reduce((s, m) => s + (m - meanOfMeans) ** 2, 0) / means.length;
  const meanCoherence = 1 - Math.min(Math.sqrt(meanVariance) / 2, 1);

  const coherence = (regimeCoherence + meanCoherence) / 2;
  const cogDetected = uniqueRegimes.size === 1 && coherence > 0.8;

  const leadingPanel = panels.reduce((best, p) => p.mean > best.mean ? p : best);

  const divergences = [];
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (panels[i].ieRegime !== panels[j].ieRegime) {
        divergences.push({
          panel1: panels[i].name, panel2: panels[j].name,
          regime1: panels[i].ieRegime, regime2: panels[j].ieRegime,
        });
      }
    }
  }

  return { coherence, cogDetected, leadingPanel: leadingPanel.name, divergences };
}
