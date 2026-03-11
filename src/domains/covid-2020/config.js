export default {
  id: "covid-2020",
  name: "2020 COVID Demand Destruction",
  subtitle: "Pandemic + Oil Price War Cascade",

  primeMapping: {
    demand: "condition",
    supply_chain: "flow",
    energy_prices: "price",
    labor: "capacity",
    policy: "context",
  },

  categories: {
    demand: { label: "DEMAND CONDITION", color: "red" },
    supply_chain: { label: "SUPPLY CHAIN FLOW", color: "orange" },
    energy_prices: { label: "ENERGY PRICES", color: "blue" },
    labor: { label: "LABOR CAPACITY", color: "purple" },
    policy: { label: "POLICY CONTEXT", color: "gold" },
  },

  severityThresholds: {
    brent:  [["critical", 60], ["high", 40], ["moderate", 25]],
    wti:    [["critical", 50], ["high", 30], ["moderate", 20]],
    vix:    [["critical", 60], ["high", 40], ["moderate", 25]],
    icsa:   [["critical", 3000000], ["high", 1000000], ["moderate", 300000]],
  },
};
