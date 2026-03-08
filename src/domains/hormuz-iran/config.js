// Domain configuration for the Strait of Hormuz / Iran crisis intelligence brief.
// All domain-specific data extracted from the monolithic App.jsx and DataService.jsx.

export default {
  id: "hormuz-iran",
  name: "Strait of Hormuz Crisis",
  subtitle: "Effects-Based Analysis",

  tabs: [
    { id: "thesis", label: "THE THESIS" },
    { id: "nodes", label: "TRACKING NODES" },
    { id: "patterns", label: "PATTERNS OF LIFE" },
    { id: "playbook", label: "EFFECT CHAINS" },
    { id: "monitor", label: "SIGNAL MONITOR" },
    { id: "feed", label: "LIVE FEED" },
  ],

  signals: [
    { id: "pni", category: "kernel", name: "P&I Club Coverage", value: "3/12 active", numeric: 3, unit: "/12", severity: "critical", trend: "stable", source: "IGPANDI.org — Mar 3, 2026" },
    { id: "warrisk", category: "kernel", name: "War Risk Premium", value: "Unquotable", numeric: null, unit: "", severity: "critical", trend: "stable", source: "Lloyd's Market — Mar 3, 2026" },
    { id: "reinsure", category: "kernel", name: "Reinsurance Market", value: "Suspended", numeric: null, unit: "", severity: "critical", trend: "stable", source: "Munich Re / Swiss Re — Mar 3, 2026" },
    { id: "ais", category: "physical", name: "Tanker AIS Transits", value: "0", numeric: 0, unit: "/day", severity: "critical", trend: "down", source: "MarineTraffic — Mar 2, 2026" },
    { id: "stranded", category: "physical", name: "Stranded Vessels", value: "150+", numeric: 150, unit: "", severity: "high", trend: "up", source: "Lloyd's List — Mar 2, 2026" },
    { id: "bypass", category: "physical", name: "Bypass Pipeline Util.", value: "~50%", numeric: 50, unit: "%", severity: "moderate", trend: "up", source: "Estimated — East-West + ADCOP capacity" },
    { id: "vlcc", category: "physical", name: "VLCC Spot Rate", value: ">$200K", numeric: 200000, unit: "/day", severity: "critical", trend: "up", source: "Feedback report — Mar 2, 2026" },
    { id: "spr", category: "physical", name: "SPR Status", value: "~400M bbl (56%)", numeric: 400, unit: "M bbl", severity: "high", trend: "stable", source: "EIA — Feb 2026" },
    { id: "brent", category: "price", name: "Brent Front-Month", value: "—", numeric: null, unit: "/bbl", severity: "moderate", trend: "stable", source: "live" },
    { id: "wti", category: "price", name: "WTI Cushing", value: "—", numeric: null, unit: "/bbl", severity: "moderate", trend: "stable", source: "live" },
    { id: "spread", category: "price", name: "Brent-WTI Spread", value: "—", numeric: null, unit: "", severity: "moderate", trend: "stable", source: "live" },
    { id: "ovx", category: "price", name: "OVX (Vol Index)", value: "—", numeric: null, unit: "", severity: "moderate", trend: "stable", source: "live" },
    { id: "kcposted", category: "price", name: "Kansas Common Posted", value: "—", numeric: null, unit: "/bbl", severity: "moderate", trend: "stable", source: "live" },
    { id: "rigs", category: "domestic", name: "Baker Hughes Rig Count", value: "397", numeric: 397, unit: " rigs", severity: "moderate", trend: "down", source: "Baker Hughes — Feb 2026" },
    { id: "duc", category: "domestic", name: "DUC Inventory", value: "878", numeric: 878, unit: "", severity: "high", trend: "down", source: "EIA DPR — Feb 2026" },
    { id: "production", category: "domestic", name: "US Production", value: "13.5M", numeric: 13.5, unit: "M bpd", severity: "moderate", trend: "down", source: "EIA STEO — Feb 2026" },
    { id: "iranprod", category: "geopolitical", name: "Iran Production", value: "~100K", numeric: 0.1, unit: "M bpd", severity: "critical", trend: "down", source: "Feedback report — Mar 2026" },
    { id: "opecspare", category: "geopolitical", name: "OPEC+ Spare (True)", value: "1.5-2.5M", numeric: 2.0, unit: "M bpd", severity: "high", trend: "stable", source: "Energy Aspects / Rapidan" },
    { id: "georisk", category: "geopolitical", name: "Geo Risk Premium", value: "$7-9", numeric: 8, unit: "/bbl", severity: "high", trend: "up", source: "Reuters poll / Morgan Stanley — Feb 2026" },
    { id: "proxyactive", category: "geopolitical", name: "Proxy Network Status", value: "Active", numeric: null, unit: "", severity: "critical", trend: "up", source: "OSINT — Mar 2, 2026" },
  ],

  livePriceIds: ["brent", "wti", "ovx", "spread", "kcposted"],

  severityThresholds: {
    stranded: [["critical", 180], ["high", 140], ["moderate", 100]],
    bypass:   [["critical", 85],  ["high", 70],  ["moderate", 50]],
    vlcc:     [["critical", 350000], ["high", 250000], ["moderate", 150000]],
    brent:    [["critical", 95],  ["high", 80],  ["moderate", 70]],
    wti:      [["critical", 85],  ["high", 78],  ["moderate", 70]],
    spread:   [["critical", 10],  ["high", 7],   ["moderate", 4]],
    ovx:      [["critical", 60],  ["high", 40],  ["moderate", 25]],
    kcposted: [["critical", 80],  ["high", 72],  ["moderate", 60]],
    georisk:  [["critical", 20],  ["high", 7],   ["moderate", 4]],
  },

  categories: {
    kernel: { label: "KERNEL CONDITION", color: "red" },
    physical: { label: "PHYSICAL FLOWS", color: "orange" },
    price: { label: "PRICE ARCHITECTURE", color: "blue" },
    domestic: { label: "DOMESTIC SUPPLY", color: "purple" },
    geopolitical: { label: "GEOPOLITICAL STATE", color: "gold" },
  },

  effectKeywords: [
    "transit", "ais", "insurance", "p&i", "coverage", "vlcc", "freight",
    "force majeure", "spr", "drawdown", "rig count", "duc", "backwardation",
    "pipeline", "bpd", "production", "inventory", "withdrawn", "suspended",
    "collapsed", "stranded", "utilization", "capacity", "barrels", "tanker",
    "vessel", "rates", "premium", "reinsurance", "spread", "curve", "netback",
    "breakeven", "measured", "tonnage", "loading", "discharge",
    "shut-in", "flaring", "refinery", "throughput", "storage",
    "exports", "imports", "shipments", "cargo", "demurrage", "charter",
    "strait", "hormuz", "closure", "blockade",
    "sanctions", "embargo", "quota", "allocation",
    "million barrels", "bbl", "per day", "daily",
    "assassination", "regime change", "succession", "decapitation",
    "kharg island", "ras tanura", "enriched uranium", "breakout time",
    "shadow fleet", "ship-to-ship", "fiscal breakeven",
    "houthi", "red sea", "suez canal", "proxy", "retaliation", "strike",
    "drone attack", "missile", "carrier strike group",
    "spare capacity", "contango", "ovx", "volatility regime",
    "depleted", "decline rate", "tier 1 inventory",
    "lng", "liquefied natural gas",
    "lateral", "proppant", "ip-24", "eur", "frac",
    "pearsall", "utica", "eagle ford", "permian",
    "completions", "wellhead", "net revenue interest",
    "fujairah", "east-west pipeline", "adcop", "bypass",
  ],

  eventKeywords: [
    "announced", "predicted", "analysts say", "expected", "could", "might",
    "sources say", "reportedly", "sentiment", "fears", "hopes", "rally",
    "tumble", "surge", "plunge", "breaking", "rumor", "speculation",
    "believes", "opinion", "according to", "may", "possibly", "likely",
    "forecast", "projected", "risk of", "warns", "caution", "concerned",
    "worried", "optimistic", "pessimistic", "bullish", "bearish", "mood",
    "says", "thinks", "suggests", "imagine", "if",
    "scenario", "probability", "estimate", "baseline", "target price",
    "outlook", "consensus", "uncertainty", "speculative",
  ],

  chainTerms: {
    "Maritime Insurance Cascade": ["insurance", "p&i", "coverage", "withdrawn", "reinsurance", "premium", "hull", "war risk", "club", "lloyd", "demurrage", "force majeure"],
    "Physical Flow Cascade": ["transit", "ais", "tanker", "vessel", "stranded", "vlcc", "freight", "pipeline", "tonnage", "loading", "cargo", "draft", "hormuz", "strait", "shipping", "blockade", "fujairah", "bypass", "east-west", "adcop", "suez", "red sea", "reroute"],
    "Price Architecture Cascade": ["brent", "wti", "spread", "backwardation", "curve", "netback", "breakeven", "ovx", "futures", "contango", "oil price", "crude price", "barrel", "volatility regime", "garch", "risk premium", "forward curve"],
    "Supply Constraint Cascade": ["rig count", "duc", "production", "bpd", "capacity", "frac", "drilling", "completions", "shut-in", "spr", "reserve", "opec", "output", "spare capacity", "decline rate", "lateral", "proppant", "shale", "permian", "tier 1"],
    "Geopolitical Escalation Cascade": ["assassination", "regime change", "succession", "irgc", "proxy", "houthi", "hezbollah", "retaliation", "strike", "nuclear", "enriched", "breakout", "khamenei", "sanctions", "carrier", "drone attack", "missile", "kharg", "ras tanura"],
  },

  feedSources: [
    {
      id: "google-hormuz",
      name: "Google News — Hormuz",
      url: "https://news.google.com/rss/search?q=strait+of+hormuz+oil+tanker&hl=en-US&gl=US&ceid=US:en",
      category: "maritime",
      priority: 1,
    },
    {
      id: "google-iran-oil",
      name: "Google News — Iran Oil",
      url: "https://news.google.com/rss/search?q=iran+oil+sanctions+energy&hl=en-US&gl=US&ceid=US:en",
      category: "macro",
      priority: 1,
    },
    {
      id: "google-crude-oil",
      name: "Google News — Crude Oil",
      url: "https://news.google.com/rss/search?q=crude+oil+brent+wti+price&hl=en-US&gl=US&ceid=US:en",
      category: "price",
      priority: 1,
    },
    {
      id: "google-tanker-shipping",
      name: "Google News — Tanker Shipping",
      url: "https://news.google.com/rss/search?q=tanker+shipping+VLCC+freight+rates&hl=en-US&gl=US&ceid=US:en",
      category: "maritime",
      priority: 2,
    },
    {
      id: "google-oil-supply",
      name: "Google News — Oil Supply",
      url: "https://news.google.com/rss/search?q=oil+production+rig+count+EIA+SPR&hl=en-US&gl=US&ceid=US:en",
      category: "supply",
      priority: 2,
    },
    {
      id: "eia-twip",
      name: "EIA — This Week in Petroleum",
      url: "https://www.eia.gov/petroleum/weekly/includes/twip_rss.xml",
      category: "supply",
      priority: 2,
    },
    {
      id: "gcaptain",
      name: "gCaptain — Maritime News",
      url: "https://gcaptain.com/feed/",
      category: "maritime",
      priority: 2,
    },
    {
      id: "maritime-exec",
      name: "The Maritime Executive",
      url: "https://maritime-executive.com/rss",
      category: "maritime",
      priority: 3,
    },
    {
      id: "oilprice",
      name: "OilPrice.com",
      url: "https://oilprice.com/rss/main",
      category: "price",
      priority: 3,
    },
  ],

  priceSymbols: { brent: "BZ=F", wti: "CL=F", ovx: "^OVX" },

  derivedPrices: {
    spread: (prices) => prices.brent && prices.wti ? +(prices.brent.price - prices.wti.price).toFixed(2) : null,
    kcposted: (prices) => prices.wti ? +(prices.wti.price - 13.25).toFixed(2) : null,
  },

  phases: [
    {
      id: "baseline",
      name: "Baseline Operations",
      description: "Normal maritime commerce, full insurance coverage, standard pricing",
      requiredSignals: [],
      color: "green",
    },
    {
      id: "elevated",
      name: "Elevated Tension",
      description: "Insurance tightening, geopolitical risk premiums rising, proxy activity increasing",
      requiredSignals: [
        { signalId: "georisk", minSeverity: "moderate" },
        { signalId: "proxyactive", minSeverity: "high" },
      ],
      color: "orange",
    },
    {
      id: "boundary",
      name: "Boundary Layer",
      description: "Insurance partially withdrawn, transit volumes declining, volatility spiking",
      requiredSignals: [
        { signalId: "pni", minSeverity: "moderate" },
        { signalId: "ovx", minSeverity: "moderate" },
        { signalId: "georisk", minSeverity: "high" },
      ],
      color: "orange",
    },
    {
      id: "crisis",
      name: "Phase Transition — Crisis",
      description: "Insurance withdrawn, transit collapsed, price regime discontinuity, supply emergency",
      requiredSignals: [
        { signalId: "pni", minSeverity: "critical" },
        { signalId: "ais", minSeverity: "critical" },
        { signalId: "brent", minSeverity: "high" },
      ],
      color: "red",
    },
  ],

  chainSignalMap: {
    "Maritime Insurance Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "pni", activeWhen: "critical" },
        { chainIndex: 1, signalId: "warrisk", activeWhen: "critical" },
        { chainIndex: 2, signalId: "reinsure", activeWhen: "critical" },
      ],
    },
    "Physical Flow Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "ais", activeWhen: "critical" },
        { chainIndex: 1, signalId: "stranded", activeWhen: "high" },
        { chainIndex: 2, signalId: "vlcc", activeWhen: "high" },
        { chainIndex: 3, signalId: "bypass", activeWhen: "moderate" },
      ],
    },
    "Price Architecture Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "brent", activeWhen: "high" },
        { chainIndex: 1, signalId: "wti", activeWhen: "high" },
        { chainIndex: 2, signalId: "spread", activeWhen: "moderate" },
        { chainIndex: 3, signalId: "ovx", activeWhen: "high" },
      ],
    },
    "Supply Constraint Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "spr", activeWhen: "high" },
        { chainIndex: 1, signalId: "rigs", activeWhen: "moderate" },
        { chainIndex: 2, signalId: "duc", activeWhen: "high" },
        { chainIndex: 3, signalId: "production", activeWhen: "moderate" },
      ],
    },
    "Geopolitical Escalation Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "iranprod", activeWhen: "critical" },
        { chainIndex: 1, signalId: "georisk", activeWhen: "high" },
        { chainIndex: 2, signalId: "opecspare", activeWhen: "high" },
        { chainIndex: 3, signalId: "proxyactive", activeWhen: "critical" },
      ],
    },
  },

  verifySources: {
    thesis: [
      { label: "MarineTraffic — Strait of Hormuz", url: "https://www.marinetraffic.com/en/ais/home/centerx/56.3/centery/26.6/zoom/9" },
      { label: "International Group of P&I Clubs", url: "https://www.igpandi.org/" },
      { label: "EIA Short-Term Energy Outlook", url: "https://www.eia.gov/outlooks/steo/" },
    ],
    nodes: [
      { label: "MarineTraffic — Live AIS Map", url: "https://www.marinetraffic.com/en/ais/home/centerx/56.3/centery/26.6/zoom/9" },
      { label: "International Group of P&I Clubs", url: "https://www.igpandi.org/" },
      { label: "Baker Hughes Rig Count", url: "https://rigcount.bakerhughes.com/" },
      { label: "EIA Petroleum Data", url: "https://www.eia.gov/petroleum/data.php" },
    ],
    patterns: [
      { label: "MarineTraffic — Hormuz AIS", url: "https://www.marinetraffic.com/en/ais/home/centerx/56.3/centery/26.6/zoom/9" },
      { label: "Lloyd's List Intelligence", url: "https://www.lloydslistintelligence.com/" },
    ],
    playbook: [
      { label: "EIA Weekly Petroleum Status", url: "https://www.eia.gov/petroleum/supply/weekly/" },
      { label: "CME Group — NYMEX Crude", url: "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html" },
      { label: "CBOE — OVX (Oil Vol Index)", url: "https://www.cboe.com/tradable_products/vix/ovx/" },
    ],
    monitor: [
      { label: "Yahoo Finance — Brent (BZ=F)", url: "https://finance.yahoo.com/quote/BZ=F/" },
      { label: "Yahoo Finance — WTI (CL=F)", url: "https://finance.yahoo.com/quote/CL=F/" },
      { label: "CBOE — OVX", url: "https://www.cboe.com/tradable_products/vix/ovx/" },
      { label: "Baker Hughes Rig Count", url: "https://rigcount.bakerhughes.com/" },
    ],
  },
};
