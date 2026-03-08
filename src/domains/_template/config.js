// Domain Configuration Template
// Copy this folder to src/domains/your-domain/ and fill in your data.
// See src/domains/hormuz-iran/ for a complete example.

export default {
  id: "my-domain",
  name: "Domain Name",
  subtitle: "Brief description",

  // Map domain categories to universal semantic primes:
  //   condition — state of core system (ACTORS + STATE)
  //   flow      — movement of primary resource (ACTION + INSTRUMENTS)
  //   price     — market valuation signals (MAGNITUDE + INSTRUMENTS)
  //   capacity  — available reserves/ability (MAGNITUDE + STATE)
  //   context   — external environment (CAUSE + ACTORS)
  primeMapping: {
    // my_category_1: "condition",
    // my_category_2: "flow",
    // my_category_3: "price",
    // my_category_4: "capacity",
    // my_category_5: "context",
  },

  tabs: [
    { id: "thesis", label: "THE THESIS" },
    { id: "nodes", label: "TRACKING NODES" },
    { id: "patterns", label: "PATTERNS OF LIFE" },
    { id: "playbook", label: "EFFECT CHAINS" },
    { id: "monitor", label: "SIGNAL MONITOR" },
    { id: "feed", label: "LIVE FEED" },
  ],

  signals: [],
  livePriceIds: [],
  severityThresholds: {},
  categories: {},
  effectKeywords: [],
  eventKeywords: [],
  chainTerms: {},
  feedSources: [],
  priceSymbols: {},
  derivedPrices: {},
  verifySources: {},
};
