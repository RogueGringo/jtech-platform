// Domain Configuration Template
// Copy this folder to src/domains/your-domain/ and fill in your data.
// See src/domains/hormuz-iran/ for a complete example.

export default {
  id: "my-domain",
  name: "Domain Name",
  subtitle: "Brief description",

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
