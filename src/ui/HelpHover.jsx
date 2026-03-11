import { useState, useRef, useEffect } from "react";
import { COLORS } from "./DesignSystem.js";

export default function HelpHover({ term, definition, children }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState("below");
  const triggerRef = useRef(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.top < 200 ? "below" : "above");
    }
  }, [show]);

  if (!definition) return children || term;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{
        position: "relative",
        borderBottom: `1px dotted ${COLORS.gold}60`,
        cursor: "help",
        display: "inline",
      }}
    >
      {children || term}
      {show && (
        <span style={{
          position: "absolute",
          [position === "above" ? "bottom" : "top"]: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 320,
          maxWidth: "90vw",
          padding: "12px 16px",
          background: COLORS.surface,
          border: `1px solid ${COLORS.gold}40`,
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          zIndex: 1000,
          pointerEvents: "none",
        }}>
          <span style={{
            display: "block",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: COLORS.gold,
            marginBottom: 6,
            textTransform: "uppercase",
          }}>
            {term}
          </span>
          <span style={{
            display: "block",
            fontSize: 12,
            color: COLORS.textDim,
            lineHeight: 1.6,
            fontWeight: 400,
            fontStyle: "normal",
          }}>
            {definition}
          </span>
        </span>
      )}
    </span>
  );
}
