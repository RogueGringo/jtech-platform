export default {
  id: "gdelt-ie",
  name: "GDELT Information Environment",
  subtitle: "CAMEO Event Stream → IE Manifold",

  primeMapping: {
    actor_state: "condition",
    info_flow: "flow",
    conflict_intensity: "price",
    actor_capacity: "capacity",
    event_context: "context",
  },

  categories: {
    actor_state: { label: "ACTOR STATE", color: "red" },
    info_flow: { label: "INFORMATION FLOW", color: "orange" },
    conflict_intensity: { label: "CONFLICT INTENSITY", color: "blue" },
    actor_capacity: { label: "ACTOR CAPACITY", color: "purple" },
    event_context: { label: "EVENT CONTEXT", color: "gold" },
  },

  severityThresholds: {
    goldstein_inv: [["critical", 14], ["high", 10], ["moderate", 6]],
    tone_inv: [["critical", 8], ["high", 5], ["moderate", 3]],
    event_density: [["critical", 500], ["high", 200], ["moderate", 50]],
    conflict_ratio: [["critical", 70], ["high", 50], ["moderate", 30]],
    source_concentration: [["critical", 90], ["high", 70], ["moderate", 50]],
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
