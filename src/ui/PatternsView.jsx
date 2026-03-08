import PhaseIndicator from "./PhaseIndicator.jsx";
import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function PatternsView({ config, content, terms, signals, transitionIntensity }) {
  const PatternsContent = content.PatternsContent;
  return (
    <div>
      <div style={{ padding: "32px 32px 0" }}>
        <PhaseIndicator signals={signals || []} phases={config.phases || []} transitionIntensity={transitionIntensity} />
      </div>
      <PatternsContent terms={terms} />
      <div style={{ padding: "0 32px 32px" }}>
        <SourceVerifyLink sources={config.verifySources?.patterns} />
      </div>
    </div>
  );
}
