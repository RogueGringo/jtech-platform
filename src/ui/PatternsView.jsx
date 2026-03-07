import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function PatternsView({ config, content, terms }) {
  const PatternsContent = content.PatternsContent;
  return (
    <div>
      <PatternsContent />
      <div style={{ padding: "0 32px 32px" }}>
        <SourceVerifyLink sources={config.verifySources?.patterns} />
      </div>
    </div>
  );
}
