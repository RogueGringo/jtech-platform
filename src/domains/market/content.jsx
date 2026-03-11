/**
 * Market Domain Content — minimal content views for ticker-based analysis.
 *
 * These components replace the Hormuz-Iran domain prose when the app is
 * in "market" mode. Each view gets the dynamic config (from config-factory)
 * and renders market-appropriate content.
 *
 * Exports match the shape expected by ThesisView, NodesView,
 * PatternsView, and EffectChainView — i.e. the same named exports
 * as src/domains/hormuz-iran/content.jsx.
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

import { COLORS, FONTS, SPACING } from "../../ui/DesignSystem.js";

// ─── THESIS CONTENT ──────────────────────────────────────────

export function ThesisContent({ terms = {}, config = {} }) {
  const ticker = config?.name || "Market";
  const sector = config?.sector || "Unknown";
  const industry = config?.industry || "";

  return (
    <div style={{ padding: SPACING.page, maxWidth: 1100 }}>
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, #161a24 100%)`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "32px 36px",
        marginBottom: 28,
      }}>
        <h2 style={{
          fontFamily: FONTS.heading,
          fontSize: 22,
          color: COLORS.gold,
          margin: "0 0 16px",
          fontWeight: 600,
        }}>
          Topological Regime Analysis
        </h2>
        <p style={{
          fontSize: 15,
          color: COLORS.text,
          lineHeight: 1.7,
          margin: "0 0 16px",
        }}>
          This view applies the full signal topology engine to <strong style={{ color: COLORS.gold }}>{ticker}</strong>.
          Twelve technical indicators are transformed into sigma-normalized signals across four semantic
          prime categories — condition, flow, price, and capacity. The Gini coefficient of the resulting
          severity distribution determines the regime quadrant.
        </p>
        {sector !== "Unknown" && (
          <p style={{
            fontSize: 13,
            color: COLORS.textDim,
            lineHeight: 1.6,
            margin: 0,
          }}>
            Sector: {sector}{industry ? ` / ${industry}` : ""}
          </p>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 24,
      }}>
        {[
          {
            title: "Condition",
            color: "#ef4444",
            desc: "Momentum oscillators (RSI, MACD, Bollinger %B) — is the instrument overbought, oversold, or mean-reverting?",
          },
          {
            title: "Flow",
            color: "#f97316",
            desc: "Volume dynamics (Volume Ratio, OBV Slope, MFI) — is money flowing in or draining out?",
          },
          {
            title: "Price",
            color: "#3b82f6",
            desc: "Trend position (SMA50/200 distance, Drawdown) — where is price relative to structural levels?",
          },
          {
            title: "Capacity",
            color: "#8b5cf6",
            desc: "Volatility regime (ATR percentile, Bollinger Width, ADX) — how much energy is in the system?",
          },
        ].map(cat => (
          <div key={cat.title} style={{
            padding: 20,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            borderLeft: `3px solid ${cat.color}`,
          }}>
            <h3 style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              color: cat.color,
              margin: "0 0 8px",
            }}>
              {cat.title.toUpperCase()}
            </h3>
            <p style={{
              fontSize: 13,
              color: COLORS.textDim,
              lineHeight: 1.5,
              margin: 0,
            }}>
              {cat.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NODES CONTENT ───────────────────────────────────────────

/**
 * getNodesCategories returns the signal category breakdown.
 * For market mode this returns a simple 4-category structure
 * matching the market adapter's semantic primes.
 */
export function getNodesCategories() {
  return [
    {
      title: "CONDITION",
      titleColor: "#ef4444",
      description: "Momentum and oscillator signals — RSI, MACD histogram, Bollinger %B",
      nodes: [
        { name: "RSI(14)", id: "mkt_rsi", description: "Momentum oscillator, 0-100 scale. >70 overbought, <30 oversold." },
        { name: "MACD Histogram", id: "mkt_macd", description: "MACD line minus signal line. Positive = bullish momentum." },
        { name: "Bollinger %B", id: "mkt_bbpctb", description: "Price position within Bollinger Bands. 0=lower, 1=upper." },
      ],
    },
    {
      title: "FLOW",
      titleColor: "#f97316",
      description: "Volume-based signals — participation, conviction, money flow",
      nodes: [
        { name: "Volume Ratio", id: "mkt_volratio", description: "Current volume vs 20-day average. >1.5x = surge." },
        { name: "OBV Slope", id: "mkt_obvslope", description: "On-Balance Volume 20-day regression slope. Confirms or diverges from price." },
        { name: "MFI(14)", id: "mkt_mfi", description: "Volume-weighted RSI. >80 overbought, <20 oversold." },
      ],
    },
    {
      title: "PRICE",
      titleColor: "#3b82f6",
      description: "Trend position signals — distance from moving averages, drawdown",
      nodes: [
        { name: "SMA50 Distance", id: "mkt_sma50", description: "Percent distance from 50-day SMA. Positive = above." },
        { name: "SMA200 Distance", id: "mkt_sma200", description: "Percent distance from 200-day SMA. Key structural level." },
        { name: "Drawdown", id: "mkt_drawdown", description: "Peak-to-trough decline from 52-week high." },
      ],
    },
    {
      title: "CAPACITY",
      titleColor: "#8b5cf6",
      description: "Volatility regime signals — energy, bandwidth, trend strength",
      nodes: [
        { name: "ATR Percentile", id: "mkt_atr", description: "Current ATR vs 60-day range. High = expanding volatility." },
        { name: "Bollinger Width", id: "mkt_bbwidth", description: "Band width relative to midline. Squeeze precedes expansion." },
        { name: "ADX(14)", id: "mkt_adx", description: "Trend strength 0-100. >25 trending, <20 range-bound." },
      ],
    },
  ];
}

// ─── PATTERNS CONTENT ────────────────────────────────────────

export function PatternsContent({ terms = {} }) {
  return (
    <div style={{ padding: SPACING.page, maxWidth: 1100 }}>
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 24,
      }}>
        <h3 style={{
          fontFamily: FONTS.heading,
          fontSize: 18,
          color: COLORS.gold,
          margin: "0 0 12px",
        }}>
          Signal Topology
        </h3>
        <p style={{
          fontSize: 13,
          color: COLORS.textDim,
          lineHeight: 1.6,
          margin: 0,
        }}>
          The phase indicator above shows the current position in the Wyckoff cycle
          derived from the 12-signal severity distribution. Accumulation and markup
          phases correspond to low-Gini regimes where signals converge; distribution
          and markdown phases emerge when signal inequality rises and cross-category
          coherence breaks down.
        </p>
      </div>
    </div>
  );
}

// ─── EFFECT CHAIN CONTENT ────────────────────────────────────

/**
 * getEffectChains returns the cascade structure.
 * Market mode uses a simplified momentum -> volume -> trend cascade.
 */
export function getEffectChains() {
  return [
    {
      title: "Momentum Cascade",
      nodes: [
        "RSI divergence from price trend",
        "MACD histogram crosses zero line",
        "Bollinger %B breaks above 1.0 or below 0.0",
        "Condition signals consolidate severity",
      ],
    },
    {
      title: "Volume Confirmation",
      nodes: [
        "Volume ratio surges above 1.5x baseline",
        "OBV slope confirms price direction",
        "MFI reaches extreme reading",
        "Flow signals validate or contradict condition regime",
      ],
    },
    {
      title: "Trend Resolution",
      nodes: [
        "Price crosses SMA50/200 with volume confirmation",
        "Drawdown deepens or recovers toward zero",
        "ATR percentile expands into trending regime",
        "ADX confirms trend strength above 25 threshold",
      ],
    },
  ];
}

export function EffectChainClosing() {
  return (
    <div style={{
      padding: "16px 24px",
      background: `${COLORS.gold}08`,
      border: `1px solid ${COLORS.gold}20`,
      borderRadius: 8,
      marginTop: 16,
    }}>
      <p style={{
        fontSize: 13,
        color: COLORS.textDim,
        lineHeight: 1.6,
        margin: 0,
      }}>
        These cascades show how technical signals propagate through the regime
        topology. When multiple chains fire simultaneously, cross-category coherence
        rises — the Gini coefficient drops as all signal categories converge on the
        same severity band, confirming a regime transition.
      </p>
    </div>
  );
}
