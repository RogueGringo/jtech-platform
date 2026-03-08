import { useState, useMemo } from "react";
import { COLORS, severityColor } from "./DesignSystem.js";

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };
const W = 700;
const H = 420;
const CX = W / 2;
const CY = H / 2;
const MAX_R = 170;

export default function SignalConstellation({ signals, coherence, categories }) {
  const [hovered, setHovered] = useState(null);

  const categoryKeys = useMemo(() => Object.keys(categories), [categories]);
  const sectorAngle = (2 * Math.PI) / (categoryKeys.length || 1);

  const nodes = useMemo(() => {
    const coherenceFactor = 1 - (coherence.score / 100) * 0.5;
    return signals.map((s) => {
      const catIdx = categoryKeys.indexOf(s.category);
      if (catIdx === -1) return null;
      const catSignals = signals.filter(x => x.category === s.category);
      const withinIdx = catSignals.indexOf(s);
      const sectorStart = catIdx * sectorAngle - Math.PI / 2;
      const spreadAngle = sectorAngle * 0.7;
      const angleOffset = catSignals.length > 1
        ? sectorStart + (spreadAngle * withinIdx) / (catSignals.length - 1) + (sectorAngle - spreadAngle) / 2
        : sectorStart + sectorAngle / 2;
      const rank = SEVERITY_RANK[s.severity] || 1;
      const baseDistance = MAX_R * (1 - rank / 5);
      const distance = baseDistance * coherenceFactor;
      return {
        ...s, x: CX + Math.cos(angleOffset) * distance, y: CY + Math.sin(angleOffset) * distance,
        r: 4 + rank * 3, color: severityColor(s.severity),
        catColor: COLORS[categories[s.category]?.color] || COLORS.textMuted,
      };
    }).filter(Boolean);
  }, [signals, coherence.score, categoryKeys, categories, sectorAngle]);

  const categoryLabels = useMemo(() => {
    return categoryKeys.map((key, i) => {
      const angle = i * sectorAngle - Math.PI / 2 + sectorAngle / 2;
      const labelR = MAX_R + 30;
      return {
        key, label: categories[key]?.label || key,
        color: COLORS[categories[key]?.color] || COLORS.textMuted,
        x: CX + Math.cos(angle) * labelR, y: CY + Math.sin(angle) * labelR,
      };
    });
  }, [categoryKeys, categories, sectorAngle]);

  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: "20px 24px", marginBottom: 24, position: "relative",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
        SIGNAL CONSTELLATION — SPATIAL COHERENCE MAP
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <circle key={f} cx={CX} cy={CY} r={MAX_R * f} fill="none" stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
        ))}
        {categoryKeys.map((_, i) => {
          const angle = i * sectorAngle - Math.PI / 2;
          return <line key={i} x1={CX} y1={CY} x2={CX + Math.cos(angle) * MAX_R} y2={CY + Math.sin(angle) * MAX_R} stroke={COLORS.border} strokeWidth={0.5} />;
        })}
        <circle cx={CX} cy={CY} r={3} fill={COLORS.gold} opacity={0.5} />
        {categoryKeys.map(catKey => {
          const catNodes = nodes.filter(n => n.category === catKey);
          if (catNodes.length < 2) return null;
          return catNodes.slice(0, -1).map((n, i) => (
            <line key={`${catKey}-${i}`} x1={n.x} y1={n.y} x2={catNodes[i + 1].x} y2={catNodes[i + 1].y}
              stroke={n.catColor} strokeWidth={0.8} opacity={0.15 + (SEVERITY_RANK[n.severity] || 1) * 0.1} />
          ));
        })}
        {nodes.map(n => (
          <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
            {(n.severity === "critical" || n.severity === "high") && (
              <circle cx={n.x} cy={n.y} r={n.r + 6} fill={n.color} opacity={0.12} />
            )}
            <circle cx={n.x} cy={n.y} r={n.r} fill={`${n.color}40`} stroke={n.color} strokeWidth={1.5} />
            {hovered === n.id && <circle cx={n.x} cy={n.y} r={n.r + 3} fill="none" stroke={COLORS.gold} strokeWidth={1} />}
          </g>
        ))}
        {categoryLabels.map(cl => (
          <text key={cl.key} x={cl.x} y={cl.y} textAnchor="middle" dominantBaseline="middle"
            fill={cl.color} fontSize={8} fontWeight={700} letterSpacing={1}
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {cl.label}
          </text>
        ))}
      </svg>
      {hovered && (() => {
        const n = nodes.find(x => x.id === hovered);
        if (!n) return null;
        return (
          <div style={{
            position: "absolute", bottom: 24, left: 24, padding: "10px 14px", borderRadius: 8,
            background: COLORS.bg, border: `1px solid ${n.color}40`, boxShadow: "0 4px 16px rgba(0,0,0,0.5)", zIndex: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: n.color, marginBottom: 4 }}>{n.name}</div>
            <div style={{ fontSize: 12, color: COLORS.text }}>{n.value} {n.unit}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{n.severity.toUpperCase()} · {n.trend.toUpperCase()}</div>
          </div>
        );
      })()}
    </div>
  );
}
