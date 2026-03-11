export default {
  id: "gfc-2008",
  name: "2008 Global Financial Crisis",
  subtitle: "Credit Contagion Cascade",

  primeMapping: {
    credit: "condition",
    liquidity: "flow",
    asset_prices: "price",
    reserves: "capacity",
    regulatory: "context",
  },

  categories: {
    credit: { label: "CREDIT CONDITION", color: "red" },
    liquidity: { label: "LIQUIDITY FLOWS", color: "orange" },
    asset_prices: { label: "ASSET PRICES", color: "blue" },
    reserves: { label: "RESERVE CAPACITY", color: "purple" },
    regulatory: { label: "REGULATORY CONTEXT", color: "gold" },
  },

  severityThresholds: {
    vix:       [["critical", 60], ["high", 40], ["moderate", 25]],
    ted:       [["critical", 3.0], ["high", 1.5], ["moderate", 0.5]],
    hy_spread: [["critical", 1500], ["high", 800], ["moderate", 400]],
    fed_funds_inv: [["critical", 0.5], ["high", 1.0], ["moderate", 2.0]],
  },
};
