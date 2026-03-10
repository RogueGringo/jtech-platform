import { useState, useMemo, useEffect, useCallback } from "react";
import Header from "./Header.jsx";
import { COLORS, FONTS } from "./DesignSystem.js";
import { computeSeverity, computeCoherence } from "../engine/signals.js";
import { createHistoryBuffer, pushSnapshot, computeActivityState, computeTransitionIntensity, computeGiniTrajectory } from "../engine/dynamics.js";
import { fetchCommodityPrices } from "../engine/prices.js";
import { analyzeTickerFromBackend } from "../engine/market-data.js";
import domainConfig from "../domains/hormuz-iran/config.js";
import * as domainContent from "../domains/hormuz-iran/content.jsx";
import * as marketContent from "../domains/market/content.jsx";
import domainTerms from "../domains/hormuz-iran/terms.js";
import marketTerms from "../domains/market/terms.js";
import universalTerms from "../terms/universal.js";
import ThesisView from "./ThesisView.jsx";
import NodesView from "./NodesView.jsx";
import PatternsView from "./PatternsView.jsx";
import EffectChainView from "./EffectChainView.jsx";
import SignalMonitor from "./SignalMonitor.jsx";
import LiveFeed from "./LiveFeed.jsx";

// ================================================================
// TICKER SEARCH BAR — premium dark input with gold focus accent
// ================================================================

function TickerSearchBar({ onSearch, loading, error }) {
  const [tickerInput, setTickerInput] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSearch = useCallback(() => {
    const trimmed = tickerInput.trim();
    if (trimmed && !loading) {
      onSearch(trimmed);
    }
  }, [tickerInput, loading, onSearch]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 32px",
      background: COLORS.surface,
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <span style={{
        fontSize: 11,
        color: COLORS.textMuted,
        letterSpacing: 2,
        fontWeight: 700,
        fontFamily: FONTS.body,
      }}>
        TICKER
      </span>
      <input
        type="text"
        value={tickerInput}
        onChange={e => setTickerInput(e.target.value.toUpperCase())}
        onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="SPY"
        style={{
          background: COLORS.bg,
          border: `1px solid ${focused ? COLORS.gold : COLORS.border}`,
          borderRadius: 4,
          color: COLORS.text,
          padding: "8px 16px",
          fontSize: 16,
          fontFamily: FONTS.body,
          fontWeight: 700,
          letterSpacing: 2,
          width: 120,
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />
      <button
        onClick={handleSearch}
        disabled={loading || !tickerInput.trim()}
        style={{
          background: loading ? COLORS.border : COLORS.gold,
          border: "none",
          borderRadius: 4,
          color: COLORS.bg,
          padding: "8px 20px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          fontFamily: FONTS.body,
          cursor: loading ? "wait" : "pointer",
          opacity: !tickerInput.trim() ? 0.4 : 1,
          transition: "all 0.2s",
        }}
      >
        {loading ? "ANALYZING..." : "ANALYZE"}
      </button>
      {loading && (
        <span style={{
          fontSize: 11,
          color: COLORS.textMuted,
          letterSpacing: 1,
        }}>
          Fetching data and computing regime topology...
        </span>
      )}
      {error && !loading && (
        <span style={{
          fontSize: 11,
          color: COLORS.red,
          letterSpacing: 0.5,
          maxWidth: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {error}
        </span>
      )}
    </div>
  );
}

// ================================================================
// MAIN APP
// ================================================================

export default function App() {
  // ── Mode state ──────────────────────────────────────────────
  const [mode, setMode] = useState("market"); // "market" | "domain"

  // ── Market mode state ───────────────────────────────────────
  const [ticker, setTicker] = useState("");
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tickerError, setTickerError] = useState("");
  const [marketData, setMarketData] = useState(null);

  // ── Domain mode state (legacy hormuz-iran) ──────────────────
  const [activeTab, setActiveTab] = useState("thesis");
  const [priceStatus, setPriceStatus] = useState("loading");
  const [historyBuffer, setHistoryBuffer] = useState(createHistoryBuffer);

  // ── Derived: active config, signals, content, terms ─────────
  const activeConfig = mode === "market" && marketData
    ? marketData.config
    : domainConfig;

  const activeContent = mode === "market" ? marketContent : domainContent;

  const activeTerms = useMemo(() => {
    if (mode === "market") return { ...universalTerms, ...marketTerms };
    return { ...universalTerms, ...domainTerms };
  }, [mode]);

  // Reset active tab when config changes (market data loads or mode switches)
  useEffect(() => {
    const tabs = activeConfig.tabs || [];
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeConfig, activeTab]);

  // ── Domain mode: signal state with live price updates ───────
  const livePriceIds = useMemo(() => new Set(domainConfig.livePriceIds || []), []);

  const [domainSignals, setDomainSignals] = useState(() =>
    (domainConfig.signals || []).map(s => ({
      ...s,
      dataSource: livePriceIds.has(s.id) ? "pending" : "reference",
      lastUpdate: null,
    }))
  );

  const domainBaselineSignals = useMemo(() => domainConfig.signals || [], []);
  const domainCategoryKeys = useMemo(() => Object.keys(domainConfig.categories || {}), []);

  // Fetch commodity prices for domain mode
  useEffect(() => {
    if (mode !== "domain") return;
    let cancelled = false;
    async function fetchPrices() {
      try {
        const data = await fetchCommodityPrices(domainConfig.priceSymbols || {}, domainConfig.derivedPrices || {});
        if (cancelled) return;
        setPriceStatus(data.source);
        if (data.source === "live" || data.source === "cached") {
          setDomainSignals(prev => prev.map(s => {
            const priceInfo = data.prices[s.id];
            if (!priceInfo || priceInfo.price === undefined) return s;
            const newNumeric = priceInfo.price;
            let formatted;
            if (s.unit === "/bbl" || s.id === "spread") formatted = "$" + newNumeric.toFixed(2);
            else if (s.unit === "%") formatted = Math.round(newNumeric) + "%";
            else formatted = newNumeric.toFixed(1);
            const newSeverity = computeSeverity(s.id, newNumeric, s.severity, domainConfig.severityThresholds || {});
            return {
              ...s,
              numeric: newNumeric,
              value: formatted,
              severity: newSeverity,
              lastUpdate: new Date(),
              dataSource: priceInfo.source === "live" ? "live" : "derived",
            };
          }));
        }
      } catch {
        if (!cancelled) setPriceStatus("error");
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [mode]);

  // ── Active signals: market data signals or domain signals ───
  const signals = mode === "market" && marketData
    ? marketData.signals
    : domainSignals;

  const categoryKeys = mode === "market" && marketData
    ? Object.keys(marketData.config.categories || {})
    : domainCategoryKeys;

  const baselineSignals = mode === "market" && marketData
    ? marketData.config.signals || []
    : domainBaselineSignals;

  // ── Compute coherence from active signals ───────────────────
  const coherence = useMemo(
    () => computeCoherence(signals, categoryKeys),
    [signals, categoryKeys]
  );

  // Push snapshot to history buffer when signals change
  useEffect(() => {
    setHistoryBuffer(prev => pushSnapshot({ ...prev, snapshots: [...prev.snapshots] }, signals));
  }, [signals]);

  // Compute dynamics from active signals
  const activityState = useMemo(
    () => computeActivityState(signals, historyBuffer, baselineSignals),
    [signals, historyBuffer, baselineSignals]
  );
  const transitionIntensity = useMemo(
    () => computeTransitionIntensity(signals, baselineSignals),
    [signals, baselineSignals]
  );
  const giniTrajectory = useMemo(
    () => computeGiniTrajectory(historyBuffer, signals),
    [historyBuffer, signals]
  );

  // ── Market mode: ticker search handler ──────────────────────
  const handleTickerSearch = useCallback(async (searchTicker) => {
    setTickerLoading(true);
    setTickerError("");
    setTicker(searchTicker);

    try {
      const result = await analyzeTickerFromBackend(searchTicker, {
        backendUrl: "",
        period: "1y",
        interval: "1d",
      });

      setMarketData(result);
      // Reset history buffer for the new ticker
      setHistoryBuffer(createHistoryBuffer());
      // Default to monitor tab to show the regime dashboard
      setActiveTab("monitor");
    } catch (err) {
      const msg = err.message || "Unknown error";
      if (msg.includes("fetch failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setTickerError(
          `Backend unavailable. Start it with: python hf-proxy/app.py`
        );
      } else {
        setTickerError(msg);
      }
      // Don't clear existing marketData — keep the previous result visible
    } finally {
      setTickerLoading(false);
    }
  }, []);

  // ── Mode toggle ─────────────────────────────────────────────
  const handleModeToggle = useCallback(() => {
    setMode(prev => {
      const next = prev === "market" ? "domain" : "market";
      // Reset history on mode switch
      setHistoryBuffer(createHistoryBuffer());
      return next;
    });
  }, []);

  // ── Price status for monitor ────────────────────────────────
  const activePriceStatus = mode === "market"
    ? (marketData ? "computed" : "idle")
    : priceStatus;

  // ── Tab content ─────────────────────────────────────────────
  const tabContent = {
    thesis: <ThesisView config={activeConfig} content={activeContent} terms={activeTerms} />,
    nodes: <NodesView config={activeConfig} content={activeContent} terms={activeTerms} />,
    patterns: <PatternsView config={activeConfig} content={activeContent} terms={activeTerms} signals={signals} transitionIntensity={transitionIntensity} />,
    playbook: <EffectChainView config={activeConfig} content={activeContent} terms={activeTerms} signals={signals} />,
    monitor: <SignalMonitor config={activeConfig} terms={activeTerms} signals={signals} coherence={coherence} priceStatus={activePriceStatus} activityState={activityState} transitionIntensity={transitionIntensity} giniTrajectory={giniTrajectory} />,
    feed: <LiveFeed config={activeConfig} terms={activeTerms} />,
  };

  // ── Market mode: empty state when no ticker searched yet ────
  const marketEmptyState = mode === "market" && !marketData && !tickerLoading && (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "120px 32px",
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 48,
        color: COLORS.gold,
        opacity: 0.15,
        fontWeight: 700,
        marginBottom: 24,
        letterSpacing: -1,
      }}>
        JTECH AI
      </div>
      <p style={{
        fontSize: 15,
        color: COLORS.textDim,
        lineHeight: 1.7,
        maxWidth: 480,
        margin: "0 0 8px",
      }}>
        Enter a ticker symbol above to run topological regime analysis.
        The engine transforms 12 technical indicators into sigma-normalized
        severity signals and classifies the regime from signal geometry.
      </p>
      <p style={{
        fontSize: 12,
        color: COLORS.textMuted,
        margin: 0,
      }}>
        Requires backend: python hf-proxy/app.py
      </p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: FONTS.body }}>
      {mode === "market" && (
        <TickerSearchBar
          onSearch={handleTickerSearch}
          loading={tickerLoading}
          error={tickerError}
        />
      )}
      <Header
        config={activeConfig}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        terms={activeTerms}
        coherence={mode === "market" && !marketData ? null : coherence}
        giniTrajectory={giniTrajectory}
        mode={mode}
        onModeToggle={handleModeToggle}
      />
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {marketEmptyState || tabContent[activeTab] || (
          <div style={{ padding: 32, color: COLORS.textDim }}>Tab not configured.</div>
        )}
      </div>
    </div>
  );
}
