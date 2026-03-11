import { useState, useEffect, useCallback, useMemo } from "react";
import { COLORS, FONTS } from "./DesignSystem.js";
import { analyzeTickerFromBackend } from "../engine/market-data.js";
import SectorView from "./SectorView.jsx";

// ================================================================
// REGIME BADGE COLORS — matches Header.jsx palette
// ================================================================

const REGIME_COLORS = {
  "STABLE": COLORS.green,
  "TRANSIENT SPIKE": COLORS.orange,
  "BOUNDARY LAYER": COLORS.orange,
  "CRISIS CONSOLIDATION": COLORS.red,
  "NO DATA": COLORS.textMuted,
};

// ================================================================
// SORT HELPERS
// ================================================================

function getSortValue(result, col) {
  if (!result) return null;
  switch (col) {
    case "ticker": return result.ticker;
    case "price": return result.price;
    case "regime": return result.regime?.label || "";
    case "gini": return result.gini;
    case "mean": return result.mean;
    case "trajectory": return result.trajectory || "";
    case "alert": return result.alertLevel;
    default: return null;
  }
}

function compareValues(a, b, ascending) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" && typeof b === "string") {
    return ascending ? a.localeCompare(b) : b.localeCompare(a);
  }
  return ascending ? a - b : b - a;
}

// ================================================================
// TRAJECTORY LABEL — derived from regime + gini + mean
// ================================================================

function computeTrajectory(result) {
  if (!result || !result.regime) return "";
  const label = result.regime.label || "";
  const gini = result.gini || 0;
  const mean = result.mean || 0;

  if (label === "CRISIS CONSOLIDATION") return "RISK";
  if (label === "TRANSIENT SPIKE" && mean > 2.5) return "ELEVATED";
  if (label === "BOUNDARY LAYER") return "TRANSITIONING";
  if (label === "STABLE" && gini > 0.3) return "DIVERGING";
  if (label === "STABLE") return "NORMAL";
  return "";
}

// ================================================================
// ALERT LEVEL — numeric severity for sorting + display
// ================================================================

function computeAlertLevel(result) {
  if (!result || !result.regime) return 0;
  const label = result.regime.label || "";
  if (label === "CRISIS CONSOLIDATION") return 3;
  if (label === "TRANSIENT SPIKE") return 2;
  if (label === "BOUNDARY LAYER") return 1;
  return 0;
}

const ALERT_LABELS = ["", "WATCH", "ALERT", "CRITICAL"];
const ALERT_COLORS = [COLORS.textMuted, COLORS.gold, COLORS.orange, COLORS.red];

// ================================================================
// WATCHLIST VIEW COMPONENT
// ================================================================

export default function WatchlistView({ onSelectTicker, backendUrl = "" }) {
  // ── Watchlist state ──────────────────────────────────────────
  const [tickers, setTickers] = useState(() => {
    try {
      const saved = localStorage.getItem("jtech-watchlist");
      return saved ? JSON.parse(saved) : ["SPY", "AAPL", "NVDA"];
    } catch {
      return ["SPY", "AAPL", "NVDA"];
    }
  });

  const [addInput, setAddInput] = useState("");
  const [results, setResults] = useState({});  // ticker -> { data, loading, error }
  const [sortCol, setSortCol] = useState("ticker");
  const [sortAsc, setSortAsc] = useState(true);

  // ── Persist watchlist ────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("jtech-watchlist", JSON.stringify(tickers));
  }, [tickers]);

  // ── Analyze a single ticker ──────────────────────────────────
  const analyzeTicker = useCallback(async (t) => {
    setResults(prev => ({
      ...prev,
      [t]: { ...prev[t], loading: true, error: null },
    }));

    try {
      const data = await analyzeTickerFromBackend(t, { backendUrl });
      const lastPrice = data.ohlcv && data.ohlcv.length > 0
        ? data.ohlcv[data.ohlcv.length - 1].close
        : null;

      const row = {
        ticker: t,
        sector: data.metadata?.sector || data.config?.sector || "Unknown",
        price: lastPrice,
        regime: data.regime,
        gini: data.gini,
        mean: data.mean,
        coherence: data.coherence,
      };
      row.trajectory = computeTrajectory(row);
      row.alertLevel = computeAlertLevel(row);

      setResults(prev => ({
        ...prev,
        [t]: { data: row, loading: false, error: null },
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [t]: { data: prev[t]?.data || null, loading: false, error: err.message },
      }));
    }
  }, [backendUrl]);

  // ── Fetch all on mount and when tickers change ───────────────
  useEffect(() => {
    tickers.forEach(t => {
      if (!results[t]) {
        analyzeTicker(t);
      }
    });
  }, [tickers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh all ──────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    tickers.forEach(t => analyzeTicker(t));
  }, [tickers, analyzeTicker]);

  // ── Add ticker ───────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    const t = addInput.trim().toUpperCase();
    if (t && !tickers.includes(t)) {
      setTickers(prev => [...prev, t]);
      setAddInput("");
      // Analysis will trigger via the useEffect above
    }
  }, [addInput, tickers]);

  // ── Remove ticker ────────────────────────────────────────────
  const handleRemove = useCallback((t) => {
    setTickers(prev => prev.filter(x => x !== t));
    setResults(prev => {
      const next = { ...prev };
      delete next[t];
      return next;
    });
  }, []);

  // ── Sort handler ─────────────────────────────────────────────
  const handleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev === col) {
        setSortAsc(a => !a);
        return col;
      }
      setSortAsc(true);
      return col;
    });
  }, []);

  // ── Sorted rows ──────────────────────────────────────────────
  const sortedTickers = [...tickers].sort((a, b) => {
    const ra = results[a]?.data;
    const rb = results[b]?.data;
    const va = ra ? getSortValue(ra, sortCol) : null;
    const vb = rb ? getSortValue(rb, sortCol) : null;
    return compareValues(va, vb, sortAsc);
  });

  // ── Sector data for SectorView ──────────────────────────────
  const sectorData = useMemo(() => {
    return tickers
      .map(t => results[t]?.data)
      .filter(d => d && d.regime)
      .map(d => ({
        ticker: d.ticker,
        sector: d.sector || "Unknown",
        regime: d.regime?.label || d.regime || "",
        gini: d.gini,
        mean: d.mean,
        coherence: d.coherence,
      }));
  }, [tickers, results]);

  // ── Column definitions ───────────────────────────────────────
  const COLUMNS = [
    { id: "ticker", label: "TICKER", width: 90, align: "left" },
    { id: "price", label: "PRICE", width: 100, align: "right" },
    { id: "regime", label: "REGIME", width: 180, align: "left" },
    { id: "gini", label: "GINI", width: 80, align: "right" },
    { id: "mean", label: "MEAN", width: 80, align: "right" },
    { id: "trajectory", label: "TRAJECTORY", width: 130, align: "left" },
    { id: "alert", label: "ALERT", width: 100, align: "center" },
  ];

  // ── Styles ───────────────────────────────────────────────────
  const headerCellStyle = (col) => ({
    padding: "0 12px",
    height: 32,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: sortCol === col.id ? COLORS.gold : COLORS.textMuted,
    textAlign: col.align,
    width: col.width,
    cursor: "pointer",
    userSelect: "none",
    fontFamily: FONTS.body,
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${COLORS.border}`,
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* ── Toolbar: add ticker + refresh ──────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 11,
          color: COLORS.textMuted,
          letterSpacing: 2,
          fontWeight: 700,
          fontFamily: FONTS.body,
        }}>
          WATCHLIST
        </span>
        <input
          type="text"
          value={addInput}
          onChange={e => setAddInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Add ticker..."
          style={{
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            color: COLORS.text,
            padding: "6px 12px",
            fontSize: 12,
            fontFamily: FONTS.body,
            fontWeight: 700,
            letterSpacing: 1.5,
            width: 110,
            outline: "none",
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!addInput.trim()}
          style={{
            background: COLORS.gold,
            border: "none",
            borderRadius: 4,
            color: COLORS.bg,
            padding: "6px 14px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            fontFamily: FONTS.body,
            cursor: addInput.trim() ? "pointer" : "default",
            opacity: addInput.trim() ? 1 : 0.4,
          }}
        >
          ADD
        </button>
        <button
          onClick={refreshAll}
          style={{
            background: "transparent",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            color: COLORS.textDim,
            padding: "6px 14px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            fontFamily: FONTS.body,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          REFRESH ALL
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div style={{
        background: COLORS.surface,
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          {COLUMNS.map(col => (
            <button
              key={col.id}
              onClick={() => handleSort(col.id)}
              style={headerCellStyle(col)}
            >
              {col.label}
              {sortCol === col.id && (
                <span style={{ marginLeft: 4, fontSize: 8 }}>
                  {sortAsc ? "\u25B2" : "\u25BC"}
                </span>
              )}
            </button>
          ))}
          {/* Spacer for remove button column */}
          <div style={{ width: 40 }} />
        </div>

        {/* Data rows */}
        {sortedTickers.length === 0 && (
          <div style={{
            padding: "32px 12px",
            textAlign: "center",
            color: COLORS.textMuted,
            fontSize: 12,
          }}>
            No tickers in watchlist. Add one above.
          </div>
        )}
        {sortedTickers.map(t => {
          const entry = results[t];
          const data = entry?.data;
          const loading = entry?.loading;
          const error = entry?.error;
          const regimeLabel = data?.regime?.label || "";
          const regimeColor = REGIME_COLORS[regimeLabel] || COLORS.textMuted;
          const alertLevel = data?.alertLevel || 0;

          return (
            <div
              key={t}
              onClick={() => onSelectTicker && onSelectTicker(t)}
              style={{
                display: "flex",
                alignItems: "center",
                height: 36,
                cursor: "pointer",
                borderBottom: `1px solid ${COLORS.border}`,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = COLORS.surfaceHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Ticker */}
              <div style={{
                width: 90,
                padding: "0 12px",
                fontSize: 13,
                fontWeight: 700,
                color: COLORS.gold,
                letterSpacing: 1,
                fontFamily: FONTS.body,
              }}>
                {t}
              </div>

              {/* Price */}
              <div style={{
                width: 100,
                padding: "0 12px",
                fontSize: 12,
                fontFamily: "monospace",
                color: COLORS.text,
                textAlign: "right",
              }}>
                {loading && !data ? (
                  <span style={{ color: COLORS.textMuted, fontSize: 10 }}>...</span>
                ) : data?.price != null ? (
                  `$${data.price.toFixed(2)}`
                ) : error ? (
                  <span style={{ color: COLORS.red, fontSize: 10 }}>ERR</span>
                ) : (
                  "\u2014"
                )}
              </div>

              {/* Regime */}
              <div style={{
                width: 180,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {loading && !data ? (
                  <span style={{ color: COLORS.textMuted, fontSize: 10, letterSpacing: 1 }}>
                    LOADING...
                  </span>
                ) : regimeLabel ? (
                  <>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: regimeColor,
                      boxShadow: `0 0 4px ${regimeColor}80`,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      color: regimeColor,
                    }}>
                      {regimeLabel}
                    </span>
                  </>
                ) : error ? (
                  <span style={{ color: COLORS.red, fontSize: 10, letterSpacing: 0.5 }}>
                    {error.length > 30 ? error.slice(0, 30) + "..." : error}
                  </span>
                ) : (
                  <span style={{ color: COLORS.textMuted, fontSize: 10 }}>{"\u2014"}</span>
                )}
              </div>

              {/* Gini */}
              <div style={{
                width: 80,
                padding: "0 12px",
                fontSize: 12,
                fontFamily: "monospace",
                color: COLORS.text,
                textAlign: "right",
              }}>
                {data?.gini != null ? data.gini.toFixed(3) : "\u2014"}
              </div>

              {/* Mean */}
              <div style={{
                width: 80,
                padding: "0 12px",
                fontSize: 12,
                fontFamily: "monospace",
                color: COLORS.text,
                textAlign: "right",
              }}>
                {data?.mean != null ? data.mean.toFixed(2) : "\u2014"}
              </div>

              {/* Trajectory */}
              <div style={{
                width: 130,
                padding: "0 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                color: data?.trajectory === "RISK" ? COLORS.red
                  : data?.trajectory === "ELEVATED" ? COLORS.orange
                  : data?.trajectory === "TRANSITIONING" ? COLORS.orange
                  : data?.trajectory === "DIVERGING" ? COLORS.gold
                  : COLORS.textDim,
              }}>
                {data?.trajectory || "\u2014"}
              </div>

              {/* Alert */}
              <div style={{
                width: 100,
                padding: "0 12px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                color: ALERT_COLORS[alertLevel],
              }}>
                {alertLevel > 0 ? ALERT_LABELS[alertLevel] : "\u2014"}
              </div>

              {/* Remove button */}
              <div
                style={{
                  width: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={e => {
                  e.stopPropagation();
                  handleRemove(t);
                }}
              >
                <span style={{
                  fontSize: 14,
                  color: COLORS.textMuted,
                  cursor: "pointer",
                  lineHeight: 1,
                  transition: "color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = COLORS.red; }}
                  onMouseLeave={e => { e.currentTarget.style.color = COLORS.textMuted; }}
                >
                  {"\u00D7"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer note ────────────────────────────────────────── */}
      <div style={{
        marginTop: 12,
        fontSize: 10,
        color: COLORS.textMuted,
        letterSpacing: 0.5,
      }}>
        {tickers.length} ticker{tickers.length !== 1 ? "s" : ""} tracked.
        Click any row to drill into single-ticker regime analysis.
      </div>

      {/* ── Sector Coherence Section ─────────────────────────────── */}
      {sectorData.length >= 2 && (
        <SectorView
          watchlistData={sectorData}
          onSelectTicker={onSelectTicker}
        />
      )}
    </div>
  );
}
