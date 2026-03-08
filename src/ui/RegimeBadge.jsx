import { COLORS } from "./DesignSystem.js";

const REGIME_COLORS = {
  "STABLE": COLORS.green,
  "TRANSIENT SPIKE": COLORS.orange,
  "BOUNDARY LAYER": COLORS.orange,
  "CRISIS CONSOLIDATION": COLORS.red,
};

const TRAJECTORY_DISPLAY = {
  concentrating: { arrow: "\u25B2", label: "CONSOLIDATING", color: "red" },
  dispersing: { arrow: "\u25BC", label: "DISPERSING", color: "green" },
  stable: { arrow: "\u2014", label: "STABLE", color: "textMuted" },
  "insufficient data": { arrow: "\u2026", label: "", color: "textMuted" },
};

export default function RegimeBadge({ coherence, giniTrajectory }) {
  const { gini, meanSeverity, regime, criticalCount, highCount, coherenceScore } = coherence;
  const color = REGIME_COLORS[regime.label] || COLORS.textMuted;
  const traj = TRAJECTORY_DISPLAY[giniTrajectory?.direction] || TRAJECTORY_DISPLAY["insufficient data"];

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
        <div style={{ fontSize: 9, color: COLORS[traj.color] || COLORS.textMuted }}>
          {traj.arrow} {traj.label}{traj.label && " · "}{criticalCount} critical / {highCount} high
        </div>
      </div>
    </div>
  );
}
