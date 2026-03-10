/**
 * Market Data Orchestrator — ticker -> backend -> adapters -> engine
 *
 * Connects the FastAPI backend endpoints (/api/historical, /api/metadata,
 * /api/prices) to the market adapter and engine pipeline.
 *
 * Three entry points:
 *   analyzeTickerFromBackend(ticker, options)  — full live pipeline
 *   analyzeTickerFromCSV(ticker, ohlcv, technicals, metadata, baselineWindow) — offline/test
 *   fetchTickerPrice(ticker, backendUrl)        — live price only
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

import { createMarketConfig } from "../domains/market/config-factory.js";
import { marketToSignals, MARKET_CATEGORIES } from "../adapters/market-adapter.js";
import { computeCoherence } from "./signals.js";

// ================================================================
// BACKEND KEY -> ADAPTER KEY MAPPING
// ================================================================

/**
 * Backend (Python / yfinance) uses snake_case keys that differ slightly
 * from the JS adapter's camelCase keys. This map bridges them.
 */
const BACKEND_TO_ADAPTER = {
  rsi: "rsi",
  macd_hist: "macd_hist",
  bband_pctb: "bbpctb",
  bband_width: "bbwidth",
  volume_ratio: "volratio",
  obv_slope: "obvslope",
  mfi: "mfi",
  sma50_dist: "sma50dist",
  sma200_dist: "sma200dist",
  atr_pctile: "atrPctile",
  drawdown: "drawdown",
  adx: "adx",
};

/**
 * Convert backend technicals object (parallel arrays with Python-side keys)
 * into the adapter's expected key names.
 */
function remapTechnicals(backendTech) {
  if (!backendTech || backendTech.error) return null;
  const mapped = {};
  for (const [backendKey, adapterKey] of Object.entries(BACKEND_TO_ADAPTER)) {
    if (backendTech[backendKey]) {
      mapped[adapterKey] = backendTech[backendKey];
    }
  }
  return mapped;
}

// ================================================================
// SHARED: run engine pipeline on signals
// ================================================================

function runPipeline(ticker, ohlcv, technicals, metadata, baselineWindow) {
  const config = createMarketConfig(ticker, metadata);

  const adapterResult = marketToSignals(ticker, ohlcv, technicals, baselineWindow);
  const { signals, entropy, primeDensity, dissolutionRate, propagationRate } = adapterResult;

  if (signals.length === 0) {
    return {
      config,
      signals,
      regime: { label: "NO DATA", quadrant: "none" },
      gini: 0,
      mean: 0,
      coherence: 0,
      entropy: 0,
      primeDensity: 0,
      dissolutionRate: 0,
      propagationRate: 0,
      metadata,
      ohlcv,
    };
  }

  const coherenceResult = computeCoherence(signals, MARKET_CATEGORIES);

  return {
    config,
    signals,
    regime: coherenceResult.regime,
    gini: coherenceResult.gini,
    mean: coherenceResult.meanSeverity,
    coherence: coherenceResult.coherenceScore,
    entropy,
    primeDensity,
    dissolutionRate,
    propagationRate,
    metadata,
    ohlcv,
  };
}

// ================================================================
// ENTRY 1: Full backend pipeline (live)
// ================================================================

/**
 * Fetch metadata + historical data from the backend, run through
 * the adapter and engine, and return the full analysis result.
 *
 * @param {string} ticker - Ticker symbol, e.g. "AAPL"
 * @param {Object} [options={}]
 * @param {string} [options.backendUrl=""] - Base URL of the backend (e.g. "http://localhost:7860")
 * @param {string} [options.period="1y"] - yfinance period string
 * @param {string} [options.interval="1d"] - yfinance interval string
 * @param {number} [options.baselineWindow=60] - Rolling sigma baseline window
 * @returns {Promise<Object>} Full analysis result or null on failure
 */
export async function analyzeTickerFromBackend(ticker, options = {}) {
  const {
    backendUrl = "",
    period = "1y",
    interval = "1d",
    baselineWindow = 60,
  } = options;

  const base = backendUrl.replace(/\/$/, "");

  // 1. Fetch metadata
  let metadata = {};
  try {
    const metaRes = await fetch(`${base}/api/metadata/${encodeURIComponent(ticker)}`);
    if (metaRes.ok) {
      metadata = await metaRes.json();
    } else {
      console.warn(`[market-data] Metadata fetch returned ${metaRes.status} for ${ticker}`);
    }
  } catch (err) {
    console.warn(`[market-data] Metadata fetch failed for ${ticker}: ${err.message}`);
  }

  // 2. Fetch historical OHLCV + technicals
  let ohlcv, technicals;
  try {
    const histUrl = `${base}/api/historical/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`;
    const histRes = await fetch(histUrl);
    if (!histRes.ok) {
      const body = await histRes.text();
      throw new Error(`HTTP ${histRes.status}: ${body.slice(0, 200)}`);
    }
    const histData = await histRes.json();
    if (histData.error) {
      throw new Error(histData.error);
    }
    ohlcv = histData.ohlcv;
    technicals = remapTechnicals(histData.technicals);
  } catch (err) {
    throw new Error(`[market-data] Historical data fetch failed for ${ticker}: ${err.message}`);
  }

  if (!ohlcv || ohlcv.length === 0) {
    throw new Error(`[market-data] No OHLCV data returned for ${ticker}`);
  }

  // 3. Run pipeline
  return runPipeline(ticker, ohlcv, technicals, metadata, baselineWindow);
}

// ================================================================
// ENTRY 2: Offline / CSV pipeline (tests, backtests)
// ================================================================

/**
 * Run the full analysis pipeline from pre-loaded data.
 * Same output shape as analyzeTickerFromBackend, but takes data directly.
 *
 * @param {string} ticker - Ticker symbol
 * @param {Object[]} ohlcv - [{open, high, low, close, volume}, ...]
 * @param {Object} technicals - Adapter-keyed technicals (or null to compute)
 * @param {Object} [metadata={}] - Ticker metadata
 * @param {number} [baselineWindow=60] - Rolling sigma baseline window
 * @returns {Object} Full analysis result
 */
export function analyzeTickerFromCSV(ticker, ohlcv, technicals, metadata = {}, baselineWindow = 60) {
  return runPipeline(ticker, ohlcv, technicals, metadata, baselineWindow);
}

// ================================================================
// ENTRY 3: Live price only
// ================================================================

/**
 * Fetch the latest price for a ticker.
 *
 * Tries the /api/prices endpoint first (for known commodities),
 * then falls back to the last close from /api/historical.
 *
 * @param {string} ticker - Ticker symbol
 * @param {string} [backendUrl=""] - Base URL of the backend
 * @returns {Promise<{price: number, source: string, fetchedAt: string}>}
 */
export async function fetchTickerPrice(ticker, backendUrl = "") {
  const base = backendUrl.replace(/\/$/, "");
  const now = new Date().toISOString();

  // Try /api/prices first (commodity tickers: brent, wti, ovx)
  const tickerLower = ticker.toLowerCase();
  const commodityMap = { brent: "brent", wti: "wti", ovx: "ovx", "bz=f": "brent", "cl=f": "wti", "^ovx": "ovx" };
  const commodityKey = commodityMap[tickerLower];

  if (commodityKey) {
    try {
      const priceRes = await fetch(`${base}/api/prices`);
      if (priceRes.ok) {
        const data = await priceRes.json();
        if (data.prices && data.prices[commodityKey]) {
          return {
            price: data.prices[commodityKey].price,
            source: "api/prices",
            fetchedAt: data.fetchedAt || now,
          };
        }
      }
    } catch (err) {
      // Fall through to historical
    }
  }

  // Fallback: last close from historical
  try {
    const histRes = await fetch(`${base}/api/historical/${encodeURIComponent(ticker)}?period=5d&interval=1d`);
    if (histRes.ok) {
      const data = await histRes.json();
      if (data.ohlcv && data.ohlcv.length > 0) {
        const lastBar = data.ohlcv[data.ohlcv.length - 1];
        return {
          price: lastBar.close,
          source: "api/historical (last close)",
          fetchedAt: data.fetchedAt || now,
        };
      }
    }
  } catch (err) {
    throw new Error(`[market-data] Price fetch failed for ${ticker}: ${err.message}`);
  }

  throw new Error(`[market-data] No price data available for ${ticker}`);
}

// ================================================================
// RE-EXPORT key mapping for external use (e.g. CSV loaders)
// ================================================================

export { BACKEND_TO_ADAPTER };
