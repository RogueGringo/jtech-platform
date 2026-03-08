import { COLORS } from "./DesignSystem.js";

const REGIME_COLORS = {
  "STABLE": COLORS.green,
  "TRANSIENT SPIKE": COLORS.orange,
  "BOUNDARY LAYER": COLORS.orange,
  "CRISIS CONSOLIDATION": COLORS.red,
};

export default function RegimeBadge({ coherence }) {
  const { gini, meanSeverity, regime, criticalCount, highCount, coherenceScore } = coherence;
  const color = REGIME_COLORS[regime.label] || COLORS.textMuted;

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
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1.5 }}>{regime.label}</div>
        <div style={{ fontSize: 10, color: COLORS.textDim }}>
          G={gini.toFixed(2)} &middot; x&#x0304;={meanSeverity.toFixed(1)} &middot; C={coherenceScore}%
        </div>
        <div style={{ fontSize: 9, color: COLORS.textMuted }}>
          {criticalCount} critical / {highCount} high
        </div>
      </div>
    </div>
  );
}
