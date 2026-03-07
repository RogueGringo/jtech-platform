import { useState } from "react";
import { COLORS } from "./DesignSystem.js";
import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function NodesView({ config, content, terms }) {
  const [expanded, setExpanded] = useState(null);
  const categories = content.getNodesCategories();

  return (
    <div style={{ padding: "32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: COLORS.gold, margin: "0 0 8px" }}>
          Primary Tracking Nodes
        </h2>
        <p style={{ fontSize: 14, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 8px" }}>
          These are the effect-indicators that describe the real state of the system. They're organized by
          causal hierarchy — insurance gates physical flows, which drive prices, which determine domestic economics.
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 4,
          background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}20`,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: COLORS.blue,
        }}>
          REFERENCE DATA — Values sourced from verified reports. Not live-updating. Verify at upstream sources.
        </div>
      </div>

      {categories.map((cat, ci) => (
        <div key={cat.id} style={{
          marginBottom: 16,
          border: `1px solid ${expanded === cat.id ? cat.color + "60" : COLORS.border}`,
          borderRadius: 12,
          overflow: "hidden",
          background: COLORS.surface,
          transition: "border-color 0.3s",
        }}>
          {/* Category header */}
          <div
            onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
            style={{
              padding: "18px 24px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: expanded === cat.id ? `${cat.color}08` : "transparent",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `${cat.color}20`, border: `2px solid ${cat.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: cat.color,
                }}>
                  {ci + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, letterSpacing: 0.5 }}>
                  {cat.title}
                </span>
              </div>
              <span style={{ fontSize: 12, color: COLORS.textDim, marginLeft: 40 }}>
                {cat.subtitle}
              </span>
            </div>
            <div style={{
              fontSize: 11, color: COLORS.textMuted, padding: "4px 10px",
              border: `1px solid ${COLORS.border}`, borderRadius: 4,
            }}>
              {cat.nodes.filter(n => n.signal === "critical").length > 0 && (
                <span style={{ color: COLORS.red, marginRight: 6 }}>
                  ● {cat.nodes.filter(n => n.signal === "critical").length} CRITICAL
                </span>
              )}
              {expanded === cat.id ? "▼" : "▶"}
            </div>
          </div>

          {/* Expanded content */}
          {expanded === cat.id && (
            <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${COLORS.border}` }}>
              <p style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6, margin: "16px 0" }}>
                {cat.description}
              </p>

              {cat.nodes.map((node, ni) => (
                <div key={ni} style={{
                  display: "grid",
                  gridTemplateColumns: "200px 220px 1fr",
                  gap: 16,
                  padding: "12px 16px",
                  margin: "4px 0",
                  background: `${node.signal === "critical" ? COLORS.red : node.signal === "high" ? COLORS.orange : COLORS.textMuted}08`,
                  borderRadius: 8,
                  borderLeft: `3px solid ${node.signal === "critical" ? COLORS.red : node.signal === "high" ? COLORS.orange : node.signal === "moderate" ? COLORS.blue : COLORS.textMuted}`,
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{node.name}</div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: node.signal === "critical" ? COLORS.red : node.signal === "high" ? COLORS.orange : COLORS.blue,
                  }}>
                    {node.current}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>{node.detail}</div>
                </div>
              ))}

              <div style={{
                marginTop: 16, padding: "12px 16px",
                background: `${COLORS.gold}10`, borderRadius: 8,
                borderLeft: `3px solid ${COLORS.gold}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gold, letterSpacing: 1, marginBottom: 4 }}>
                  ◉ BOUNDARY LAYER INDICATOR
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                  {cat.watchFor}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <SourceVerifyLink sources={config.verifySources?.nodes} />
    </div>
  );
}
