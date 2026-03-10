/**
 * Sector Coherence View — Cross-ticker COG detection
 *
 * Groups watchlist tickers by sector and computes cross-ticker coherence.
 * When multiple tickers in the same sector converge on the same regime,
 * this detects a Center of Gravity (COG) — a sector-wide phase alignment
 * that warrants attention.
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

import { COLORS, FONTS } from "./DesignSystem.js";

// ================================================================
// REGIME BADGE COLORS — mirrors WatchlistView palette
// ================================================================

const REGIME_COLORS = {
  "STABLE": COLORS.green,
  "TRANSIENT SPIKE": COLORS.orange,
  "BOUNDARY LAYER": COLORS.orange,
  "CRISIS CONSOLIDATION": COLORS.red,
  "NO DATA": COLORS.textMuted,
};

// ================================================================
// COHERENCE COMPUTATION
// ================================================================

/**
 * Compute cross-ticker regime coherence for a sector.
 * Returns the percentage of tickers sharing the most common regime.
 *
 * @param {Object[]} tickers - Array of { regime, ... }
 * @returns {number} Coherence percentage (0-100)
 */
function sectorCoherence(tickers) {
  const regimes = tickers.map(t => t.regime);
  const unique = new Set(regimes);
  const maxFreq = Math.max(
    ...[...unique].map(r => regimes.filter(x => x === r).length)
  );
  return Math.round((maxFreq / regimes.length) * 100);
}

/**
 * Detect COG (Center of Gravity) condition for a sector.
 *
 * COG fires when:
 *   - 3+ tickers in the sector
 *   - At least 2 in BOUNDARY LAYER or CRISIS CONSOLIDATION
 *   - Cross-ticker coherence >= 60%
 *
 * @param {Object[]} tickers - Sector tickers with regime labels
 * @param {number} coherence - Sector coherence percentage
 * @returns {boolean}
 */
function detectCOG(tickers, coherence) {
  if (tickers.length < 3) return false;
  if (coherence < 60) return false;
  const stressed = tickers.filter(
    t => t.regime === "BOUNDARY LAYER" || t.regime === "CRISIS CONSOLIDATION"
  );
  return stressed.length >= 2;
}

// ================================================================
// SECTOR CARD COMPONENT
// ================================================================

function SectorCard({ sector, tickers, onSelectTicker }) {
  const coherence = sectorCoherence(tickers);
  const cogDetected = detectCOG(tickers, coherence);

  // Coherence color gradient: green (high) -> gold (mid) -> red (low)
  const coherenceColor = coherence >= 80
    ? COLORS.green
    : coherence >= 60
      ? COLORS.gold
      : coherence >= 40
        ? COLORS.orange
        : COLORS.red;

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${cogDetected ? COLORS.red + "80" : COLORS.border}`,
      borderRadius: 8,
      overflow: "hidden",
      transition: "border-color 0.3s",
    }}>
      {/* Card header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: cogDetected ? COLORS.red + "08" : "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: COLORS.gold,
            fontFamily: FONTS.body,
          }}>
            {sector}
          </span>
          <span style={{
            fontSize: 10,
            color: COLORS.textMuted,
            letterSpacing: 0.5,
          }}>
            {tickers.length} ticker{tickers.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Coherence badge */}
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "monospace",
            color: coherenceColor,
            letterSpacing: 0.5,
          }}>
            {coherence}%
          </span>

          {/* COG badge */}
          {cogDetected && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: COLORS.red + "20",
              border: `1px solid ${COLORS.red}60`,
              borderRadius: 4,
              padding: "3px 8px",
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: COLORS.red,
                boxShadow: `0 0 6px ${COLORS.red}`,
                animation: "cogPulse 1.5s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: COLORS.red,
              }}>
                COG DETECTED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mini table header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 16px",
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ ...miniHeaderStyle, width: 70 }}>TICKER</div>
        <div style={{ ...miniHeaderStyle, width: 140 }}>REGIME</div>
        <div style={{ ...miniHeaderStyle, width: 70, textAlign: "right" }}>GINI</div>
        <div style={{ ...miniHeaderStyle, width: 70, textAlign: "right" }}>MEAN</div>
        <div style={{ ...miniHeaderStyle, width: 70, textAlign: "right" }}>COH</div>
      </div>

      {/* Ticker rows */}
      {tickers.map(t => {
        const regimeColor = REGIME_COLORS[t.regime] || COLORS.textMuted;
        return (
          <div
            key={t.ticker}
            onClick={() => onSelectTicker && onSelectTicker(t.ticker)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 16px",
              cursor: "pointer",
              borderBottom: `1px solid ${COLORS.border}`,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = COLORS.surfaceHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            {/* Ticker */}
            <div style={{
              width: 70,
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.gold,
              letterSpacing: 1,
              fontFamily: FONTS.body,
            }}>
              {t.ticker}
            </div>

            {/* Regime */}
            <div style={{
              width: 140,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}>
              <div style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: regimeColor,
                boxShadow: `0 0 3px ${regimeColor}80`,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.6,
                color: regimeColor,
              }}>
                {t.regime}
              </span>
            </div>

            {/* Gini */}
            <div style={{
              width: 70,
              fontSize: 11,
              fontFamily: "monospace",
              color: COLORS.text,
              textAlign: "right",
            }}>
              {t.gini != null ? t.gini.toFixed(3) : "\u2014"}
            </div>

            {/* Mean */}
            <div style={{
              width: 70,
              fontSize: 11,
              fontFamily: "monospace",
              color: COLORS.text,
              textAlign: "right",
            }}>
              {t.mean != null ? t.mean.toFixed(2) : "\u2014"}
            </div>

            {/* Coherence */}
            <div style={{
              width: 70,
              fontSize: 11,
              fontFamily: "monospace",
              color: COLORS.text,
              textAlign: "right",
            }}>
              {t.coherence != null ? `${t.coherence}%` : "\u2014"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ================================================================
// MINI TABLE HEADER STYLE
// ================================================================

const miniHeaderStyle = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.2,
  color: COLORS.textMuted,
  fontFamily: FONTS.body,
};

// ================================================================
// COG PULSE KEYFRAMES — injected once
// ================================================================

let stylesInjected = false;

function injectKeyframes() {
  if (stylesInjected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes cogPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.4); }
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ================================================================
// SECTOR VIEW COMPONENT (exported)
// ================================================================

/**
 * @param {Object} props
 * @param {Object[]} props.watchlistData - Array of analyzed tickers:
 *   [{ ticker, sector, regime, gini, mean, coherence }, ...]
 * @param {Function} [props.onSelectTicker] - Callback when a ticker is clicked
 */
export default function SectorView({ watchlistData, onSelectTicker }) {
  injectKeyframes();

  // Group tickers by sector, only include sectors with 2+ tickers
  const sectorMap = {};
  for (const t of watchlistData) {
    const sector = t.sector || "Unknown";
    if (!sectorMap[sector]) sectorMap[sector] = [];
    sectorMap[sector].push(t);
  }

  // Filter to sectors with 2+ tickers, then sort:
  // 1. Most tickers first
  // 2. Highest coherence first (tiebreaker)
  const sectors = Object.entries(sectorMap)
    .filter(([, tickers]) => tickers.length >= 2)
    .sort((a, b) => {
      const countDiff = b[1].length - a[1].length;
      if (countDiff !== 0) return countDiff;
      return sectorCoherence(b[1]) - sectorCoherence(a[1]);
    });

  // Empty state
  if (sectors.length === 0) {
    return (
      <div style={{
        padding: "24px 0",
        textAlign: "center",
        color: COLORS.textMuted,
        fontSize: 11,
        letterSpacing: 0.5,
      }}>
        Add more tickers to the same sector to enable cross-ticker coherence analysis.
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Section heading */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        color: COLORS.textMuted,
        fontFamily: FONTS.body,
        marginBottom: 16,
      }}>
        SECTOR COHERENCE
      </div>

      {/* Sector cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
        gap: 16,
      }}>
        {sectors.map(([sector, tickers]) => (
          <SectorCard
            key={sector}
            sector={sector}
            tickers={tickers}
            onSelectTicker={onSelectTicker}
          />
        ))}
      </div>
    </div>
  );
}
