# JtechAi Platform Rebrand & Framework Separation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebrand from Valor Energy Partners to JtechAi, separate engine/UI/domain layers so new intelligence domains are a config folder, remove Valor-specific business content, add help hovers and regime indicator.

**Architecture:** Extract all domain-specific data (signals, keywords, thresholds, prose, sources) from monolithic App.jsx into `src/domains/hormuz-iran/`. Extract classification/severity/feed/price logic into `src/engine/`. Build generic UI shell in `src/ui/` that renders from config. Add HelpHover component and universal glossary.

**Tech Stack:** React 18, Vite 5, FastAPI (Python), inline styles with shared DesignSystem.

---

### Task 1: Create directory structure and design system

**Files:**
- Create: `src/engine/` (directory)
- Create: `src/ui/` (directory)
- Create: `src/domains/hormuz-iran/` (directory)
- Create: `src/domains/_template/` (directory)
- Create: `src/terms/` (directory)
- Create: `src/ui/DesignSystem.js`

**Step 1: Create all directories**

Run: `mkdir -p src/engine src/ui src/domains/hormuz-iran src/domains/_template src/terms`

**Step 2: Create DesignSystem.js from existing theme.js**

Create `src/ui/DesignSystem.js` — move colors from `src/theme.js`, add typography and spacing constants:

```js
// Shared design tokens — all visual constants live here.
// Import from here, never hardcode colors/fonts/spacing in components.

export const COLORS = {
  bg: "#0a0c10",
  surface: "#12151c",
  surfaceHover: "#1a1e28",
  border: "#1e2330",
  borderActive: "#d4a843",
  gold: "#d4a843",
  goldDim: "#8a6e2f",
  goldBright: "#f0c95a",
  red: "#e04040",
  redDim: "#8b2020",
  green: "#3dba6f",
  greenDim: "#1d6b3a",
  blue: "#4a8fd4",
  blueDim: "#2a5580",
  text: "#e8e4dc",
  textDim: "#8a8678",
  textMuted: "#5a5850",
  orange: "#e08840",
  purple: "#9070d0",
};

export const FONTS = {
  heading: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', sans-serif",
};

export const SPACING = {
  page: 32,
  section: 24,
  card: 20,
  element: 12,
  tight: 6,
};

export function severityColor(severity) {
  if (severity === "critical") return COLORS.red;
  if (severity === "high") return COLORS.orange;
  if (severity === "moderate") return COLORS.blue;
  return COLORS.textMuted;
}

export function trendArrow(trend) {
  if (trend === "up") return "\u25B2";
  if (trend === "down") return "\u25BC";
  return "\u25A0";
}
```

**Step 3: Commit**

```bash
git add src/engine src/ui src/domains src/terms src/ui/DesignSystem.js
git commit -m "$(cat <<'EOF'
scaffold: create engine/ui/domains/terms directory structure and DesignSystem

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract classification engine

**Files:**
- Create: `src/engine/classify.js`
- Source: `src/DataService.jsx:169-258` (classifyText, keyword matching, CHAIN_TERMS)

**Step 1: Create classify.js**

Extract `matchesKeyword`, `classifyText`, `WORD_BOUNDARY_SET` from DataService.jsx. Make them accept keyword/chain config as parameters instead of using hardcoded lists:

```js
// Classification engine — scores text as EFFECT vs EVENT using domain keyword config.
// Domain-agnostic: vocabulary comes from the domain config, not from this file.

const WORD_BOUNDARY_SET = new Set([
  "if", "may", "says", "ais", "spr", "duc", "bbl", "eur", "lng", "wti",
]);

function matchesKeyword(lower, keyword) {
  if (WORD_BOUNDARY_SET.has(keyword)) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    return re.test(lower);
  }
  return lower.includes(keyword);
}

export function classifyText(text, { effectKeywords = [], eventKeywords = [], chainTerms = {} } = {}) {
  if (!text) return { classification: "MIXED", score: 0, effectHits: [], eventHits: [], chainMap: [], confidence: 0 };

  const lower = text.toLowerCase();
  const effectHits = effectKeywords.filter(k => matchesKeyword(lower, k));
  const eventHits = eventKeywords.filter(k => matchesKeyword(lower, k));
  const totalHits = effectHits.length + eventHits.length;
  const score = totalHits > 0 ? (effectHits.length - eventHits.length) / totalHits : 0;

  const chainMap = [];
  for (const [chain, terms] of Object.entries(chainTerms)) {
    if (terms.some(t => matchesKeyword(lower, t))) chainMap.push(chain);
  }

  return {
    classification: score > 0.15 ? "EFFECT" : score < -0.15 ? "EVENT" : "MIXED",
    score,
    effectHits,
    eventHits,
    chainMap,
    confidence: totalHits > 0 ? Math.min(100, Math.round((totalHits / 8) * 100)) : 0,
  };
}
```

**Step 2: Commit**

```bash
git add src/engine/classify.js
git commit -m "$(cat <<'EOF'
extract: classification engine accepts domain keyword config as parameter

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extract signals engine

**Files:**
- Create: `src/engine/signals.js`
- Source: `src/App.jsx:110-130` (SEVERITY_THRESHOLDS, computeSeverity)

**Step 1: Create signals.js**

```js
// Signal severity computation — evaluates numeric values against domain thresholds.

export function computeSeverity(id, numeric, baseSeverity, thresholds = {}) {
  const levels = thresholds[id];
  if (!levels || numeric === null || numeric === undefined) return baseSeverity;
  for (const [level, threshold] of levels) {
    if (numeric >= threshold) return level;
  }
  return "watch";
}

export function computeCoherence(signals) {
  const criticalCount = signals.filter(s => s.severity === "critical").length;
  const highCount = signals.filter(s => s.severity === "high").length;
  const score = Math.round(((criticalCount * 1.0 + highCount * 0.6) / signals.length) * 100);
  const label = score >= 75 ? "CRISIS REGIME" : score >= 50 ? "TRANSITION" : "STABLE";
  return { score, label, criticalCount, highCount };
}
```

**Step 2: Commit**

```bash
git add src/engine/signals.js
git commit -m "$(cat <<'EOF'
extract: signal severity and coherence computation engine

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extract feeds engine

**Files:**
- Create: `src/engine/feeds.js`
- Source: `src/DataService.jsx:1-167, 260-335` (all feed fetching, RSS parsing, CORS proxy rotation, caching)

**Step 1: Create feeds.js**

Move `timeoutSignal`, `fetchWithProxyRotation`, `CORS_PROXIES`, `parseRSS`, cache helpers, and `fetchAllFeeds` from DataService.jsx. Modify `fetchAllFeeds` to accept `feedSources` and a `classifyFn` as parameters:

```js
// Feed ingestion engine — fetches RSS from multiple sources via CORS proxy rotation.
// Domain-agnostic: feed sources and classification function come from caller.

// ── HF PROXY CONFIGURATION ──
const isSameOrigin = typeof window !== "undefined" && window.location.hostname.includes("hf.space");
const HF_PROXY_URL = isSameOrigin
  ? ""
  : ((typeof import.meta !== "undefined" && import.meta.env?.VITE_HF_PROXY_URL)
     || "");  // No default — must be configured per deployment

async function fetchHFProxy(endpoint, timeoutMs = 12000) {
  if (!HF_PROXY_URL && !isSameOrigin) return null;
  try {
    const resp = await fetch(`${HF_PROXY_URL}${endpoint}`, { signal: timeoutSignal(timeoutMs) });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  return controller.signal;
}

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export async function fetchWithProxyRotation(url, timeoutMs = 10000) {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const resp = await fetch(makeProxy(url), { signal: timeoutSignal(timeoutMs) });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || text.length < 20) continue;
      return text;
    } catch { continue; }
  }
  return null;
}

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
  } catch { return []; }
}

// ── CLIENT-SIDE CACHE ──
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

export async function fetchAllFeeds(feedSources, classifyFn) {
  const CACHE_KEY = "allFeeds";
  const TTL = 3 * 60 * 1000;

  const cached = getCached(CACHE_KEY, TTL);
  if (cached) return { ...cached, source: "cached" };

  // Strategy 1: HF proxy
  const hfData = await fetchHFProxy("/api/feeds");
  if (hfData && hfData.items && hfData.items.length > 0) {
    const payload = { ...hfData, source: "live" };
    setCache(CACHE_KEY, payload);
    return payload;
  }

  // Strategy 2: Client-side CORS proxy rotation
  const allItems = [];
  const sourceStatus = {};
  const sorted = [...feedSources].sort((a, b) => a.priority - b.priority);

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

  const safeTime = (d) => { const t = d ? new Date(d).getTime() : 0; return isNaN(t) ? 0 : t; };
  allItems.sort((a, b) => safeTime(b.pubDate) - safeTime(a.pubDate));

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
```

**Step 2: Commit**

```bash
git add src/engine/feeds.js
git commit -m "$(cat <<'EOF'
extract: feed ingestion engine accepts domain sources and classify fn

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Extract prices engine

**Files:**
- Create: `src/engine/prices.js`
- Source: `src/DataService.jsx:337-470` (all price fetching strategies)

**Step 1: Create prices.js**

Move all price fetching logic. Make `fetchCommodityPrices` accept `priceSymbols` config:

```js
// Commodity price fetching — multi-strategy with HF proxy, Yahoo, Google Finance, MarketWatch.

import { fetchWithProxyRotation } from "./feeds.js";

function timeoutSignal(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  return controller.signal;
}

const isSameOrigin = typeof window !== "undefined" && window.location.hostname.includes("hf.space");
const HF_PROXY_URL = isSameOrigin
  ? ""
  : ((typeof import.meta !== "undefined" && import.meta.env?.VITE_HF_PROXY_URL) || "");

async function fetchHFProxy(endpoint, timeoutMs = 12000) {
  if (!HF_PROXY_URL && !isSameOrigin) return null;
  try {
    const resp = await fetch(`${HF_PROXY_URL}${endpoint}`, { signal: timeoutSignal(timeoutMs) });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

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

// Default strategies per symbol — can be extended by domain config
const DEFAULT_STRATEGIES = {
  "BZ=F": [() => tryYahoo("BZ=F"), () => tryGoogleFinance("BZ=F:NYMEX"), () => tryMarketWatch("future/brn00")],
  "CL=F": [() => tryYahoo("CL=F"), () => tryGoogleFinance("CL=F:NYMEX"), () => tryMarketWatch("future/crude%20oil%20-%20electronic")],
  "^OVX": [() => tryYahoo("%5EOVX"), () => tryGoogleFinance(".OVX:INDEXCBOE")],
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

// ── CLIENT-SIDE CACHE ──
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

export async function fetchCommodityPrices(priceSymbols = {}, derivedFns = {}) {
  const CACHE_KEY = "commodityPrices";
  const TTL = 2 * 60 * 1000;

  const cached = getCached(CACHE_KEY, TTL);
  if (cached) return { ...cached, source: "cached" };

  // Strategy 1: HF proxy
  const hfData = await fetchHFProxy("/api/prices");
  if (hfData && hfData.prices && Object.keys(hfData.prices).length > 0) {
    const payload = { ...hfData, source: "live" };
    setCache(CACHE_KEY, payload);
    return payload;
  }

  // Strategy 2: Client-side scraping
  const prices = {};

  await Promise.all(
    Object.entries(priceSymbols).map(async ([id, symbol]) => {
      const strategies = DEFAULT_STRATEGIES[symbol];
      if (!strategies) return;
      const result = await fetchPriceWithFallback(strategies);
      if (result) prices[id] = { ...result, source: "live" };
    })
  );

  // Compute derived values using domain-provided functions
  for (const [id, fn] of Object.entries(derivedFns)) {
    const derived = fn(prices);
    if (derived !== null && derived !== undefined) {
      prices[id] = { price: derived, source: "derived", fetchedAt: new Date().toISOString() };
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
```

**Step 2: Commit**

```bash
git add src/engine/prices.js
git commit -m "$(cat <<'EOF'
extract: price fetching engine with configurable symbols and derived values

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Create Hormuz-Iran domain config

**Files:**
- Create: `src/domains/hormuz-iran/config.js`
- Source: All hardcoded data from `src/App.jsx` (SIGNALS, SEVERITY_THRESHOLDS, CATEGORY_META, VERIFY_SOURCES, LIVE_PRICE_IDS) and `src/DataService.jsx` (EFFECT_KEYWORDS, EVENT_KEYWORDS, CHAIN_TERMS, FEED_SOURCES)

**Step 1: Create config.js**

Move ALL domain-specific data arrays/objects into this single config file. This is the largest extraction — every signal, keyword, threshold, source, and verify link. Do NOT include the Portfolio tab or its verify sources. Remove Valor-specific Pearsall/Kansas/Ohio references from effect chain data.

The config exports a default object with shape:
```js
export default {
  id: "hormuz-iran",
  name: "Strait of Hormuz Crisis",
  subtitle: "Effects-Based Analysis",
  tabs: [...],           // NO "portfolio" tab
  signals: [...],        // from SIGNALS array in App.jsx
  livePriceIds: [...],   // from LIVE_PRICE_IDS
  severityThresholds: {}, // from SEVERITY_THRESHOLDS
  categories: {},        // from CATEGORY_META
  effectKeywords: [],    // from DataService.jsx
  eventKeywords: [],     // from DataService.jsx
  chainTerms: {},        // from DataService.jsx
  feedSources: [],       // from DataService.jsx FEED_SOURCES
  priceSymbols: { brent: "BZ=F", wti: "CL=F", ovx: "^OVX" },
  derivedPrices: {
    spread: (prices) => prices.brent && prices.wti ? +(prices.brent.price - prices.wti.price).toFixed(2) : null,
    kcposted: (prices) => prices.wti ? +(prices.wti.price - 13.25).toFixed(2) : null,
  },
  verifySources: {},     // from VERIFY_SOURCES (minus portfolio)
};
```

**Step 2: Commit**

```bash
git add src/domains/hormuz-iran/config.js
git commit -m "$(cat <<'EOF'
extract: Hormuz-Iran domain config with all signals, keywords, sources

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Create Hormuz-Iran domain content

**Files:**
- Create: `src/domains/hormuz-iran/content.jsx`
- Source: All prose/JSX from ThesisTab, NodesTab, PlaybookTab in `src/App.jsx`

**Step 1: Create content.jsx**

Export React components for domain-specific content: `ThesisContent`, `NodesContent`, `EffectChainContent`. These contain the Hormuz-specific prose, examples, and data tables. Remove all Valor-specific asset content (Pearsall boundary layer section, Eagle Ford netbacks, Kansas posted prices in effect chains). Keep the universal framework concepts (effects vs events, phase transitions, Gini trajectories).

The Pearsall/MPD analog section in PlaybookTab (lines 1069-1111) is Valor-specific — remove it. The "Geometry Is the Same at Every Scale" closing section (lines 1113-1140) is universal — keep it but remove Valor asset references.

The "Price Architecture -> Domestic Economics" effect chain references Kansas Common and Eagle Ford specifically — generalize to "basin economics" without naming Valor's specific assets, or remove chain entries 3-4 (Kansas Common, Eagle Ford netback) from that chain.

**Step 2: Commit**

```bash
git add src/domains/hormuz-iran/content.jsx
git commit -m "$(cat <<'EOF'
extract: Hormuz-Iran domain content, Valor asset references removed

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Create universal glossary and domain terms

**Files:**
- Create: `src/terms/universal.js`
- Create: `src/domains/hormuz-iran/terms.js`

**Step 1: Create universal.js**

Framework-level glossary of semantic primes and analytical terms:

```js
// Universal glossary — framework terms that apply to all domains.
// Used by HelpHover to show tooltips on technical terms.

export default {
  "effect": "A measurable change in the physical state of a system. Unlike events (narratives about what happened), effects are countable, binary, or directly observable. Insurance withdrawal is an effect. A headline about oil prices is an event.",
  "event": "A narrative description of something that happened. Events are stories — they may or may not correspond to measurable physical changes. The same event can produce wildly different effects depending on system state.",
  "condition:state": "The current measurable value of a system variable. P&I club coverage status, tanker transit count, VLCC spot rate — each is a condition with a specific state at any moment.",
  "activity:state": "An action or process that is currently occurring and producing effects on condition:states. A military strike is an activity. Insurance withdrawal is a resulting condition:state change.",
  "phase transition": "A discontinuous change in system behavior where the rules themselves change — not just the values. Water doesn't get progressively colder until it freezes; it's liquid, then solid. Markets work the same way.",
  "regime": "A stable mode of system operation with consistent rules. 'Risk-on' and 'crisis' are different regimes. Regime detection identifies which set of rules currently governs the system.",
  "consolidation": "When independent signals converge toward the same conclusion. Multiple unrelated indicators all pointing the same direction suggests structural change, not noise.",
  "dispersion": "When signals diverge — some say crisis, others say business as usual. Dispersion suggests the perturbation is transient, not structural.",
  "kernel condition": "A single variable that gates all downstream behavior. If this condition changes, everything else must follow. In maritime trade, insurance coverage is the kernel — ships cannot sail uninsured.",
  "semantic prime": "An irreducible unit of meaning that cannot be defined in terms of simpler concepts. In this framework: action, effect, condition, state, transition. All analysis reduces to combinations of these.",
  "boundary layer": "The zone between two stable regimes where the transition occurs. Properties of both the old and new state coexist. The system is maximally uncertain in the boundary layer.",
  "Gini trajectory": "A measure of whether dominant signals are absorbing lesser ones (consolidation) or fragmenting into noise (dispersion). Rising Gini = structural shift. Falling Gini = transient shock.",
  "effect chain": "A causal sequence where one condition:state change alters boundary conditions for the next. Insurance withdrawal leads to fleet stoppage, which drives freight rates, which restructures price.",
  "severity": "How far a signal has deviated from its normal operating range. Critical = extreme deviation. High = significant. Moderate = notable. Watch = within normal bounds.",
  "coherence": "The degree to which independent signals agree about system state. High coherence (all signals alarming) = likely structural change. Low coherence (mixed signals) = likely noise.",
  "MS-GARCH": "Markov-Switching Generalized Autoregressive Conditional Heteroskedasticity. A statistical model that detects when a system switches between low-volatility and high-volatility regimes.",
  "backwardation": "When near-term prices are higher than future prices. In commodity markets, this signals current scarcity — the market believes the shortage is temporary.",
  "contango": "When future prices are higher than near-term prices. Signals expected future scarcity or current oversupply.",
};
```

**Step 2: Create domain terms**

```js
// Hormuz-Iran domain glossary — terms specific to this intelligence domain.

export default {
  "P&I club": "Protection & Indemnity club — a mutual insurance association for shipowners. There are 12 major clubs globally. When they withdraw war risk coverage, vessels cannot legally transit.",
  "VLCC": "Very Large Crude Carrier — a tanker capable of carrying 2 million barrels of oil. The largest commonly used vessel class for crude oil transport.",
  "AIS": "Automatic Identification System — transponders on vessels that broadcast position, speed, and heading. Used to track maritime traffic in real time.",
  "OVX": "CBOE Crude Oil Volatility Index — measures expected 30-day volatility of oil prices, derived from options on USO. Normal range 20-35; above 40 = crisis; above 60 = extreme.",
  "VIX": "CBOE Volatility Index — measures expected 30-day volatility of the S&P 500. When OVX spikes without VIX, it confirms an oil-specific shock rather than broad market fear.",
  "SPR": "Strategic Petroleum Reserve — US government emergency oil stockpile. Current capacity 714 million barrels. Maximum drawdown rate 4.4 million barrels per day.",
  "DUC": "Drilled but Uncompleted well — a well that has been drilled but not yet hydraulically fractured and brought online. DUC inventory acts as a buffer for rapid production response.",
  "force majeure": "A legal clause excusing contract performance due to extraordinary circumstances beyond control. When declared, it suspends delivery obligations — a binary condition:state.",
  "Brent": "The global benchmark crude oil price, based on North Sea production. Priced in USD per barrel.",
  "WTI": "West Texas Intermediate — the US benchmark crude oil price, delivered to Cushing, Oklahoma. Typically trades at a discount to Brent.",
  "OPEC+": "Organization of the Petroleum Exporting Countries plus allied producers (notably Russia). Controls approximately 40% of global oil production and manages output quotas.",
  "war risk premium": "Additional insurance cost for vessels transiting conflict zones. When unquotable, it means no insurer will offer coverage at any price.",
  "Strait of Hormuz": "A narrow waterway between Iran and Oman carrying approximately 20% of global petroleum liquids and 20% of global LNG. The most critical chokepoint in global energy trade.",
};
```

**Step 3: Commit**

```bash
git add src/terms/universal.js src/domains/hormuz-iran/terms.js
git commit -m "$(cat <<'EOF'
feat: add universal framework glossary and Hormuz-Iran domain terms

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Create HelpHover component

**Files:**
- Create: `src/ui/HelpHover.jsx`

**Step 1: Create HelpHover.jsx**

A reusable component that wraps any term and shows a tooltip on hover:

```jsx
import { useState, useRef, useEffect } from "react";
import { COLORS } from "./DesignSystem.js";

export default function HelpHover({ term, definition, children }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState("below");
  const triggerRef = useRef(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.top < 200 ? "below" : "above");
    }
  }, [show]);

  if (!definition) return children || term;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{
        position: "relative",
        borderBottom: `1px dotted ${COLORS.gold}60`,
        cursor: "help",
        display: "inline",
      }}
    >
      {children || term}
      {show && (
        <span style={{
          position: "absolute",
          [position === "above" ? "bottom" : "top"]: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 320,
          maxWidth: "90vw",
          padding: "12px 16px",
          background: COLORS.surface,
          border: `1px solid ${COLORS.gold}40`,
          borderRadius: 8,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
          zIndex: 1000,
          pointerEvents: "none",
        }}>
          <span style={{
            display: "block",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: COLORS.gold,
            marginBottom: 6,
            textTransform: "uppercase",
          }}>
            {term}
          </span>
          <span style={{
            display: "block",
            fontSize: 12,
            color: COLORS.textDim,
            lineHeight: 1.6,
            fontWeight: 400,
            fontStyle: "normal",
          }}>
            {definition}
          </span>
        </span>
      )}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/HelpHover.jsx
git commit -m "$(cat <<'EOF'
feat: HelpHover tooltip component for term education

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Create RegimeBadge component

**Files:**
- Create: `src/ui/RegimeBadge.jsx`

**Step 1: Create RegimeBadge.jsx**

Persistent regime state indicator — extracted from SignalMonitorTab's inline regime display:

```jsx
import { COLORS } from "./DesignSystem.js";

export default function RegimeBadge({ coherence }) {
  const { score, label, criticalCount, highCount } = coherence;
  const color = score >= 75 ? COLORS.red : score >= 50 ? COLORS.orange : COLORS.green;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 20px", borderRadius: 8,
      background: `${color}15`, border: `1px solid ${color}40`,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        boxShadow: `0 0 8px ${color}80`,
        animation: "pulse 2s infinite",
      }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1.5 }}>{label}</div>
        <div style={{ fontSize: 10, color: COLORS.textDim }}>
          {criticalCount} critical / {highCount} high
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/RegimeBadge.jsx
git commit -m "$(cat <<'EOF'
feat: RegimeBadge persistent regime state indicator component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Create domain template

**Files:**
- Create: `src/domains/_template/config.js`
- Create: `src/domains/_template/content.jsx`
- Create: `src/domains/_template/terms.js`

**Step 1: Create template config**

```js
// Domain Configuration Template
// Copy this folder and fill in your domain-specific data.
// See src/domains/hormuz-iran/ for a complete example.

export default {
  id: "my-domain",
  name: "Domain Name",
  subtitle: "Brief description",

  // Which tabs to show, in order
  tabs: [
    { id: "thesis", label: "THE THESIS" },
    { id: "nodes", label: "TRACKING NODES" },
    { id: "patterns", label: "PATTERNS OF LIFE" },
    { id: "playbook", label: "EFFECT CHAINS" },
    { id: "monitor", label: "SIGNAL MONITOR" },
    { id: "feed", label: "LIVE FEED" },
  ],

  // Signals to monitor — each has id, category, name, value, numeric, unit, severity, trend, source
  signals: [],

  // Which signal IDs receive live price data
  livePriceIds: [],

  // Severity thresholds: signal id -> [[level, threshold], ...]
  severityThresholds: {},

  // Signal categories with display label and color key
  categories: {},

  // Classification vocabulary
  effectKeywords: [],
  eventKeywords: [],
  chainTerms: {},

  // RSS/API sources
  feedSources: [],

  // Commodity symbols to fetch: { displayId: "YAHOO_SYMBOL" }
  priceSymbols: {},

  // Derived price computations: { id: (prices) => number | null }
  derivedPrices: {},

  // Per-tab upstream verification links
  verifySources: {},
};
```

**Step 2: Create template content**

```jsx
// Domain Content Template
// Export components for each content tab.

export function ThesisContent() {
  return <div>Your thesis content here.</div>;
}

export function NodesContent() {
  return <div>Your tracking nodes here.</div>;
}

export function EffectChainContent() {
  return <div>Your effect chain visualizations here.</div>;
}

export function PatternsContent() {
  return <div>Your patterns of life content here.</div>;
}
```

**Step 3: Create template terms**

```js
// Domain-specific glossary — terms unique to this intelligence domain.
export default {};
```

**Step 4: Commit**

```bash
git add src/domains/_template/
git commit -m "$(cat <<'EOF'
feat: domain template scaffold for creating new intelligence projects

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Build generic UI shell — Header and App

**Files:**
- Create: `src/ui/Header.jsx`
- Create: `src/ui/App.jsx`
- Modify: `src/main.jsx`

**Step 1: Create Header.jsx**

Generic header that reads branding and tabs from domain config:

```jsx
import { COLORS, FONTS } from "./DesignSystem.js";

export default function Header({ config, activeTab, setActiveTab }) {
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "24px 32px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 4 }}>
        <span style={{ fontFamily: FONTS.heading, fontSize: 28, fontWeight: 700, color: COLORS.gold, letterSpacing: -0.5 }}>
          JTECH AI
        </span>
        <span style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          {config.name} {config.subtitle ? `\u00B7 ${config.subtitle}` : ""}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 9, letterSpacing: 1, padding: "2px 8px", borderRadius: 3,
          background: `${COLORS.green}15`, color: COLORS.green, fontWeight: 700,
          marginLeft: "auto",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.green, animation: "pulse 2s infinite" }} />
          CONTINUOUS UPDATE
        </span>
      </div>
      <p style={{ fontSize: 13, color: COLORS.textDim, margin: "4px 0 16px", maxWidth: 720, lineHeight: 1.5 }}>
        All-source intelligence platform tracking <em>effects</em> over events for structural edge across market regimes.
      </p>
      <div style={{ display: "flex", gap: 0 }}>
        {config.tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 20px",
              background: activeTab === t.id ? COLORS.surface : "transparent",
              border: "1px solid",
              borderColor: activeTab === t.id ? COLORS.border : "transparent",
              borderBottom: activeTab === t.id ? `2px solid ${COLORS.gold}` : "2px solid transparent",
              borderRadius: "6px 6px 0 0",
              color: activeTab === t.id ? COLORS.gold : COLORS.textMuted,
              fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create App.jsx**

The main app shell that loads a domain config and routes tabs to the appropriate views:

```jsx
import { useState, useMemo } from "react";
import Header from "./Header.jsx";
import { COLORS } from "./DesignSystem.js";

// Domain config — change this import to switch domains
import domainConfig from "../domains/hormuz-iran/config.js";
import * as domainContent from "../domains/hormuz-iran/content.jsx";
import domainTerms from "../domains/hormuz-iran/terms.js";
import universalTerms from "../terms/universal.js";

// UI views
import ThesisView from "./ThesisView.jsx";
import NodesView from "./NodesView.jsx";
import PatternsView from "./PatternsView.jsx";
import EffectChainView from "./EffectChainView.jsx";
import SignalMonitor from "./SignalMonitor.jsx";
import LiveFeed from "./LiveFeed.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState(domainConfig.tabs[0]?.id || "thesis");
  const allTerms = useMemo(() => ({ ...universalTerms, ...domainTerms }), []);

  const tabContent = {
    thesis: <ThesisView config={domainConfig} content={domainContent} terms={allTerms} />,
    nodes: <NodesView config={domainConfig} content={domainContent} terms={allTerms} />,
    patterns: <PatternsView config={domainConfig} content={domainContent} terms={allTerms} />,
    playbook: <EffectChainView config={domainConfig} content={domainContent} terms={allTerms} />,
    monitor: <SignalMonitor config={domainConfig} terms={allTerms} />,
    feed: <LiveFeed config={domainConfig} terms={allTerms} />,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <Header config={domainConfig} activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {tabContent[activeTab] || <div style={{ padding: 32, color: COLORS.textDim }}>Tab not configured.</div>}
      </div>
    </div>
  );
}
```

**Step 3: Update main.jsx**

Change import from `./App.jsx` to `./ui/App.jsx`.

**Step 4: Commit**

```bash
git add src/ui/Header.jsx src/ui/App.jsx src/main.jsx
git commit -m "$(cat <<'EOF'
feat: generic UI shell with Header and App loading domain config

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Build tab view components

**Files:**
- Create: `src/ui/ThesisView.jsx`
- Create: `src/ui/NodesView.jsx`
- Create: `src/ui/PatternsView.jsx`
- Create: `src/ui/EffectChainView.jsx`
- Create: `src/ui/SignalMonitor.jsx`
- Create: `src/ui/LiveFeed.jsx`
- Create: `src/ui/SourceVerifyLink.jsx`

**Step 1: Create each view component**

Each view is a generic shell that:
1. Receives `config`, `content`, and `terms` as props
2. Renders the domain content within the framework UI
3. Uses HelpHover for technical terms
4. Uses SourceVerifyLink for verify upstream sources
5. Uses DesignSystem for all colors/fonts

`ThesisView.jsx` — renders `content.ThesisContent` with HelpHover wrapping framework terms.

`NodesView.jsx` — reads `config.categories` and node data from `content.NodesContent`, renders the expandable category/node grid (from current NodesTab). The category headers, signal dots, and severity indicators are generic. Node descriptions come from content.

`PatternsView.jsx` — renders `content.PatternsContent` within the framework (historical correlation table, phase detection methodology, multi-scale regime detection).

`EffectChainView.jsx` — renders effect chains from `content.EffectChainContent`. The vertical connector/cascade visualization is the generic shell. Chain data comes from content.

`SignalMonitor.jsx` — reads `config.signals`, `config.severityThresholds`, `config.livePriceIds`, `config.categories`. Uses engine functions (`computeSeverity`, `computeCoherence`, `fetchCommodityPrices`, `classifyText`). Renders coherence gauge, filter controls, signal grid, semantic analyzer. Uses `RegimeBadge`.

`LiveFeed.jsx` — reads `config.feedSources`, `config.effectKeywords`, `config.eventKeywords`, `config.chainTerms`. Uses engine functions (`fetchAllFeeds`, `classifyText`). Renders feed items with classification, chain mapping, source status.

`SourceVerifyLink.jsx` — extracted from current App.jsx `SourceVerifyLink` function. Generic, receives sources array.

**Step 2: Commit**

```bash
git add src/ui/ThesisView.jsx src/ui/NodesView.jsx src/ui/PatternsView.jsx src/ui/EffectChainView.jsx src/ui/SignalMonitor.jsx src/ui/LiveFeed.jsx src/ui/SourceVerifyLink.jsx
git commit -m "$(cat <<'EOF'
feat: generic tab view components rendering from domain config + content

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Rebrand all remaining files

**Files:**
- Modify: `index.html`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `hf-proxy/app.py`
- Modify: `launcher/main.py`
- Modify: `launcher/__init__.py`
- Modify: `run.sh`
- Modify: `Dockerfile`
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/hf-sync.yml`

**Step 1: Rebrand each file**

- `index.html`: title -> "JtechAi -- All-Source Intelligence Platform"
- `package.json`: name -> "jtech-intel-platform", add author field "mr.white@jtech.ai"
- `README.md`: Full rewrite -- JtechAi platform description, Hormuz-Iran as example domain
- `hf-proxy/app.py`: FastAPI title -> "JtechAi Intelligence", docstring updated, remove "Valor"
- `launcher/main.py`: all "Valor" -> "JtechAi", image name "jtech-intel", prompt "jtech"
- `launcher/__init__.py`: comment updated
- `run.sh`: banner updated
- `Dockerfile`: no Valor-specific changes needed (already generic)
- `.github/workflows/hf-sync.yml`: check for Valor references
- `build_user_Feedback/CURRENT_FEEDBACK_REPORT.md`: update header from Valor to JtechAi

**Step 2: Commit**

```bash
git add index.html package.json README.md hf-proxy/app.py launcher/ run.sh Dockerfile .github/ build_user_Feedback/
git commit -m "$(cat <<'EOF'
rebrand: Valor Energy Partners -> JtechAi across all files

Author: mr.white@jtech.ai
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Delete old files and verify zero Valor references

**Files:**
- Delete: `src/App.jsx` (replaced by `src/ui/App.jsx`)
- Delete: `src/DataService.jsx` (replaced by engine modules)
- Delete: `src/theme.js` (replaced by `src/ui/DesignSystem.js`)
- Delete: `src/LiveFeedTab.jsx` (replaced by `src/ui/LiveFeed.jsx`)
- Delete: `src/PatternsTab.jsx` (replaced by `src/ui/PatternsView.jsx`)

**Step 1: Delete old files**

```bash
git rm src/App.jsx src/DataService.jsx src/theme.js src/LiveFeedTab.jsx src/PatternsTab.jsx
```

**Step 2: Verify zero Valor references**

Run: `grep -ri "valor" --include="*.{js,jsx,py,md,html,json,yml,sh}" .`
Expected: No matches (or only in git history / node_modules)

**Step 3: Run build to verify no broken imports**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
cleanup: remove old monolithic files, verify zero Valor references

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Verify and fix build

**Step 1: Install dependencies and build**

Run: `npm ci && npm run build`

If there are import errors, fix them. Common issues:
- `main.jsx` import path (should be `./ui/App.jsx`)
- Engine modules importing from each other (circular deps)
- Domain config importing syntax

**Step 2: Run dev server and visually verify**

Run: `npm run dev`

Check each tab loads, signals display, feeds fetch, classification works.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve build issues from restructure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Update package-lock.json and final verification

**Step 1: Regenerate lock file**

Run: `npm install` (to update package-lock.json with new package name)

**Step 2: Final grep for Valor**

Run: `grep -ri "valor" --include="*.{js,jsx,py,md,html,yml,sh}" . | grep -v node_modules | grep -v ".git/"`
Expected: Zero matches

**Step 3: Final build**

Run: `npm run build`
Expected: Clean build, no warnings

**Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: final verification, clean build, zero Valor references

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
