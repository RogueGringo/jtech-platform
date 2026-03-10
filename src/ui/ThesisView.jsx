import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function ThesisView({ config, content, terms }) {
  const ThesisContent = content.ThesisContent;
  return (
    <div>
      <ThesisContent terms={terms} config={config} />
      <div style={{ padding: "0 32px 32px" }}>
        <SourceVerifyLink sources={config.verifySources?.thesis} />
      </div>
    </div>
  );
}
