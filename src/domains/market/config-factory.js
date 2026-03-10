/**
 * Market Domain Config Factory
 *
 * Generates standard domain configs at runtime from ticker metadata.
 * Output shape is identical to src/domains/hormuz-iran/config.js.
 *
 * 12 signals match the market adapter output (src/adapters/market-adapter.js):
 *   condition: mkt_rsi, mkt_macd, mkt_bbpctb
 *   flow:      mkt_volratio, mkt_obvslope, mkt_mfi
 *   price:     mkt_sma50, mkt_sma200, mkt_drawdown
 *   capacity:  mkt_atr, mkt_bbwidth, mkt_adx
 *
 * Severity thresholds are empty — the market adapter uses sigma-based
 * severity at runtime, not hardcoded numeric thresholds.
 */

// ================================================================
// SIGNAL DEFINITIONS — 12 market signals, 4 categories
// ================================================================

const SIGNAL_TEMPLATES = [
  // condition (momentum/oscillator)
  { id: "mkt_rsi",     category: "condition", name: "RSI(14)",              unit: "" },
  { id: "mkt_macd",    category: "condition", name: "MACD Histogram",       unit: "" },
  { id: "mkt_bbpctb",  category: "condition", name: "Bollinger %B",         unit: "" },

  // flow (volume dynamics)
  { id: "mkt_volratio", category: "flow", name: "Volume Ratio (20d)",  unit: "x" },
  { id: "mkt_obvslope", category: "flow", name: "OBV Slope (20d)",     unit: "" },
  { id: "mkt_mfi",      category: "flow", name: "MFI(14)",             unit: "" },

  // price (trend position)
  { id: "mkt_sma50",    category: "price", name: "SMA50 Distance",    unit: "%" },
  { id: "mkt_sma200",   category: "price", name: "SMA200 Distance",   unit: "%" },
  { id: "mkt_drawdown", category: "price", name: "Drawdown (52w)",    unit: "%" },

  // capacity (volatility regime)
  { id: "mkt_atr",     category: "capacity", name: "ATR Percentile (60d)", unit: "" },
  { id: "mkt_bbwidth", category: "capacity", name: "Bollinger Width",      unit: "" },
  { id: "mkt_adx",     category: "capacity", name: "ADX(14)",              unit: "" },
];

// ================================================================
// TABS — market-specific labels
// ================================================================

const MARKET_TABS = [
  { id: "thesis",   label: "REGIME" },
  { id: "nodes",    label: "SIGNALS" },
  { id: "patterns", label: "TOPOLOGY" },
  { id: "playbook", label: "CASCADES" },
  { id: "monitor",  label: "MONITOR" },
  { id: "feed",     label: "SENTIMENT" },
];

// ================================================================
// UNIVERSAL CATEGORIES — semantic prime colors
// ================================================================

const CATEGORIES = {
  condition: { label: "CONDITION", color: "#ef4444" },
  flow:      { label: "FLOW",      color: "#f97316" },
  price:     { label: "PRICE",     color: "#3b82f6" },
  capacity:  { label: "CAPACITY",  color: "#8b5cf6" },
  context:   { label: "CONTEXT",   color: "#eab308" },
};

// ================================================================
// PHASES — Wyckoff-inspired market cycle phases
// ================================================================

const MARKET_PHASES = [
  {
    id: "accumulation",
    name: "Accumulation",
    description: "Smart money absorbing supply, low volatility, range-bound price action",
    requiredSignals: [],
    color: "#22c55e",
  },
  {
    id: "markup",
    name: "Markup",
    description: "Trending higher on expanding volume, breakout from accumulation range",
    requiredSignals: [],
    color: "#3b82f6",
  },
  {
    id: "distribution",
    name: "Distribution",
    description: "Smart money distributing to late buyers, rising volatility, topping patterns",
    requiredSignals: [],
    color: "#f97316",
  },
  {
    id: "markdown",
    name: "Markdown",
    description: "Trending lower on expanding volume, breakdown from distribution range",
    requiredSignals: [],
    color: "#ef4444",
  },
];

// ================================================================
// FACTORY FUNCTION
// ================================================================

/**
 * Create a standard domain config for any market ticker.
 *
 * @param {string} ticker - Ticker symbol, e.g. "AAPL"
 * @param {Object} [metadata={}] - Ticker metadata
 * @param {string} [metadata.name] - Company name
 * @param {string} [metadata.sector] - Sector
 * @param {string} [metadata.industry] - Industry
 * @param {string} [metadata.exchange] - Exchange
 * @param {string|number} [metadata.marketCap] - Market cap
 * @returns {Object} Domain config matching the shape of hormuz-iran/config.js
 */
export function createMarketConfig(ticker, metadata = {}) {
  const {
    name = ticker,
    sector = "Unknown",
    industry = "Unknown",
    exchange = "Unknown",
    marketCap = null,
  } = metadata;

  const displayName = name !== ticker ? `${ticker} \u2014 ${name}` : ticker;
  const subtitle = `${sector} | Regime Analysis`;

  return {
    id: `market-${ticker}`,
    name: displayName,
    subtitle,

    // Metadata passthrough
    sector,
    industry,
    exchange,
    marketCap,

    // Universal semantic primes — identity mapping for market domain
    primeMapping: {
      condition: "condition",
      flow: "flow",
      price: "price",
      capacity: "capacity",
      context: "context",
    },

    tabs: MARKET_TABS.map(t => ({ ...t })),

    // 12 signals with default "no data" state
    signals: SIGNAL_TEMPLATES.map(tpl => ({
      id: tpl.id,
      category: tpl.category,
      name: tpl.name,
      value: "\u2014",
      numeric: null,
      unit: tpl.unit,
      severity: "watch",
      trend: "stable",
      source: "computed",
    })),

    livePriceIds: ["price"],

    priceSymbols: { price: ticker },

    // Sigma-based at runtime — no hardcoded thresholds
    severityThresholds: {},

    categories: { ...CATEGORIES },

    phases: MARKET_PHASES.map(p => ({ ...p })),

    // Empty collections — populated by domain-specific wiring
    effectKeywords: [],
    eventKeywords: [],
    chainTerms: {},
    feedSources: [],
    derivedPrices: {},
    verifySources: {},
  };
}
