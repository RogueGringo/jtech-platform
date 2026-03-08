import { COLORS } from "./DesignSystem.js";
import SourceVerifyLink from "./SourceVerifyLink.jsx";
import Term from "./Term.jsx";

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

export default function EffectChainView({ config, content, terms, signals }) {
  const chains = content.getEffectChains();
  const EffectChainClosing = content.EffectChainClosing;

  const signalMap = {};
  for (const s of (signals || [])) signalMap[s.id] = s;

  function isNodeActive(sectionTitle, chainIndex) {
    const mapping = config.chainSignalMap?.[sectionTitle];
    if (!mapping) return null;
    const nodeMapping = mapping.nodes.find(n => n.chainIndex === chainIndex);
    if (!nodeMapping) return null;
    const signal = signalMap[nodeMapping.signalId];
    if (!signal) return null;
    const required = SEVERITY_RANK[nodeMapping.activeWhen] || 1;
    const current = SEVERITY_RANK[signal.severity] || 0;
    return current >= required ? signal : null;
  }

  return (
    <div style={{ padding: "32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: COLORS.gold, margin: "0 0 8px" }}>
          <Term t="effect chain" terms={terms}>Effect Chains</Term>: How <Term t="condition:state" terms={terms}>Condition:States</Term> Cascade
        </h2>
        <p style={{ fontSize: 14, color: COLORS.textDim, lineHeight: 1.6, margin: 0 }}>
          <Term t="effect" terms={terms}>Effects</Term> don't exist in isolation. They propagate through causal chains — each changed <Term t="condition:state" terms={terms}>condition:state</Term>{" "}
          alters the <Term t="boundary layer" terms={terms}>boundary conditions</Term> for the next. The maps below show the objective structure of how
          effects move through the system. The geometry is the same whether oil is $40 or $140.
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
          padding: "4px 10px", borderRadius: 4,
          background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}20`,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: COLORS.blue,
        }}>
          CAUSAL FRAMEWORK — Structural relationships between effect-indicators. Scenario pricing from Morgan Stanley / Dallas Fed.
        </div>
      </div>

      {/* Effect cascade chains */}
      {chains.map((section, si) => (
        <div key={si} style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 20,
        }}>
          <h3 style={{
            fontSize: 14, fontWeight: 700, color: COLORS.gold,
            letterSpacing: 1, margin: "0 0 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>{section.icon}</span>
            {section.title}
          </h3>

          {section.chain.map((link, li) => {
            const activeSignal = isNodeActive(section.title, li);
            const isActive = !!activeSignal;
            return (
              <div key={li} style={{ display: "flex", gap: 0 }}>
                <div style={{ width: 40, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: isActive ? link.color : `${link.color}40`,
                    border: `2px solid ${link.color}`,
                    boxShadow: isActive ? `0 0 10px ${link.color}60` : "none",
                    flexShrink: 0, zIndex: 1,
                    transition: "all 0.3s",
                  }} />
                  {li < section.chain.length - 1 && (
                    <div style={{
                      width: 2, flex: 1, minHeight: 20,
                      background: isActive && isNodeActive(section.title, li + 1) ? link.color : COLORS.border,
                      transition: "background 0.3s",
                    }} />
                  )}
                </div>
                <div style={{
                  flex: 1, padding: "8px 16px 16px",
                  marginBottom: li < section.chain.length - 1 ? 4 : 0,
                  borderRadius: isActive ? 8 : 0,
                  background: isActive ? `${link.color}08` : "transparent",
                  boxShadow: isActive ? `inset 0 0 0 1px ${link.color}25` : "none",
                  transition: "all 0.3s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      padding: "2px 6px", borderRadius: 3,
                      background: `${link.color}15`, color: link.color,
                    }}>
                      {link.classification}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: 1,
                        padding: "2px 8px", borderRadius: 3,
                        background: `${link.color}25`, color: link.color,
                        animation: "pulse 2s infinite",
                      }}>
                        ACTIVE — {activeSignal.value} {activeSignal.unit}
                      </span>
                    )}
                    {!isActive && config.chainSignalMap?.[section.title]?.nodes.find(n => n.chainIndex === li) && (
                      <span style={{
                        fontSize: 8, letterSpacing: 0.5,
                        padding: "2px 6px", borderRadius: 3,
                        background: `${COLORS.textMuted}10`, color: COLORS.textMuted,
                      }}>
                        MONITORING
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>
                    {link.state}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
                    ↳ {link.downstream}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Domain-specific closing content (scenario pricing, closing frame) */}
      <EffectChainClosing />

      <SourceVerifyLink sources={config.verifySources?.playbook} />
    </div>
  );
}
