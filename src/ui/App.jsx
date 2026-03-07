import { useState, useMemo } from "react";
import Header from "./Header.jsx";
import { COLORS } from "./DesignSystem.js";
import domainConfig from "../domains/hormuz-iran/config.js";
import * as domainContent from "../domains/hormuz-iran/content.jsx";
import domainTerms from "../domains/hormuz-iran/terms.js";
import universalTerms from "../terms/universal.js";
import ThesisView from "./ThesisView.jsx";
import NodesView from "./NodesView.jsx";
import PatternsView from "./PatternsView.jsx";
import EffectChainView from "./EffectChainView.jsx";
import SignalMonitor from "./SignalMonitor.jsx";
import LiveFeed from "./LiveFeed.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState(domainConfig.tabs[0]?.id || "thesis");
  const allTerms = useMemo(() => ({ ...universalTerms, ...domainTerms }), []);
  const tabContent = {
    thesis: <ThesisView config={domainConfig} content={domainContent} terms={allTerms} />,
    nodes: <NodesView config={domainConfig} content={domainContent} terms={allTerms} />,
    patterns: <PatternsView config={domainConfig} content={domainContent} terms={allTerms} />,
    playbook: <EffectChainView config={domainConfig} content={domainContent} terms={allTerms} />,
    monitor: <SignalMonitor config={domainConfig} terms={allTerms} />,
    feed: <LiveFeed config={domainConfig} terms={allTerms} />,
  };
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
      <Header config={domainConfig} activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {tabContent[activeTab] || <div style={{ padding: 32, color: COLORS.textDim }}>Tab not configured.</div>}
      </div>
    </div>
  );
}
