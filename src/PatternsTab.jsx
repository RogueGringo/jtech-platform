import { useRef } from "react";
import { COLORS } from "./theme.js";

const VERIFY_SOURCES = [
  { label: "MarineTraffic — Hormuz AIS", url: "https://www.marinetraffic.com/en/ais/home/centerx/56.3/centery/26.6/zoom/9" },
  { label: "Lloyd's List Intelligence", url: "https://www.lloydslistintelligence.com/" },
  { label: "IGPANDI — P&I Club Status", url: "https://www.igpandi.org/" },
  { label: "CBOE — OVX", url: "https://www.cboe.com/tradable_products/vix/ovx/" },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function PatternsTab() {
  const containerRef = useRef(null);

  return (
    <div ref={containerRef} style={{ padding: "32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: COLORS.gold, margin: "0 0 6px" }}>
          Patterns of Life — Analytical Framework
        </h2>
        <p style={{ fontSize: 13, color: COLORS.textDim, margin: 0, lineHeight: 1.5, maxWidth: 700 }}>
          Historical conflict-to-price correlation, multi-scale regime detection methodology, and phase transition
          framework. All data sourced from published records and verified analyst reports.
        </p>
      </div>

      {/* AIS Data Status — honest about what we don't have */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: COLORS.textMuted,
          }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.textMuted }}>
            LIVE AIS TRANSIT DATA — NOT CONNECTED
          </div>
        </div>
        <p style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 12px" }}>
          Real-time tanker transit tracking requires a live AIS data feed (MarineTraffic API, Kpler, or Vortexa).
          This dashboard does not currently have a live AIS connection. Verify transit status directly:
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "MarineTraffic — Hormuz Live Map", url: "https://www.marinetraffic.com/en/ais/home/centerx/56.3/centery/26.6/zoom/9" },
            { label: "Kpler — Tanker Flows", url: "https://www.kpler.com/" },
            { label: "Vortexa — Freight Analytics", url: "https://www.vortexa.com/" },
          ].map((src, i) => (
            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 5, fontSize: 11,
              background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}20`,
              color: COLORS.blue, textDecoration: "none", letterSpacing: 0.3,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.orange, flexShrink: 0 }} />
              {src.label}
            </a>
          ))}
        </div>
      </div>

      {/* Phase transition detection methodology — the framework is real, not tied to fake data */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
          PHASE DETECTION METHODOLOGY
        </div>
        <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 16px" }}>
          When connected to live AIS data, phase detection scores are computed from: 7-day transit volatility (25%),
          first derivative / rate of change (35%), second derivative / acceleration (20%), stranded vessel presence (20%),
          with an insurance withdrawal multiplier. Score &ge;75 = phase transition confirmed.
          Score &ge;40 = boundary layer entered. Score &ge;15 = perturbation detected.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {/* First derivative */}
          <div style={{
            padding: 16, borderRadius: 8,
            background: `${COLORS.blue}08`, border: `1px solid ${COLORS.blue}20`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.blue, letterSpacing: 1, marginBottom: 8 }}>
              FIRST DERIVATIVE (dx/dt)
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Rate of change in transit count. Measures <em>velocity</em> of flow change.
              Negative first derivative indicates declining transits. Magnitude indicates severity.
            </div>
          </div>

          {/* Second derivative */}
          <div style={{
            padding: 16, borderRadius: 8,
            background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}20`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.orange, letterSpacing: 1, marginBottom: 8 }}>
              SECOND DERIVATIVE (d²x/dt²)
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Acceleration of change. Measures whether decline is <em>accelerating</em> or <em>decelerating</em>.
              Sign change indicates inflection point (system approaching terminal state).
            </div>
          </div>

          {/* Kernel condition */}
          <div style={{
            padding: 16, borderRadius: 8,
            background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}20`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.purple, letterSpacing: 1, marginBottom: 8 }}>
              KERNEL CONDITION
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Insurance withdrawal is the binary gate function. When P&I clubs withdraw coverage,
              transit cessation follows within 48-72 hours regardless of other conditions.
              This is the near-sufficient condition for closure.
            </div>
          </div>
        </div>
      </div>

      {/* Historical conflict-to-price correlation — TRUE reference data */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold }}>
            HISTORICAL CONFLICT-TO-PRICE CORRELATION
          </div>
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            padding: "2px 6px", borderRadius: 3,
            background: `${COLORS.blue}15`, color: COLORS.blue,
          }}>VERIFIED REFERENCE DATA</span>
        </div>
        <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 16px" }}>
          Mean reversion times have shortened dramatically due to US shale elasticity, SPR availability, and faster information flow.
          Source: EIA historical data, academic literature, analyst reports (Goldman Sachs, Morgan Stanley, Dallas Fed).
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                {["Event", "Initial Shock", "Time to Peak", "Mean Reversion", "Type"].map(h => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: "left", fontSize: 10,
                    fontWeight: 700, letterSpacing: 1, color: COLORS.gold,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { event: "1973 Arab Embargo", shock: "+300%", peak: "~3 months", reversion: "Never", type: "Structural", color: COLORS.red },
                { event: "1979 Iran Revolution", shock: "+150%", peak: "~18 months", reversion: "~6-7 years", type: "Structural", color: COLORS.red },
                { event: "1990 Gulf War", shock: "+120%", peak: "~2.5 months", reversion: "~6 months", type: "Transitory", color: COLORS.orange },
                { event: "2003 Iraq Invasion", shock: "+30%", peak: "Pre-invasion", reversion: "Days (premium)", type: "Mixed", color: COLORS.blue },
                { event: "2019 Abqaiq Attack", shock: "+15%", peak: "1 day", reversion: "~2 weeks", type: "Transitory", color: COLORS.green },
                { event: "2022 Russia-Ukraine", shock: "+30%", peak: "~3 weeks", reversion: "~8 weeks", type: "Transitory", color: COLORS.orange },
                { event: "2026 Iran/Hormuz (current)", shock: "+13% (day 1)", peak: "TBD", reversion: "TBD", type: "TBD — monitoring", color: COLORS.gold },
              ].map((row, i) => (
                <tr key={i} style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: i === 6 ? `${COLORS.gold}08` : "transparent",
                }}>
                  <td style={{ padding: "8px 12px", color: row.color, fontWeight: 600 }}>{row.event}</td>
                  <td style={{ padding: "8px 12px", color: COLORS.text }}>{row.shock}</td>
                  <td style={{ padding: "8px 12px", color: COLORS.textDim }}>{row.peak}</td>
                  <td style={{ padding: "8px 12px", color: COLORS.textDim }}>{row.reversion}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                      padding: "2px 6px", borderRadius: 3,
                      background: `${row.color}15`, color: row.color,
                    }}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Scale Regime Detection */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.goldDim}12, ${COLORS.surface})`,
        border: `1px solid ${COLORS.goldDim}`,
        borderRadius: 12,
        padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: COLORS.gold, margin: 0 }}>
            Multi-Scale Regime Detection (MS-GARCH Framework)
          </h3>
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            padding: "2px 6px", borderRadius: 3,
            background: `${COLORS.blue}15`, color: COLORS.blue,
          }}>METHODOLOGY — Scarcioffolo & Etienne (2021)</span>
        </div>
        <p style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7, margin: "0 0 16px" }}>
          Markov-Switching GARCH identifies two volatility regimes: Regime 1 (low, persistent, tranquil) and
          Regime 2 (high, less persistent, agitated). The RS-GARCH-MIDAS framework significantly beats
          single-regime counterparts in out-of-sample forecasting. Key diagnostic: VIX-OVX divergence —
          when OVX spikes without corresponding VIX move, this confirms oil-specific supply shock, not broad macro fear.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            {
              scale: "MICRO (hours)",
              indicator: "AIS transponder signals",
              what: "Verify at MarineTraffic",
              detection: "Leading indicator — detectable before formal announcements",
              color: COLORS.blue,
            },
            {
              scale: "MESO (days)",
              indicator: "Insurance market binary state",
              what: "Verify at IGPANDI.org",
              detection: "Kernel condition change = leading indicator for physical flows",
              color: COLORS.orange,
            },
            {
              scale: "MACRO (weeks)",
              indicator: "Forward curve structure",
              what: "Verify at CME NYMEX",
              detection: "Curve shape encodes market belief about disruption duration",
              color: COLORS.purple,
            },
            {
              scale: "STRUCTURAL (months)",
              indicator: "Supply response capacity",
              what: "Verify at Baker Hughes, EIA",
              detection: "Inelasticity is the condition — not the event",
              color: COLORS.red,
            },
          ].map((s, i) => (
            <div key={i} style={{
              padding: 16, borderRadius: 8,
              background: `${s.color}08`, border: `1px solid ${s.color}20`,
              borderLeft: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: 1, marginBottom: 6 }}>
                {s.scale}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                {s.indicator}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>
                {s.what}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
                {s.detection}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verify upstream sources */}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: COLORS.textMuted, marginBottom: 10 }}>
          VERIFY UPSTREAM SOURCES
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {VERIFY_SOURCES.map((src, i) => (
            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 5, fontSize: 11,
              background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}20`,
              color: COLORS.blue, textDecoration: "none", letterSpacing: 0.3,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.green, flexShrink: 0 }} />
              {src.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
