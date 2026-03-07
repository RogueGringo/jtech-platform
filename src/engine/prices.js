/**
 * prices.js — Multi-strategy commodity price fetching.
 *
 * Strategies (ordered by reliability):
 *   1. HF_PROXY — Hugging Face Space backend (server-side yfinance)
 *   2. Yahoo Finance v8 chart endpoint via CORS proxy
 *   3. Google Finance page scraping via CORS proxy
 *   4. MarketWatch page scraping via CORS proxy
 */

import { fetchWithProxyRotation } from "./feeds.js";

// ─── HF PROXY CONFIGURATION ─────────────────────────────────
const isSameOrigin = typeof window !== "undefined" && window.location.hostname.includes("hf.space");
const HF_PROXY_URL = isSameOrigin
  ? ""
  : ((typeof import.meta !== "undefined" && import.meta.env?.VITE_HF_PROXY_URL)
     || "");

async function fetchHFProxy(endpoint, timeoutMs = 12000) {
  if (!HF_PROXY_URL && !isSameOrigin) return null;
  try {
    const resp = await fetch(`${HF_PROXY_URL}${endpoint}`, {
      signal: timeoutSignal(timeoutMs),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// ─── TIMEOUT HELPER (compat: Safari <16, older browsers) ─────
function timeoutSignal(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  return controller.signal;
}

// ─── CLIENT-SIDE CACHE (separate from feeds cache) ───────────
const priceCache = new Map();

function getCached(key, ttlMs) {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > ttlMs) return null;
  return entry.data;
}

function setCache(key, data) {
  priceCache.set(key, { data, storedAt: Date.now() });
}

// ─── PRICE STRATEGIES ────────────────────────────────────────

// Strategy 1: Yahoo Finance v8 chart endpoint
async function tryYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const text = await fetchWithProxyRotation(url, 8000);
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    const result = json?.chart?.result;
    if (!result || !result[0]?.meta) return null;
    const meta = result[0].meta;
    if (meta.regularMarketPrice == null) return null;
    return { price: meta.regularMarketPrice, fetchedAt: new Date().toISOString() };
  } catch { return null; }
}

// Strategy 2: Scrape Google Finance for a quote
async function tryGoogleFinance(query) {
  const url = `https://www.google.com/finance/quote/${query}`;
  const html = await fetchWithProxyRotation(url, 8000);
  if (!html) return null;
  try {
    const match = html.match(/data-last-price="([\d.]+)"/) ||
                  html.match(/class="YMlKec fxKbKc"[^>]*>([\d,.]+)</) ||
                  html.match(/class="IsqQVc NprOob"[^>]*>([\d,.]+)</);
    if (!match) return null;
    const price = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(price) || price <= 0) return null;
    return { price, fetchedAt: new Date().toISOString() };
  } catch { return null; }
}

// Strategy 3: Try MarketWatch
async function tryMarketWatch(path) {
  const url = `https://www.marketwatch.com/investing/${path}`;
  const html = await fetchWithProxyRotation(url, 8000);
  if (!html) return null;
  try {
    const match = html.match(/class="intraday__price"[^>]*>[\s\S]*?<bg-quote[^>]*>([\d,.]+)</) ||
                  html.match(/class="value"[^>]*>\$?([\d,.]+)</) ||
                  html.match(/"price":\s*"?([\d.]+)"?/);
    if (!match) return null;
    const price = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(price) || price <= 0) return null;
    return { price, fetchedAt: new Date().toISOString() };
  } catch { return null; }
}

// Default strategy map for common commodities
const DEFAULT_STRATEGIES = {
  brent: [
    () => tryYahoo("BZ=F"),
    () => tryGoogleFinance("BZ=F:NYMEX"),
    () => tryMarketWatch("future/brn00"),
  ],
  wti: [
    () => tryYahoo("CL=F"),
    () => tryGoogleFinance("CL=F:NYMEX"),
    () => tryMarketWatch("future/crude%20oil%20-%20electronic"),
  ],
  ovx: [
    () => tryYahoo("%5EOVX"),
    () => tryGoogleFinance(".OVX:INDEXCBOE"),
  ],
};

async function fetchPriceWithFallback(strategies) {
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result && result.price > 0) return result;
    } catch { continue; }
  }
  return null;
}

/**
 * Fetch commodity prices with multi-strategy fallback.
 *
 * @param {Object} priceSymbols — map of { id: "YAHOO_SYMBOL" } for direct Yahoo lookups,
 *   or omit to use DEFAULT_STRATEGIES (brent, wti, ovx).
 * @param {Object} derivedFns — map of { id: (prices) => number|null } for derived values
 */
export async function fetchCommodityPrices(priceSymbols = {}, derivedFns = {}) {
  const CACHE_KEY = "commodityPrices";
  const TTL = 2 * 60 * 1000; // 2 minutes

  const cached = getCached(CACHE_KEY, TTL);
  if (cached) return { ...cached, source: "cached" };

  // Strategy 1: HF proxy (server-side yfinance — most reliable)
  const hfData = await fetchHFProxy("/api/prices");
  if (hfData && hfData.prices && Object.keys(hfData.prices).length > 0) {
    const payload = { ...hfData, source: "live" };
    setCache(CACHE_KEY, payload);
    return payload;
  }

  // Strategy 2: Client-side scraping via CORS proxies
  const prices = {};

  // Build strategies: merge defaults with any custom symbols
  const strategies = { ...DEFAULT_STRATEGIES };
  for (const [id, symbol] of Object.entries(priceSymbols)) {
    if (!strategies[id]) {
      strategies[id] = [
        () => tryYahoo(symbol),
        () => tryGoogleFinance(symbol),
      ];
    }
  }

  await Promise.all(
    Object.entries(strategies).map(async ([id, strats]) => {
      const result = await fetchPriceWithFallback(strats);
      if (result) {
        prices[id] = { ...result, source: "live" };
      }
    })
  );

  // Compute derived values
  for (const [id, fn] of Object.entries(derivedFns)) {
    try {
      const value = fn(prices);
      if (value !== null && value !== undefined) {
        prices[id] = {
          price: +value.toFixed(2),
          source: "derived",
          fetchedAt: new Date().toISOString(),
        };
      }
    } catch {
      // skip failed derived computations
    }
  }

  const payload = {
    prices,
    fetchedAt: new Date().toISOString(),
    liveCount: Object.values(prices).filter(p => p.source === "live").length,
    source: Object.keys(prices).length > 0 ? "live" : "unavailable",
  };

  if (Object.keys(prices).length > 0) setCache(CACHE_KEY, payload);
  return payload;
}
