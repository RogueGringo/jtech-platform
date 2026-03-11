/**
 * feeds.js — RSS feed ingestion with CORS proxy rotation.
 *
 * Data flow (ordered by reliability):
 *   1. HF_PROXY — Hugging Face Space backend (server-side, no CORS, real yfinance)
 *   2. CORS proxies — Client-side fallback via public proxy rotation
 *   3. Scenario data — Hardcoded baseline if all sources fail
 *
 * Every datum is tagged: { source: "live" | "cached" | "scenario", fetchedAt }
 */

// ─── HF PROXY CONFIGURATION ─────────────────────────────────
// If hosted on the HF Space itself, API is same-origin (/api/*).
// If hosted on GitHub Pages, reaches out to the HF Space URL.
const isSameOrigin = typeof window !== "undefined" && window.location.hostname.includes("hf.space");
const HF_PROXY_URL = isSameOrigin
  ? ""  // same origin — just call /api/* directly
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
  // allow GC if signal is not needed
  controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  return controller.signal;
}

// ─── CORS PROXY ROTATION ────────────────────────────────────
// These are public third-party proxies. All feed URLs are disclosed to each
// proxy service, and their availability may vary. For production use, consider
// replacing with a self-hosted proxy (e.g. a small serverless function).
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export async function fetchWithProxyRotation(url, timeoutMs = 10000) {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const resp = await fetch(makeProxy(url), {
        signal: timeoutSignal(timeoutMs),
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || text.length < 20) continue;
      return text;
    } catch {
      continue;
    }
  }
  return null;
}

// ─── RSS PARSER ──────────────────────────────────────────────
function parseRSS(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const items = doc.querySelectorAll("item");
    return Array.from(items).map(item => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const description = (item.querySelector("description")?.textContent || "")
        .replace(/<[^>]*>/g, "").trim();
      const link = item.querySelector("link")?.textContent?.trim() || "";
      const pubDate = item.querySelector("pubDate")?.textContent?.trim() || "";
      return { title, description, link, pubDate };
    });
  } catch {
    return [];
  }
}

// ─── CLIENT-SIDE CACHE ───────────────────────────────────────
const cache = new Map();

function getCached(key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > ttlMs) return null;
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, storedAt: Date.now() });
}

// ─── FETCH ALL FEEDS ─────────────────────────────────────────
/**
 * @param {Array} feedSources — array of { id, name, url, category, priority }
 * @param {Function} classifyFn — function(text) => classification result
 */
export async function fetchAllFeeds(feedSources, classifyFn) {
  const CACHE_KEY = "allFeeds";
  const TTL = 3 * 60 * 1000; // 3 minutes

  const cached = getCached(CACHE_KEY, TTL);
  if (cached) return { ...cached, source: "cached" };

  // Strategy 1: HF proxy (server-side, no CORS issues)
  const hfData = await fetchHFProxy("/api/feeds");
  if (hfData && hfData.items && hfData.items.length > 0) {
    const payload = { ...hfData, source: "live" };
    setCache(CACHE_KEY, payload);
    return payload;
  }

  // Strategy 2: Client-side CORS proxy rotation
  const allItems = [];
  const sourceStatus = {};

  // Sort by priority — fetch high-priority first
  const sorted = [...feedSources].sort((a, b) => a.priority - b.priority);

  // Fetch feeds concurrently in batches
  const results = await Promise.allSettled(
    sorted.map(async (src) => {
      try {
        const text = await fetchWithProxyRotation(src.url, 12000);
        if (!text) throw new Error("No response from any proxy");
        const items = parseRSS(text);
        if (items.length === 0) throw new Error("Empty feed");
        sourceStatus[src.id] = { ok: true, count: items.length };
        return items.slice(0, 8).map(item => ({
          ...item,
          source: src.name,
          sourceId: src.id,
          category: src.category,
          ...classifyFn(item.title + " " + item.description),
        }));
      } catch (err) {
        sourceStatus[src.id] = { ok: false, error: err instanceof Error ? err.message : String(err) };
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") allItems.push(...result.value);
  }

  // Sort by date descending — guard against NaN from unparseable dates
  const safeTime = (d) => { const t = d ? new Date(d).getTime() : 0; return isNaN(t) ? 0 : t; };
  allItems.sort((a, b) => safeTime(b.pubDate) - safeTime(a.pubDate));

  // Deduplicate by title similarity
  const seen = new Set();
  const deduped = allItems.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const payload = {
    items: deduped,
    sourceStatus,
    fetchedAt: new Date().toISOString(),
    liveCount: Object.values(sourceStatus).filter(s => s.ok).length,
    totalSources: feedSources.length,
    source: deduped.length > 0 ? "live" : "unavailable",
  };

  if (deduped.length > 0) setCache(CACHE_KEY, payload);
  return payload;
}
