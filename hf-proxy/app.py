"""
JtechAi Intelligence — Full-stack HF Space.

Serves the dashboard frontend at / and live data at /api/*.
One URL. One deployment. No CORS. Everything works.

  /              — The intelligence dashboard (React SPA)
  /api/feeds     — Aggregated RSS feeds, classified as effect/event
  /api/prices    — Real-time commodity prices (Brent, WTI, OVX)
  /api/historical/{ticker} — Historical OHLCV + 12 technicals (1d TTL)
  /api/metadata/{ticker}   — Ticker metadata (7d TTL)
  /api/sentiment/{ticker}  — News sentiment records via Google News RSS (1h TTL)
  /api/health    — Service status
  /api/lmstudio/* — LM Studio SANS (Sovereign Agent Node System) endpoints
"""

import os
import sys
import time
import re
import math
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import feedparser
import yfinance as yf
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Add launcher to path for SANS import
sys.path.insert(0, str(Path(__file__).parent.parent))

app = FastAPI(title="JtechAi Intelligence", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ─── STATIC FRONTEND ─────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"

# ─── CONFIGURATION ────────────────────────────────────────────
FEED_SOURCES = [
    {"id": "google-hormuz", "name": "Google News — Hormuz",
     "url": "https://news.google.com/rss/search?q=strait+of+hormuz+oil+tanker&hl=en-US&gl=US&ceid=US:en",
     "category": "maritime", "priority": 1},
    {"id": "google-iran-oil", "name": "Google News — Iran Oil",
     "url": "https://news.google.com/rss/search?q=iran+oil+sanctions+energy&hl=en-US&gl=US&ceid=US:en",
     "category": "macro", "priority": 1},
    {"id": "google-crude-oil", "name": "Google News — Crude Oil",
     "url": "https://news.google.com/rss/search?q=crude+oil+brent+wti+price&hl=en-US&gl=US&ceid=US:en",
     "category": "price", "priority": 1},
    {"id": "google-tanker-shipping", "name": "Google News — Tanker Shipping",
     "url": "https://news.google.com/rss/search?q=tanker+shipping+VLCC+freight+rates&hl=en-US&gl=US&ceid=US:en",
     "category": "maritime", "priority": 2},
    {"id": "google-oil-supply", "name": "Google News — Oil Supply",
     "url": "https://news.google.com/rss/search?q=oil+production+rig+count+EIA+SPR&hl=en-US&gl=US&ceid=US:en",
     "category": "supply", "priority": 2},
    {"id": "eia-twip", "name": "EIA — This Week in Petroleum",
     "url": "https://www.eia.gov/petroleum/weekly/includes/twip_rss.xml",
     "category": "supply", "priority": 2},
    {"id": "gcaptain", "name": "gCaptain — Maritime News",
     "url": "https://gcaptain.com/feed/",
     "category": "maritime", "priority": 2},
    {"id": "maritime-exec", "name": "The Maritime Executive",
     "url": "https://maritime-executive.com/rss",
     "category": "maritime", "priority": 3},
    {"id": "oilprice", "name": "OilPrice.com",
     "url": "https://oilprice.com/rss/main",
     "category": "price", "priority": 3},
]

COMMODITY_SYMBOLS = {
    "brent": "BZ=F",
    "wti": "CL=F",
    "ovx": "^OVX",
}

# ─── CACHING ──────────────────────────────────────────────────
_cache = {}

def get_cached(key, ttl_seconds):
    entry = _cache.get(key)
    if not entry:
        return None
    if time.time() - entry["stored_at"] > ttl_seconds:
        return None
    return entry["data"]

def set_cache(key, data):
    _cache[key] = {"data": data, "stored_at": time.time()}


# ─── KEYWORD CLASSIFICATION ──────────────────────────────────
WORD_BOUNDARY_SET = {"if", "may", "says", "ais", "spr", "duc", "bbl"}

EFFECT_KEYWORDS = [
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
]

EVENT_KEYWORDS = [
    "announced", "predicted", "analysts say", "expected", "could", "might",
    "sources say", "reportedly", "sentiment", "fears", "hopes", "rally",
    "tumble", "surge", "plunge", "breaking", "rumor", "speculation",
    "believes", "opinion", "according to", "may", "possibly", "likely",
    "forecast", "projected", "risk of", "warns", "caution", "concerned",
    "worried", "optimistic", "pessimistic", "bullish", "bearish", "mood",
    "says", "thinks", "suggests", "imagine", "if",
]

CHAIN_TERMS = {
    "Maritime Insurance Cascade": ["insurance", "p&i", "coverage", "withdrawn", "reinsurance", "premium", "hull", "war risk", "club", "lloyd"],
    "Physical Flow Cascade": ["transit", "ais", "tanker", "vessel", "stranded", "vlcc", "freight", "pipeline", "tonnage", "loading", "cargo", "draft", "hormuz", "strait", "shipping", "blockade"],
    "Price Architecture Cascade": ["brent", "wti", "spread", "backwardation", "curve", "netback", "breakeven", "ovx", "futures", "contango", "oil price", "crude price", "barrel"],
    "Supply Constraint Cascade": ["rig count", "duc", "production", "bpd", "capacity", "frac", "drilling", "completions", "shut-in", "spr", "reserve", "opec", "output"],
}

def matches_keyword(text_lower, keyword):
    if keyword in WORD_BOUNDARY_SET:
        return bool(re.search(rf"\b{re.escape(keyword)}\b", text_lower))
    return keyword in text_lower

def classify_text(text):
    if not text:
        return {"classification": "MIXED", "score": 0, "effectHits": [], "eventHits": [], "chainMap": [], "confidence": 0}
    lower = text.lower()
    effect_hits = [k for k in EFFECT_KEYWORDS if matches_keyword(lower, k)]
    event_hits = [k for k in EVENT_KEYWORDS if matches_keyword(lower, k)]
    total = len(effect_hits) + len(event_hits)
    score = (len(effect_hits) - len(event_hits)) / total if total > 0 else 0
    chains = [name for name, terms in CHAIN_TERMS.items() if any(matches_keyword(lower, t) for t in terms)]
    return {
        "classification": "EFFECT" if score > 0.15 else ("EVENT" if score < -0.15 else "MIXED"),
        "score": round(score, 3),
        "effectHits": effect_hits,
        "eventHits": event_hits,
        "chainMap": chains,
        "confidence": min(100, round((total / 8) * 100)) if total > 0 else 0,
    }


# ─── FEED ENDPOINT ────────────────────────────────────────────
@app.get("/api/feeds")
async def get_feeds():
    cached = get_cached("feeds", 180)  # 3 min TTL
    if cached:
        return JSONResponse({**cached, "source": "cached"})

    all_items = []
    source_status = {}

    for src in sorted(FEED_SOURCES, key=lambda s: s["priority"]):
        try:
            feed = feedparser.parse(src["url"])
            entries = feed.entries[:8]
            if not entries:
                source_status[src["id"]] = {"ok": False, "error": "Empty feed"}
                continue
            source_status[src["id"]] = {"ok": True, "count": len(entries)}
            for entry in entries:
                title = getattr(entry, "title", "") or ""
                desc = getattr(entry, "summary", "") or ""
                desc = re.sub(r"<[^>]*>", "", desc).strip()
                link = getattr(entry, "link", "") or ""
                pub = getattr(entry, "published", "") or ""
                classification = classify_text(title + " " + desc)
                all_items.append({
                    "title": title,
                    "description": desc[:500],
                    "link": link,
                    "pubDate": pub,
                    "source": src["name"],
                    "sourceId": src["id"],
                    "category": src["category"],
                    **classification,
                })
        except Exception as e:
            source_status[src["id"]] = {"ok": False, "error": str(e)[:100]}

    # Sort by date, deduplicate
    def safe_ts(item):
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(item["pubDate"]).timestamp()
        except Exception:
            return 0
    all_items.sort(key=safe_ts, reverse=True)

    seen = set()
    deduped = []
    for item in all_items:
        key = re.sub(r"[^a-z0-9]", "", item["title"].lower())[:60]
        if key not in seen:
            seen.add(key)
            deduped.append(item)

    payload = {
        "items": deduped,
        "sourceStatus": source_status,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "liveCount": sum(1 for s in source_status.values() if s.get("ok")),
        "totalSources": len(FEED_SOURCES),
        "source": "live" if deduped else "unavailable",
    }
    if deduped:
        set_cache("feeds", payload)
    return JSONResponse(payload)


# ─── PRICE ENDPOINT ───────────────────────────────────────────
@app.get("/api/prices")
async def get_prices():
    cached = get_cached("prices", 120)  # 2 min TTL
    if cached:
        return JSONResponse({**cached, "source": "cached"})

    prices = {}
    now = datetime.now(timezone.utc).isoformat()

    for name, symbol in COMMODITY_SYMBOLS.items():
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            price = getattr(info, "last_price", None)
            if price is not None and not math.isnan(price):
                prices[name] = {
                    "price": round(float(price), 2),
                    "source": "live",
                    "fetchedAt": now,
                }
        except Exception:
            pass

    # Derived values
    if "brent" in prices and "wti" in prices:
        prices["spread"] = {
            "price": round(prices["brent"]["price"] - prices["wti"]["price"], 2),
            "source": "derived",
            "fetchedAt": now,
        }
        prices["kcposted"] = {
            "price": round(prices["wti"]["price"] - 13.25, 2),
            "source": "derived",
            "fetchedAt": now,
        }

    payload = {
        "prices": prices,
        "fetchedAt": now,
        "liveCount": sum(1 for p in prices.values() if p.get("source") == "live"),
        "source": "live" if prices else "unavailable",
    }
    if prices:
        set_cache("prices", payload)
    return JSONResponse(payload)


# ─── HEALTH ───────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── HISTORICAL / METADATA CACHE ─────────────────────────────
_hist_cache = {}

HIST_TTL = 86400       # 1 day — closed candles are immutable
META_TTL = 86400 * 7   # 7 days

def get_hist_cached(key, ttl_seconds):
    entry = _hist_cache.get(key)
    if not entry:
        return None
    if time.time() - entry["stored_at"] > ttl_seconds:
        return None
    return entry["data"]

def set_hist_cache(key, data):
    _hist_cache[key] = {"data": data, "stored_at": time.time()}


# ─── TECHNICAL INDICATORS (pure pandas/numpy, no ta-lib) ─────
def _clean(arr):
    """Replace NaN/Inf with 0.0, round to 6 decimals."""
    out = np.where(np.isfinite(arr), arr, 0.0)
    return [round(float(v), 6) for v in out]

def _ema(series, span):
    return series.ewm(span=span, adjust=False).mean()

def _wilder_smooth(series, period):
    """Wilder's smoothing (equivalent to EMA with alpha=1/period)."""
    return series.ewm(alpha=1.0 / period, adjust=False).mean()

def compute_technicals(df):
    """Compute 12 technical indicator arrays from a yfinance OHLCV DataFrame."""
    close = df["Close"].astype(float)
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    volume = df["Volume"].astype(float)
    n = len(close)

    # --- RSI(14) — Wilder smoothing ---
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_gain = _wilder_smooth(gain, 14)
    avg_loss = _wilder_smooth(loss, 14)
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100.0 - 100.0 / (1.0 + rs)

    # --- MACD histogram — EMA(12)-EMA(26), signal=EMA(9), hist=MACD-signal ---
    ema12 = _ema(close, 12)
    ema26 = _ema(close, 26)
    macd_line = ema12 - ema26
    macd_signal = _ema(macd_line, 9)
    macd_hist = macd_line - macd_signal

    # --- Bollinger Bands — SMA(20) ± 2*std(20) ---
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2.0 * std20
    bb_lower = sma20 - 2.0 * std20
    bb_range = bb_upper - bb_lower
    bband_pctb = (close - bb_lower) / bb_range.replace(0, np.nan)
    bband_width = bb_range / sma20.replace(0, np.nan)

    # --- Volume ratio — volume / SMA(20, volume) ---
    vol_sma20 = volume.rolling(20).mean()
    volume_ratio = volume / vol_sma20.replace(0, np.nan)

    # --- OBV slope — polyfit(range, OBV, 1)[0] over 20-day rolling ---
    sign = np.sign(close.diff()).fillna(0.0)
    obv = (sign * volume).cumsum()
    obv_slope = pd.Series(np.nan, index=close.index)
    obv_vals = obv.values
    for i in range(19, n):
        window = obv_vals[i - 19 : i + 1]
        if np.all(np.isfinite(window)):
            x = np.arange(20, dtype=float)
            coeffs = np.polyfit(x, window, 1)
            obv_slope.iloc[i] = coeffs[0]

    # --- MFI(14) — Money Flow Index ---
    typical = (high + low + close) / 3.0
    raw_mf = typical * volume
    mf_delta = typical.diff()
    pos_mf = pd.Series(np.where(mf_delta > 0, raw_mf, 0.0), index=close.index)
    neg_mf = pd.Series(np.where(mf_delta < 0, raw_mf, 0.0), index=close.index)
    pos_sum = pos_mf.rolling(14).sum()
    neg_sum = neg_mf.rolling(14).sum()
    mf_ratio = pos_sum / neg_sum.replace(0, np.nan)
    mfi = 100.0 - 100.0 / (1.0 + mf_ratio)

    # --- SMA distances — (close - SMA) / SMA * 100 ---
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean()
    sma50_dist = (close - sma50) / sma50.replace(0, np.nan) * 100.0
    sma200_dist = (close - sma200) / sma200.replace(0, np.nan) * 100.0

    # --- ATR percentile — ATR(14) then 60-day percentile rank ---
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = _wilder_smooth(tr, 14)
    atr_pctile = atr.rolling(60).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100.0 if len(x) == 60 else np.nan,
        raw=False,
    )

    # --- Drawdown — (close - rolling_252_high) / rolling_252_high * 100 ---
    rolling_high_252 = close.rolling(252, min_periods=1).max()
    drawdown = (close - rolling_high_252) / rolling_high_252.replace(0, np.nan) * 100.0

    # --- ADX(14) — DI+, DI-, DX, then EMA(14, DX) ---
    up_move = high.diff()
    down_move = -low.diff()
    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0), index=close.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0), index=close.index)
    smooth_atr = _wilder_smooth(tr, 14)
    plus_di = 100.0 * _wilder_smooth(plus_dm, 14) / smooth_atr.replace(0, np.nan)
    minus_di = 100.0 * _wilder_smooth(minus_dm, 14) / smooth_atr.replace(0, np.nan)
    dx = (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan) * 100.0
    adx = _wilder_smooth(dx, 14)

    return {
        "rsi": _clean(rsi.values),
        "macd_hist": _clean(macd_hist.values),
        "bband_pctb": _clean(bband_pctb.values),
        "bband_width": _clean(bband_width.values),
        "volume_ratio": _clean(volume_ratio.values),
        "obv_slope": _clean(obv_slope.values),
        "mfi": _clean(mfi.values),
        "sma50_dist": _clean(sma50_dist.values),
        "sma200_dist": _clean(sma200_dist.values),
        "atr_pctile": _clean(atr_pctile.values),
        "drawdown": _clean(drawdown.values),
        "adx": _clean(adx.values),
    }


# ─── HISTORICAL OHLCV + TECHNICALS ──────────────────────────
@app.get("/api/historical/{ticker}")
async def get_historical(ticker: str, period: str = "1y", interval: str = "1d"):
    cache_key = f"hist:{ticker}:{period}:{interval}"
    cached = get_hist_cached(cache_key, HIST_TTL)
    if cached:
        return JSONResponse({**cached, "source": "cached"})

    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval=interval)
    except Exception as e:
        return JSONResponse({"error": f"Failed to fetch data: {str(e)[:200]}"}, status_code=500)

    if df is None or df.empty:
        return JSONResponse({"error": f"No data found for ticker '{ticker}'"}, status_code=404)

    # Build OHLCV list
    ohlcv = []
    for idx, row in df.iterrows():
        date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)
        ohlcv.append({
            "date": date_str,
            "open": round(float(row["Open"]), 6) if np.isfinite(row["Open"]) else 0.0,
            "high": round(float(row["High"]), 6) if np.isfinite(row["High"]) else 0.0,
            "low": round(float(row["Low"]), 6) if np.isfinite(row["Low"]) else 0.0,
            "close": round(float(row["Close"]), 6) if np.isfinite(row["Close"]) else 0.0,
            "volume": int(row["Volume"]) if np.isfinite(row["Volume"]) else 0,
        })

    # Compute technicals
    try:
        technicals = compute_technicals(df)
    except Exception as e:
        technicals = {"error": f"Technical computation failed: {str(e)[:200]}"}

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "ticker": ticker.upper(),
        "period": period,
        "interval": interval,
        "ohlcv": ohlcv,
        "technicals": technicals,
        "fetchedAt": now,
        "source": "live",
    }
    set_hist_cache(cache_key, payload)
    return JSONResponse(payload)


# ─── TICKER METADATA ────────────────────────────────────────
@app.get("/api/metadata/{ticker}")
async def get_metadata(ticker: str):
    cache_key = f"meta:{ticker}"
    cached = get_hist_cached(cache_key, META_TTL)
    if cached:
        return JSONResponse({**cached, "source": "cached"})

    try:
        t = yf.Ticker(ticker)
        info = t.info
    except Exception as e:
        return JSONResponse({"error": f"Failed to fetch metadata: {str(e)[:200]}"}, status_code=500)

    if not info or info.get("regularMarketPrice") is None and info.get("shortName") is None:
        return JSONResponse({"error": f"No metadata found for ticker '{ticker}'"}, status_code=404)

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "ticker": ticker.upper(),
        "name": info.get("shortName") or info.get("longName") or "Unknown",
        "sector": info.get("sector") or "Unknown",
        "industry": info.get("industry") or "Unknown",
        "exchange": info.get("exchange") or "Unknown",
        "marketCap": info.get("marketCap"),
        "description": info.get("longBusinessSummary") or "",
        "fetchedAt": now,
        "source": "live",
    }
    set_hist_cache(cache_key, payload)
    return JSONResponse(payload)


# ─── SENTIMENT (Google News RSS by ticker) ───────────────────
SENTIMENT_TTL = 3600  # 1 hour — news changes more frequently

@app.get("/api/sentiment/{ticker}")
async def get_sentiment(ticker: str, days: int = 7):
    cache_key = f"sentiment:{ticker}:{days}"
    cached = get_hist_cached(cache_key, SENTIMENT_TTL)
    if cached:
        return JSONResponse({**cached, "source": "cached"})

    records = []
    source_status = {}

    # Source 1: Google News RSS filtered by ticker
    news_url = f"https://news.google.com/rss/search?q={ticker}+stock&hl=en-US&gl=US&ceid=US:en"
    try:
        feed = feedparser.parse(news_url)
        entries = feed.entries[:20]
        if entries:
            source_status["google_news"] = {"ok": True, "count": len(entries)}
            for entry in entries:
                title = getattr(entry, "title", "") or ""
                desc = getattr(entry, "summary", "") or ""
                desc = re.sub(r"<[^>]*>", "", desc).strip()
                pub = getattr(entry, "published", "") or ""
                records.append({
                    "text": f"{title}. {desc}",
                    "source": "google_news",
                    "timestamp": pub,
                })
        else:
            source_status["google_news"] = {"ok": False, "error": "Empty feed"}
    except Exception as e:
        source_status["google_news"] = {"ok": False, "error": str(e)[:100]}

    # Source 2: Google News RSS for company/sector context
    try:
        meta_key = f"meta:{ticker}"
        meta = get_hist_cached(meta_key, ttl_seconds=604800)
        company_name = None
        if meta:
            company_name = meta.get("name", "").split(" ")[0]  # First word of company name

        if company_name and len(company_name) > 2:
            context_url = f"https://news.google.com/rss/search?q={company_name}+financial&hl=en-US&gl=US&ceid=US:en"
            feed2 = feedparser.parse(context_url)
            entries2 = feed2.entries[:10]
            if entries2:
                source_status["google_context"] = {"ok": True, "count": len(entries2)}
                for entry in entries2:
                    title = getattr(entry, "title", "") or ""
                    desc = getattr(entry, "summary", "") or ""
                    desc = re.sub(r"<[^>]*>", "", desc).strip()
                    pub = getattr(entry, "published", "") or ""
                    records.append({
                        "text": f"{title}. {desc}",
                        "source": "google_context",
                        "timestamp": pub,
                    })
    except Exception:
        pass

    # Deduplicate by title similarity
    seen = set()
    deduped = []
    for rec in records:
        key = re.sub(r"[^a-z0-9]", "", rec["text"].lower())[:80]
        if key not in seen:
            seen.add(key)
            deduped.append(rec)

    payload = {
        "ticker": ticker.upper(),
        "records": deduped,
        "sourceStatus": source_status,
        "recordCount": len(deduped),
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": "live" if deduped else "unavailable",
    }
    if deduped:
        set_hist_cache(cache_key, payload)
    return JSONResponse(payload)


# ─── SERVE FRONTEND (SPA) ─────────────────────────────────────
if STATIC_DIR.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Try exact file first (favicon, etc.)
        file_path = STATIC_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html (SPA routing)
        return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
