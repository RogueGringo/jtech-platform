import { useState, useMemo, useEffect } from "react";
import Header from "./Header.jsx";
import { COLORS } from "./DesignSystem.js";
import { computeSeverity, computeCoherence } from "../engine/signals.js";
import { fetchCommodityPrices } from "../engine/prices.js";
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

  const livePriceIds = useMemo(() => new Set(domainConfig.livePriceIds || []), []);

  const [signals, setSignals] = useState(() =>
    (domainConfig.signals || []).map(s => ({
      ...s,
      dataSource: livePriceIds.has(s.id) ? "pending" : "reference",
      lastUpdate: null,
    }))
  );
  const [priceStatus, setPriceStatus] = useState("loading");

  // Fetch commodity prices at app level — shared across all tabs
  useEffect(() => {
    let cancelled = false;
    async function fetchPrices() {
      try {
        const data = await fetchCommodityPrices(domainConfig.priceSymbols || {}, domainConfig.derivedPrices || {});
        if (cancelled) return;
        setPriceStatus(data.source);
        if (data.source === "live" || data.source === "cached") {
          setSignals(prev => prev.map(s => {
            const priceInfo = data.prices[s.id];
            if (!priceInfo || priceInfo.price === undefined) return s;
            const newNumeric = priceInfo.price;
            let formatted;
            if (s.unit === "/bbl" || s.id === "spread") formatted = "$" + newNumeric.toFixed(2);
            else if (s.unit === "%") formatted = Math.round(newNumeric) + "%";
            else formatted = newNumeric.toFixed(1);
            const newSeverity = computeSeverity(s.id, newNumeric, s.severity, domainConfig.severityThresholds || {});
            return {
              ...s,
              numeric: newNumeric,
              value: formatted,
              severity: newSeverity,
              lastUpdate: new Date(),
              dataSource: priceInfo.source === "live" ? "live" : "derived",
            };
          }));
        }
      } catch {
        if (!cancelled) setPriceStatus("error");
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Compute coherence from current signal state
  const coherence = useMemo(() => computeCoherence(signals), [signals]);

  const tabContent = {
    thesis: <ThesisView config={domainConfig} content={domainContent} terms={allTerms} />,
    nodes: <NodesView config={domainConfig} content={domainContent} terms={allTerms} />,
    patterns: <PatternsView config={domainConfig} content={domainContent} terms={allTerms} signals={signals} />,
    playbook: <EffectChainView config={domainConfig} content={domainContent} terms={allTerms} signals={signals} />,
    monitor: <SignalMonitor config={domainConfig} terms={allTerms} signals={signals} coherence={coherence} priceStatus={priceStatus} />,
    feed: <LiveFeed config={domainConfig} terms={allTerms} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
      <Header config={domainConfig} activeTab={activeTab} setActiveTab={setActiveTab} terms={allTerms} coherence={coherence} />
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {tabContent[activeTab] || <div style={{ padding: 32, color: COLORS.textDim }}>Tab not configured.</div>}
      </div>
    </div>
  );
}
