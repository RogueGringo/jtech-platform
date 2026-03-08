import { COLORS } from "./DesignSystem.js";
import Term from "./Term.jsx";

export default function Header({ config, activeTab, setActiveTab, terms = {}, coherence, giniTrajectory }) {
  const REGIME_COLORS = { "STABLE": COLORS.green, "TRANSIENT SPIKE": COLORS.orange, "BOUNDARY LAYER": COLORS.orange, "CRISIS CONSOLIDATION": COLORS.red };
  const regimeColor = coherence?.regime ? (REGIME_COLORS[coherence.regime.label] || COLORS.textMuted) : COLORS.textMuted;
  const tabs = config.tabs || [];
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "24px 32px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: COLORS.gold, letterSpacing: -0.5 }}>
          JTECH AI
        </span>
        <span style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          {config.name} · {config.subtitle}
        </span>
        {coherence && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 12px", borderRadius: 6,
            background: `${regimeColor}12`, border: `1px solid ${regimeColor}30`,
            marginLeft: 8,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: regimeColor,
              boxShadow: `0 0 6px ${regimeColor}80`,
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: regimeColor }}>
              {coherence.label}
            </span>
            <span style={{ fontSize: 9, color: COLORS.textMuted }}>
              {coherence.score}%
            </span>
          </div>
        )}
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
        <Term t="effect" terms={terms}>Effects-based</Term> intelligence platform. Track measurable physical changes instead of narrative <Term t="event" terms={terms}>events</Term>{" "}
        for a structural edge in every market <Term t="regime" terms={terms}>regime</Term>.
      </p>
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((t) => (
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
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
