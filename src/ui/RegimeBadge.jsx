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
