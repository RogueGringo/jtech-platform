export default {
  id: "svb-2023",
  name: "2023 SVB Bank Run",
  subtitle: "Rapid Phase Transition + BTFP Resolution",

  primeMapping: {
    solvency: "condition",
    deposits: "flow",
    market_prices: "price",
    backstop: "capacity",
    contagion: "context",
  },

  categories: {
    solvency: { label: "SOLVENCY CONDITION", color: "red" },
    deposits: { label: "DEPOSIT FLOWS", color: "orange" },
    market_prices: { label: "MARKET PRICES", color: "blue" },
    backstop: { label: "BACKSTOP CAPACITY", color: "purple" },
    contagion: { label: "CONTAGION CONTEXT", color: "gold" },
  },

  severityThresholds: {
    vix:       [["critical", 40], ["high", 25], ["moderate", 20]],
    hy_spread: [["critical", 600], ["high", 500], ["moderate", 450]],
    // 2Y Treasury crash: inverted — large DROP from peak = higher severity
    dgs2_drop: [["critical", 1.0], ["high", 0.5], ["moderate", 0.2]],
    // Yield curve inversion depth: more negative = more inverted = higher severity
    curve_inv: [["critical", 1.0], ["high", 0.8], ["moderate", 0.6]],
  },
};
