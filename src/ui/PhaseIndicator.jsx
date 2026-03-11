import { useMemo } from "react";
import { COLORS, severityColor } from "./DesignSystem.js";
import { assessPhase } from "../engine/patterns.js";

export default function PhaseIndicator({ signals, phases, transitionIntensity }) {
  const assessment = useMemo(() => assessPhase(signals, phases, transitionIntensity), [signals, phases, transitionIntensity]);
  const { currentPhase, phaseScores } = assessment;

  if (!phaseScores || phaseScores.length === 0) return null;

  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: "24px 28px", marginBottom: 24,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 16 }}>
        COMPUTED PHASE ASSESSMENT — LIVE SIGNAL EVALUATION
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 20 }}>
        {phaseScores.map((phase, i) => {
          const phaseColor = COLORS[phase.color] || COLORS.textMuted;
          const isCurrent = currentPhase?.id === phase.id;
          const isPartial = phase.total > 0 && phase.score > 0 && phase.score < 100;
          return (
            <div key={phase.id} style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
              <div style={{
                flex: 1, padding: "16px 14px", borderRadius: 8,
                background: isCurrent ? `${phaseColor}15` : COLORS.bg,
                border: `1px solid ${isCurrent ? phaseColor : COLORS.border}`,
                boxShadow: isCurrent ? `0 0 12px ${phaseColor}20` : "none",
                transition: "all 0.5s", position: "relative",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: isCurrent ? phaseColor : isPartial ? `${phaseColor}60` : COLORS.border,
                    boxShadow: isCurrent ? `0 0 8px ${phaseColor}80` : "none",
                    animation: isCurrent ? "pulse 2s infinite" : "none",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    color: isCurrent ? phaseColor : isPartial ? `${phaseColor}90` : COLORS.textMuted,
                  }}>
                    {phase.name.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5, marginBottom: 8 }}>
                  {phase.description}
                </div>
                {phase.total > 0 ? (
                  <div>
                    <div style={{ height: 6, borderRadius: 3, background: COLORS.bg, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{
                        height: "100%", borderRadius: 3, width: phase.score + "%",
                        background: phaseColor, transition: "width 0.5s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: COLORS.textMuted }}>{phase.met}/{phase.total} conditions met</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 9, color: COLORS.textMuted }}>Default state — no crisis signals required</div>
                )}
              </div>
              {i < phaseScores.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", padding: "0 6px", color: COLORS.textMuted, fontSize: 16 }}>→</div>
              )}
            </div>
          );
        })}
      </div>

      {currentPhase && currentPhase.signals && currentPhase.signals.length > 0 && (
        <div style={{
          padding: "14px 18px", borderRadius: 8,
          background: `${COLORS[currentPhase.color] || COLORS.gold}08`,
          border: `1px solid ${COLORS[currentPhase.color] || COLORS.gold}20`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS[currentPhase.color] || COLORS.gold, marginBottom: 8 }}>
            DRIVING SIGNALS — {currentPhase.name.toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {currentPhase.signals.map(sig => (
              <div key={sig.signalId} style={{
                padding: "6px 12px", borderRadius: 6,
                background: sig.isMet ? `${severityColor(sig.currentSeverity)}15` : `${COLORS.textMuted}08`,
                border: `1px solid ${sig.isMet ? severityColor(sig.currentSeverity) + "30" : COLORS.border}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: sig.isMet ? severityColor(sig.currentSeverity) : COLORS.textMuted }}>{sig.name}</div>
                <div style={{ fontSize: 11, color: COLORS.text, fontWeight: 700 }}>{sig.value}</div>
                <div style={{ fontSize: 8, color: COLORS.textMuted }}>{sig.isMet ? "\u2713" : "\u25CB"} requires {sig.requiredSeverity}+ · current {sig.currentSeverity}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assessment.transitionIndicators.length > 0 && currentPhase?.id !== assessment.transitionIndicators[0]?.id && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 6,
          background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}20`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.orange, marginBottom: 4 }}>TRANSITION MONITOR</div>
          {assessment.transitionIndicators.map(t => (
            <div key={t.id} style={{ fontSize: 11, color: COLORS.textDim }}>{t.name}: {t.met}/{t.total} conditions ({t.score}%)</div>
          ))}
        </div>
      )}

      {assessment.transitionIntensity && assessment.transitionIntensity.normalized > 0 && (
        <div style={{
          marginTop: 12, padding: "12px 16px", borderRadius: 8,
          background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.gold }}>
              TRANSITION INTENSITY
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              padding: "2px 8px", borderRadius: 4,
              color: assessment.transitionIntensity.label === "PHASE TRANSITION" ? COLORS.red
                : assessment.transitionIntensity.label === "TURBULENCE" ? COLORS.orange : COLORS.green,
              background: (assessment.transitionIntensity.label === "PHASE TRANSITION" ? COLORS.red
                : assessment.transitionIntensity.label === "TURBULENCE" ? COLORS.orange : COLORS.green) + "15",
            }}>
              {assessment.transitionIntensity.label}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 4 }}>MAGNITUDE</div>
              <div style={{ height: 6, borderRadius: 3, background: COLORS.bg, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: Math.round(assessment.transitionIntensity.normalized * 100) + "%",
                  background: COLORS.orange, transition: "width 0.5s",
                }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 4 }}>ALIGNMENT</div>
              <div style={{ height: 6, borderRadius: 3, background: COLORS.bg, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: Math.round(assessment.transitionIntensity.alignment * 100) + "%",
                  background: COLORS.blue, transition: "width 0.5s",
                }} />
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>
                {Math.round(assessment.transitionIntensity.normalized * 100)}%
              </div>
              <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                {Math.round(assessment.transitionIntensity.alignment * 100)}% aligned
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
