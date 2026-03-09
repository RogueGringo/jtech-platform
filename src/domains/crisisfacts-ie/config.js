export default {
  id: "crisisfacts-ie",
  name: "CrisisFACTS Information Environment",
  subtitle: "Unstructured Text → Semantic Prime Extraction → IE Manifold",

  primeMapping: {
    crisis_condition: "condition",
    info_flow: "flow",
    crisis_intensity: "price",
    response_capacity: "capacity",
    event_context: "context",
  },

  categories: {
    crisis_condition: { label: "CRISIS CONDITION", color: "red" },
    info_flow: { label: "INFORMATION FLOW", color: "orange" },
    crisis_intensity: { label: "CRISIS INTENSITY", color: "blue" },
    response_capacity: { label: "RESPONSE CAPACITY", color: "purple" },
    event_context: { label: "EVENT CONTEXT", color: "gold" },
  },

  severityThresholds: {
    // Prime density thresholds — 37F approved: rare and undeniable
    condition_density: [["critical", 0.15], ["high", 0.08], ["moderate", 0.03]],
    info_density: [["critical", 0.10], ["high", 0.05], ["moderate", 0.02]],
    intensity_density: [["critical", 0.15], ["high", 0.08], ["moderate", 0.03]],
    capacity_density: [["critical", 0.10], ["high", 0.05], ["moderate", 0.02]],
    context_density: [["critical", 0.10], ["high", 0.05], ["moderate", 0.02]],
  },

  ieRegimeMap: {
    "STABLE": "STABILITY",
    "TRANSIENT SPIKE": "VULNERABILITY",
    "BOUNDARY LAYER": "OPPORTUNITY",
    "CRISIS CONSOLIDATION": "CRISIS",
  },

  ieTrajectoryMap: {
    "ACCELERATING": "LOE WINDOW OPENING",
    "CONSOLIDATING": "MANIFOLD RECEPTIVE",
    "TURBULENT": "NARRATIVE CONTESTED",
    "RESOLVING": "MANIFOLD RE-STABILIZING",
  },
};
