import { COLORS } from "./DesignSystem.js";

export default function SourceVerifyLink({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{
      marginTop: 28, paddingTop: 16, borderTop: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: COLORS.textMuted,
        marginBottom: 10,
      }}>
        VERIFY UPSTREAM SOURCES
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {sources.map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 5, fontSize: 11,
              background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}20`,
              color: COLORS.blue, textDecoration: "none", letterSpacing: 0.3,
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: "50%", background: COLORS.green,
              flexShrink: 0,
            }} />
            {src.label}
          </a>
        ))}
      </div>
    </div>
  );
}
