# JtechAi Platform Elevation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire HelpHover tooltips across all views, lift signal state to App for persistent regime display, add signal constellation SVG, live effect chain highlighting, and computed phase detection.

**Architecture:** React 18 + Vite SPA with inline styles from DesignSystem.js. No external charting libraries — SVG constellation is hand-built. Signal state lifts from SignalMonitor to App.jsx so it flows to Header (regime badge), EffectChainView (live highlighting), PatternsView (phase detection), and SignalMonitor (constellation + grid). No test runner exists; each task verifies via `npx vite build`.

**Tech Stack:** React 18, Vite 5, inline styles, SVG, CSS animations

---

### Task 1: Create Term.jsx — HelpHover Lookup Wrapper

**Files:**
- Create: `src/ui/Term.jsx`

**Step 1: Create the Term component**

```jsx
import HelpHover from "./HelpHover.jsx";

export default function Term({ t, terms, children }) {
  const key = t.toLowerCase();
  const definition = terms[t] || terms[key];
  return <HelpHover term={t} definition={definition}>{children || t}</HelpHover>;
}
```

This is a thin wrapper that does case-insensitive glossary lookup and delegates to HelpHover. If no definition is found, HelpHover gracefully renders just the children (line 16 of HelpHover.jsx: `if (!definition) return children || term`).

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS (new file is valid JSX, no consumers yet)

**Step 3: Commit**

```bash
git add src/ui/Term.jsx
git commit -m "feat: add Term wrapper component for glossary-aware HelpHover lookup"
```

---

### Task 2: Wire HelpHover into Header.jsx

**Files:**
- Modify: `src/ui/Header.jsx:1-54`

**Step 1: Add Term import and wrap technical terms in the subtitle paragraph**

The Header has a subtitle description at line 24-27. Wrap "Effects-based" and "phase transitions" with `<Term>`. Header receives `terms` prop (will be passed in Task 7 when App.jsx is updated — for now, default to empty object).

Replace the full file content of `src/ui/Header.jsx`:

```jsx
import { COLORS } from "./DesignSystem.js";
import Term from "./Term.jsx";

export default function Header({ config, activeTab, setActiveTab, terms = {} }) {
  const tabs = config.tabs || [];
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "24px 32px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: COLORS.gold, letterSpacing: -0.5 }}>
          JTECH AI
        </span>
        <span style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          {config.name} · {config.subtitle}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 9, letterSpacing: 1, padding: "2px 8px", borderRadius: 3,
          background: `${COLORS.green}15`, color: COLORS.green, fontWeight: 700,
          marginLeft: "auto",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.green, animation: "pulse 2s infinite" }} />
          CONTINUOUS UPDATE
        </span>
      </div>
      <p style={{ fontSize: 13, color: COLORS.textDim, margin: "4px 0 16px", maxWidth: 720, lineHeight: 1.5 }}>
        <Term t="effect" terms={terms}>Effects-based</Term> intelligence platform. Track measurable physical changes instead of narrative <Term t="event" terms={terms}>events</Term>{" "}
        for a structural edge in every market <Term t="regime" terms={terms}>regime</Term>.
      </p>
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 20px",
              background: activeTab === t.id ? COLORS.surface : "transparent",
              border: "1px solid",
              borderColor: activeTab === t.id ? COLORS.border : "transparent",
              borderBottom: activeTab === t.id ? `2px solid ${COLORS.gold}` : "2px solid transparent",
              borderRadius: "6px 6px 0 0",
              color: activeTab === t.id ? COLORS.gold : COLORS.textMuted,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/Header.jsx
git commit -m "feat: wire HelpHover terms into Header subtitle"
```

---

### Task 3: Wire HelpHover into NodesView.jsx

**Files:**
- Modify: `src/ui/NodesView.jsx`

**Step 1: Add Term import and wrap technical terms**

Add `import Term from "./Term.jsx";` at top. Wrap these terms in the view:
- "effect-indicators" → wrap with `<Term t="effect" terms={terms}>`
- "condition:state" references
- "boundary layer" in the BOUNDARY LAYER INDICATOR section (line 117)

Replace full content of `src/ui/NodesView.jsx`:

```jsx
import { useState } from "react";
import { COLORS } from "./DesignSystem.js";
import Term from "./Term.jsx";
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
          These are the <Term t="effect" terms={terms}>effect-indicators</Term> that describe the real <Term t="condition:state" terms={terms}>condition:state</Term> of the system. They're organized by
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
                  ◉ <Term t="boundary layer" terms={terms}>BOUNDARY LAYER</Term> INDICATOR
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
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/NodesView.jsx
git commit -m "feat: wire HelpHover terms into NodesView"
```

---

### Task 4: Wire HelpHover into EffectChainView.jsx

**Files:**
- Modify: `src/ui/EffectChainView.jsx`

**Step 1: Add Term import and wrap technical terms**

Wrap "effect chain", "condition:state" in the header paragraph, and classification labels in chain links.

Replace full content of `src/ui/EffectChainView.jsx`:

```jsx
import { COLORS } from "./DesignSystem.js";
import Term from "./Term.jsx";
import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function EffectChainView({ config, content, terms }) {
  const chains = content.getEffectChains();
  const EffectChainClosing = content.EffectChainClosing;

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

          {section.chain.map((link, li) => (
            <div key={li} style={{ display: "flex", gap: 0 }}>
              <div style={{ width: 40, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: `${link.color}40`, border: `2px solid ${link.color}`,
                  flexShrink: 0, zIndex: 1,
                }} />
                {li < section.chain.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: `${COLORS.border}`, minHeight: 20 }} />
                )}
              </div>

              <div style={{
                flex: 1,
                padding: "8px 16px 16px",
                marginBottom: li < section.chain.length - 1 ? 4 : 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1,
                    padding: "2px 6px", borderRadius: 3,
                    background: `${link.color}15`, color: link.color,
                  }}>
                    {link.classification}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>
                  {link.state}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
                  ↳ {link.downstream}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <EffectChainClosing />
      <SourceVerifyLink sources={config.verifySources?.playbook} />
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/EffectChainView.jsx
git commit -m "feat: wire HelpHover terms into EffectChainView"
```

---

### Task 5: Wire HelpHover into SignalMonitor.jsx

**Files:**
- Modify: `src/ui/SignalMonitor.jsx:94-180` (header area and coherence gauge)

**Step 1: Add Term import and wrap key terms**

Add `import Term from "./Term.jsx";` at line 7 (after RegimeBadge import).

Wrap these terms in SignalMonitor:
- Line 107: "Condition:state" → `<Term t="condition:state" terms={terms}>`
- Line 107-108: "Coherence" → `<Term t="coherence" terms={terms}>`
- Line 108: "consolidation" → `<Term t="consolidation" terms={terms}>`
- Line 149: "SIGNAL COHERENCE — GINI TRAJECTORY" → wrap "Gini trajectory"
- Line 168: "DISPERSING (transient)" → wrap "dispersion"
- Line 169: "CONSOLIDATING (structural)" → wrap "consolidation"
- Line 177: "Gini trajectory" in the analysis text
- Line 320-323: "effect" and "event" labels in analyzer description

Only modify these specific spots. Keep all other code unchanged. Add import at line 7:
```jsx
import Term from "./Term.jsx";
```

In the JSX at line 105-108, change the `<p>` content to:
```jsx
<p style={{ fontSize: 13, color: COLORS.textDim, margin: 0, lineHeight: 1.5 }}>
  <Term t="condition:state" terms={terms}>Condition:state</Term> tracking across all effect-indicators. Price signals update from live market data.{" "}
  <Term t="coherence" terms={terms}>Coherence</Term> measures whether independent indicators agree — <Term t="consolidation" terms={terms}>consolidation</Term> indicates structural shift.
</p>
```

At line 149, change the label to:
```jsx
<div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
  SIGNAL <Term t="coherence" terms={terms}>COHERENCE</Term> — <Term t="Gini trajectory" terms={terms}>GINI TRAJECTORY</Term>
</div>
```

At lines 167-169, wrap the dispersion/consolidation labels:
```jsx
<span><Term t="dispersion" terms={terms}>DISPERSING</Term> (transient)</span>
<span><Term t="consolidation" terms={terms}>CONSOLIDATING</Term> (structural)</span>
```

At lines 320-323 in the analyzer description, wrap "effect" and "event":
```jsx
an <strong style={{ color: COLORS.green }}><Term t="effect" terms={terms}>effect</Term></strong> (measurable change in the physical world) or
an <strong style={{ color: COLORS.red }}><Term t="event" terms={terms}>event</Term></strong> (narrative, prediction, or sentiment)
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/SignalMonitor.jsx
git commit -m "feat: wire HelpHover terms into SignalMonitor"
```

---

### Task 6: Wire HelpHover into LiveFeed.jsx

**Files:**
- Modify: `src/ui/LiveFeed.jsx:114-118`

**Step 1: Add Term import and wrap terms in description paragraph**

Add `import Term from "./Term.jsx";` after the SourceVerifyLink import (line 5).

Change lines 114-118 (the description paragraph) to:
```jsx
<p style={{ fontSize: 13, color: COLORS.textDim, margin: 0, lineHeight: 1.5, maxWidth: 700 }}>
  Real-time open-source intelligence classified as{" "}
  <strong style={{ color: COLORS.green }}><Term t="effect" terms={terms}>effects</Term></strong> (measurable physical changes) or{" "}
  <strong style={{ color: COLORS.red }}><Term t="event" terms={terms}>events</Term></strong> (narrative, prediction, sentiment).
  Auto-refreshes every 3 minutes from {feedSources.length} sources.
</p>
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/LiveFeed.jsx
git commit -m "feat: wire HelpHover terms into LiveFeed"
```

---

### Task 7: Lift Signal State to App.jsx + Pass terms to Header

**Files:**
- Modify: `src/ui/App.jsx`

This is the critical architectural change. Move price fetching and signal state management from SignalMonitor up to App so that coherence, signals, and terms can flow to all child components.

**Step 1: Rewrite App.jsx to lift state**

Replace full content of `src/ui/App.jsx`:

```jsx
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
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS (SignalMonitor will still work — it just ignores the new props for now and keeps its own internal fetch. We'll refactor it in the next task.)

**Step 3: Commit**

```bash
git add src/ui/App.jsx
git commit -m "feat: lift signal state and coherence computation to App level"
```

---

### Task 8: Refactor SignalMonitor to use lifted state

**Files:**
- Modify: `src/ui/SignalMonitor.jsx`

**Step 1: Remove internal price fetch, receive signals/coherence/priceStatus from props**

SignalMonitor currently manages its own signals state and price fetching (lines 10-66). Replace those with props. Keep filters, semantic analyzer, and all display logic.

Key changes:
- Props: `{ config, terms, signals, coherence, priceStatus }` (instead of computing internally)
- Remove: `useState` for signals (line 12-18), `useState` for priceStatus (line 22), the entire `useEffect` for fetchPrices (lines 31-66), the `computeCoherence` call (line 69)
- Keep: filter state, analyzerText state, analysisResult state
- Derive display values from props: `coherenceScore`, `regimeColor`, `liveSignalCount`, `referenceSignalCount`

Replace the top section of `src/ui/SignalMonitor.jsx` (lines 1-93) with:

```jsx
import { useState, useCallback } from "react";
import { COLORS, severityColor, trendArrow } from "./DesignSystem.js";
import { classifyText } from "../engine/classify.js";
import RegimeBadge from "./RegimeBadge.jsx";
import Term from "./Term.jsx";
import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function SignalMonitor({ config, terms, signals, coherence, priceStatus }) {
  const [filter, setFilter] = useState({ severity: "all", category: "all" });
  const [analyzerText, setAnalyzerText] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);

  // Resolve category meta from config
  const categoryMeta = {};
  for (const [key, meta] of Object.entries(config.categories || {})) {
    categoryMeta[key] = { label: meta.label, color: COLORS[meta.color] || COLORS.textMuted };
  }

  const { score: coherenceScore, criticalCount, highCount } = coherence;
  const regimeColor = coherenceScore >= 75 ? COLORS.red : coherenceScore >= 50 ? COLORS.orange : COLORS.green;

  // Filter signals
  const filteredSignals = signals.filter(s => {
    if (filter.severity !== "all" && s.severity !== filter.severity) return false;
    if (filter.category !== "all" && s.category !== filter.category) return false;
    return true;
  });

  // Semantic analyzer
  const analyzeText = useCallback(() => {
    if (!analyzerText.trim()) return;
    const result = classifyText(analyzerText, {
      effectKeywords: config.effectKeywords || [],
      eventKeywords: config.eventKeywords || [],
      chainTerms: config.chainTerms || {},
    });
    setAnalysisResult(result);
  }, [analyzerText, config]);

  const liveSignalCount = signals.filter(s => s.dataSource === "live" || s.dataSource === "derived").length;
  const referenceSignalCount = signals.filter(s => s.dataSource === "reference").length;
```

The rest of the JSX (from line 94 onward — the `return (` statement) stays **exactly the same** except:
- Remove the imports that are no longer needed: `useEffect` from React, `computeSeverity` and `computeCoherence` from signals.js, `fetchCommodityPrices` from prices.js
- The Term wiring from Task 5 should already be in place

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/SignalMonitor.jsx
git commit -m "refactor: SignalMonitor receives lifted signals/coherence from App"
```

---

### Task 9: Add Persistent Regime Badge to Header

**Files:**
- Modify: `src/ui/Header.jsx`

**Step 1: Accept coherence prop and render compact regime indicator**

Add RegimeBadge import. Render a compact version between the subtitle text and the CONTINUOUS UPDATE badge.

Replace full content of `src/ui/Header.jsx`:

```jsx
import { COLORS } from "./DesignSystem.js";
import Term from "./Term.jsx";

export default function Header({ config, activeTab, setActiveTab, terms = {}, coherence }) {
  const tabs = config.tabs || [];
  const regimeColor = coherence
    ? (coherence.score >= 75 ? COLORS.red : coherence.score >= 50 ? COLORS.orange : COLORS.green)
    : COLORS.textMuted;

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "24px 32px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: COLORS.gold, letterSpacing: -0.5 }}>
          JTECH AI
        </span>
        <span style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          {config.name} · {config.subtitle}
        </span>

        {/* Persistent regime indicator */}
        {coherence && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 12px", borderRadius: 6,
            background: `${regimeColor}12`, border: `1px solid ${regimeColor}30`,
            marginLeft: 8,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: regimeColor,
              boxShadow: `0 0 6px ${regimeColor}80`,
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: regimeColor }}>
              {coherence.label}
            </span>
            <span style={{ fontSize: 9, color: COLORS.textMuted }}>
              {coherence.score}%
            </span>
          </div>
        )}

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 9, letterSpacing: 1, padding: "2px 8px", borderRadius: 3,
          background: `${COLORS.green}15`, color: COLORS.green, fontWeight: 700,
          marginLeft: "auto",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.green, animation: "pulse 2s infinite" }} />
          CONTINUOUS UPDATE
        </span>
      </div>
      <p style={{ fontSize: 13, color: COLORS.textDim, margin: "4px 0 16px", maxWidth: 720, lineHeight: 1.5 }}>
        <Term t="effect" terms={terms}>Effects-based</Term> intelligence platform. Track measurable physical changes instead of narrative <Term t="event" terms={terms}>events</Term>{" "}
        for a structural edge in every market <Term t="regime" terms={terms}>regime</Term>.
      </p>
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 20px",
              background: activeTab === t.id ? COLORS.surface : "transparent",
              border: "1px solid",
              borderColor: activeTab === t.id ? COLORS.border : "transparent",
              borderBottom: activeTab === t.id ? `2px solid ${COLORS.gold}` : "2px solid transparent",
              borderRadius: "6px 6px 0 0",
              color: activeTab === t.id ? COLORS.gold : COLORS.textMuted,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/Header.jsx
git commit -m "feat: add persistent regime badge to Header visible on all tabs"
```

---

### Task 10: Create SignalConstellation.jsx

**Files:**
- Create: `src/ui/SignalConstellation.jsx`

**Step 1: Build the SVG constellation component**

This is a pure SVG component. Signals are positioned radially by category sector. Distance from center = inverse severity. Nodes animate toward/away from center based on coherence.

```jsx
import { useState, useMemo } from "react";
import { COLORS, severityColor } from "./DesignSystem.js";

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };
const W = 700;
const H = 420;
const CX = W / 2;
const CY = H / 2;
const MAX_R = 170;

export default function SignalConstellation({ signals, coherence, categories }) {
  const [hovered, setHovered] = useState(null);

  // Assign each category a sector angle range
  const categoryKeys = useMemo(() => Object.keys(categories), [categories]);
  const sectorAngle = (2 * Math.PI) / (categoryKeys.length || 1);

  // Compute node positions
  const nodes = useMemo(() => {
    const coherenceFactor = 1 - (coherence.score / 100) * 0.5; // 0.5 at 100%, 1.0 at 0%
    return signals.map((s) => {
      const catIdx = categoryKeys.indexOf(s.category);
      if (catIdx === -1) return null;
      const catSignals = signals.filter(x => x.category === s.category);
      const withinIdx = catSignals.indexOf(s);
      const sectorStart = catIdx * sectorAngle - Math.PI / 2;
      const spreadAngle = sectorAngle * 0.7;
      const angleOffset = catSignals.length > 1
        ? sectorStart + (spreadAngle * withinIdx) / (catSignals.length - 1) + (sectorAngle - spreadAngle) / 2
        : sectorStart + sectorAngle / 2;

      const rank = SEVERITY_RANK[s.severity] || 1;
      const baseDistance = MAX_R * (1 - rank / 5);
      const distance = baseDistance * coherenceFactor;

      return {
        ...s,
        x: CX + Math.cos(angleOffset) * distance,
        y: CY + Math.sin(angleOffset) * distance,
        r: 4 + rank * 3,
        color: severityColor(s.severity),
        catColor: COLORS[categories[s.category]?.color] || COLORS.textMuted,
      };
    }).filter(Boolean);
  }, [signals, coherence.score, categoryKeys, categories, sectorAngle]);

  // Category labels positioned at sector edges
  const categoryLabels = useMemo(() => {
    return categoryKeys.map((key, i) => {
      const angle = i * sectorAngle - Math.PI / 2 + sectorAngle / 2;
      const labelR = MAX_R + 30;
      return {
        key,
        label: categories[key]?.label || key,
        color: COLORS[categories[key]?.color] || COLORS.textMuted,
        x: CX + Math.cos(angle) * labelR,
        y: CY + Math.sin(angle) * labelR,
      };
    });
  }, [categoryKeys, categories, sectorAngle]);

  return (
    <div style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: "20px 24px", marginBottom: 24, position: "relative",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
        SIGNAL CONSTELLATION — SPATIAL COHERENCE MAP
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Radial grid rings */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <circle key={f} cx={CX} cy={CY} r={MAX_R * f}
            fill="none" stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="4 4" />
        ))}
        {/* Sector dividers */}
        {categoryKeys.map((_, i) => {
          const angle = i * sectorAngle - Math.PI / 2;
          return (
            <line key={i}
              x1={CX} y1={CY}
              x2={CX + Math.cos(angle) * MAX_R} y2={CY + Math.sin(angle) * MAX_R}
              stroke={COLORS.border} strokeWidth={0.5} />
          );
        })}
        {/* Center point */}
        <circle cx={CX} cy={CY} r={3} fill={COLORS.gold} opacity={0.5} />
        {/* Connecting lines within same category */}
        {categoryKeys.map(catKey => {
          const catNodes = nodes.filter(n => n.category === catKey);
          if (catNodes.length < 2) return null;
          return catNodes.slice(0, -1).map((n, i) => (
            <line key={`${catKey}-${i}`}
              x1={n.x} y1={n.y} x2={catNodes[i + 1].x} y2={catNodes[i + 1].y}
              stroke={n.catColor} strokeWidth={0.8}
              opacity={0.15 + (SEVERITY_RANK[n.severity] || 1) * 0.1} />
          ));
        })}
        {/* Signal nodes */}
        {nodes.map(n => (
          <g key={n.id}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer", transition: "all 0.5s ease" }}
          >
            {/* Glow for critical/high */}
            {(n.severity === "critical" || n.severity === "high") && (
              <circle cx={n.x} cy={n.y} r={n.r + 6} fill={n.color} opacity={0.12} />
            )}
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={`${n.color}40`} stroke={n.color} strokeWidth={1.5} />
            {hovered === n.id && (
              <circle cx={n.x} cy={n.y} r={n.r + 3}
                fill="none" stroke={COLORS.gold} strokeWidth={1} />
            )}
          </g>
        ))}
        {/* Category labels */}
        {categoryLabels.map(cl => (
          <text key={cl.key} x={cl.x} y={cl.y}
            textAnchor="middle" dominantBaseline="middle"
            fill={cl.color} fontSize={8} fontWeight={700} letterSpacing={1}
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {cl.label}
          </text>
        ))}
      </svg>
      {/* Hover tooltip */}
      {hovered && (() => {
        const n = nodes.find(x => x.id === hovered);
        if (!n) return null;
        return (
          <div style={{
            position: "absolute", bottom: 24, left: 24,
            padding: "10px 14px", borderRadius: 8,
            background: COLORS.bg, border: `1px solid ${n.color}40`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            zIndex: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: n.color, marginBottom: 4 }}>{n.name}</div>
            <div style={{ fontSize: 12, color: COLORS.text }}>{n.value} {n.unit}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
              {n.severity.toUpperCase()} · {n.trend.toUpperCase()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/SignalConstellation.jsx
git commit -m "feat: create SignalConstellation SVG for spatial coherence visualization"
```

---

### Task 11: Integrate SignalConstellation into SignalMonitor

**Files:**
- Modify: `src/ui/SignalMonitor.jsx`

**Step 1: Import and render SignalConstellation between coherence gauge and signal grid**

Add import at top (after Term import):
```jsx
import SignalConstellation from "./SignalConstellation.jsx";
```

Insert the constellation between the coherence/filter grid (ends around line ~244 in the current file, after the `</div>` closing the grid row) and the LIVE SIGNAL GRID section:

```jsx
{/* SIGNAL CONSTELLATION */}
<SignalConstellation signals={signals} coherence={coherence} categories={config.categories || {}} />
```

Place this JSX between the closing `</div>` of the coherence+filter grid and the opening of the LIVE SIGNAL GRID `<div>`.

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/SignalMonitor.jsx
git commit -m "feat: integrate SignalConstellation into SignalMonitor view"
```

---

### Task 12: Add chainSignalMap to Hormuz-Iran config

**Files:**
- Modify: `src/domains/hormuz-iran/config.js`

**Step 1: Add chainSignalMap object**

Add the following after the `derivedPrices` block (after line 180) and before `verifySources`:

```js
  chainSignalMap: {
    "Maritime Insurance Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "pni", activeWhen: "critical" },
        { chainIndex: 1, signalId: "warrisk", activeWhen: "critical" },
        { chainIndex: 2, signalId: "reinsure", activeWhen: "critical" },
      ],
    },
    "Physical Flow Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "ais", activeWhen: "critical" },
        { chainIndex: 1, signalId: "stranded", activeWhen: "high" },
        { chainIndex: 2, signalId: "vlcc", activeWhen: "high" },
        { chainIndex: 3, signalId: "bypass", activeWhen: "moderate" },
      ],
    },
    "Price Architecture Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "brent", activeWhen: "high" },
        { chainIndex: 1, signalId: "wti", activeWhen: "high" },
        { chainIndex: 2, signalId: "spread", activeWhen: "moderate" },
        { chainIndex: 3, signalId: "ovx", activeWhen: "high" },
      ],
    },
    "Supply Constraint Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "spr", activeWhen: "high" },
        { chainIndex: 1, signalId: "rigs", activeWhen: "moderate" },
        { chainIndex: 2, signalId: "duc", activeWhen: "high" },
        { chainIndex: 3, signalId: "production", activeWhen: "moderate" },
      ],
    },
    "Geopolitical Escalation Cascade": {
      nodes: [
        { chainIndex: 0, signalId: "iranprod", activeWhen: "critical" },
        { chainIndex: 1, signalId: "georisk", activeWhen: "high" },
        { chainIndex: 2, signalId: "opecspare", activeWhen: "high" },
        { chainIndex: 3, signalId: "proxyactive", activeWhen: "critical" },
      ],
    },
  },
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/domains/hormuz-iran/config.js
git commit -m "feat: add chainSignalMap linking effect chains to live signals"
```

---

### Task 13: Add Live Highlighting to EffectChainView

**Files:**
- Modify: `src/ui/EffectChainView.jsx`

**Step 1: Accept signals prop and add live highlighting logic**

The component already accepts `signals` from App (set up in Task 7). Now use it to highlight active chain nodes.

Add severity rank helper at top of file:
```jsx
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };
```

Inside the component function, before the return, add signal lookup:
```jsx
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
```

Then in the chain link rendering, for each link, check if it's active and add visual highlighting. Replace the chain link `<div>` content section (the one with padding `8px 16px 16px`) to add active state:

For each chain link rendering (inside `section.chain.map`), wrap the content div with active state styling:

```jsx
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
        flex: 1,
        padding: "8px 16px 16px",
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
```

The full updated `src/ui/EffectChainView.jsx` should have: import for Term (from Task 4), the SEVERITY_RANK constant, the signalMap + isNodeActive helper, and the updated chain rendering with active state.

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/EffectChainView.jsx
git commit -m "feat: add live signal highlighting to effect chain nodes"
```

---

### Task 14: Create engine/patterns.js — Phase Detection

**Files:**
- Create: `src/engine/patterns.js`

**Step 1: Create the phase assessment engine**

```jsx
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, watch: 1 };

export function assessPhase(signals, phases) {
  if (!phases || phases.length === 0) return { currentPhase: null, phaseScores: [], transitionIndicators: [] };

  const signalMap = {};
  for (const s of signals) signalMap[s.id] = s;

  const phaseScores = phases.map(phase => {
    const required = phase.requiredSignals || [];
    if (required.length === 0) {
      // Baseline phase: active when no other phase scores 100%
      return { ...phase, met: 0, total: 0, score: 0, signals: [] };
    }
    let met = 0;
    const signalDetails = required.map(req => {
      const signal = signalMap[req.signalId];
      const currentRank = signal ? (SEVERITY_RANK[signal.severity] || 0) : 0;
      const requiredRank = SEVERITY_RANK[req.minSeverity] || 1;
      const isMet = currentRank >= requiredRank;
      if (isMet) met++;
      return {
        signalId: req.signalId,
        name: signal?.name || req.signalId,
        currentSeverity: signal?.severity || "unknown",
        requiredSeverity: req.minSeverity,
        value: signal?.value || "—",
        isMet,
      };
    });
    return {
      ...phase,
      met,
      total: required.length,
      score: required.length > 0 ? Math.round((met / required.length) * 100) : 0,
      signals: signalDetails,
    };
  });

  // Current phase = highest phase where all required signals are met
  // If no non-baseline phase is fully met, current = baseline (first phase)
  let currentPhase = phaseScores[0]; // default baseline
  for (let i = phaseScores.length - 1; i >= 1; i--) {
    if (phaseScores[i].score === 100) {
      currentPhase = phaseScores[i];
      break;
    }
  }

  // Transition indicators: phases that are partially met (> 0% but < 100%)
  const transitionIndicators = phaseScores
    .filter(p => p.total > 0 && p.score > 0 && p.score < 100)
    .map(p => ({ id: p.id, name: p.name, score: p.score, met: p.met, total: p.total }));

  return { currentPhase, phaseScores, transitionIndicators };
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/engine/patterns.js
git commit -m "feat: create phase detection engine for computed pattern assessment"
```

---

### Task 15: Add phases to Hormuz-Iran config

**Files:**
- Modify: `src/domains/hormuz-iran/config.js`

**Step 1: Add phases array**

Add the following after the `chainSignalMap` block and before `verifySources`:

```js
  phases: [
    {
      id: "baseline",
      name: "Baseline Operations",
      description: "Normal maritime commerce, full insurance coverage, standard pricing",
      requiredSignals: [],
      color: "green",
    },
    {
      id: "elevated",
      name: "Elevated Tension",
      description: "Insurance tightening, geopolitical risk premiums rising, proxy activity increasing",
      requiredSignals: [
        { signalId: "georisk", minSeverity: "moderate" },
        { signalId: "proxyactive", minSeverity: "high" },
      ],
      color: "orange",
    },
    {
      id: "boundary",
      name: "Boundary Layer",
      description: "Insurance partially withdrawn, transit volumes declining, volatility spiking",
      requiredSignals: [
        { signalId: "pni", minSeverity: "moderate" },
        { signalId: "ovx", minSeverity: "moderate" },
        { signalId: "georisk", minSeverity: "high" },
      ],
      color: "orange",
    },
    {
      id: "crisis",
      name: "Phase Transition — Crisis",
      description: "Insurance withdrawn, transit collapsed, price regime discontinuity, supply emergency",
      requiredSignals: [
        { signalId: "pni", minSeverity: "critical" },
        { signalId: "ais", minSeverity: "critical" },
        { signalId: "brent", minSeverity: "high" },
      ],
      color: "red",
    },
  ],
```

Note: `color` uses string names (like categories do) so the UI component resolves them via COLORS.

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/domains/hormuz-iran/config.js
git commit -m "feat: add phase definitions for computed pattern assessment"
```

---

### Task 16: Create PhaseIndicator.jsx

**Files:**
- Create: `src/ui/PhaseIndicator.jsx`

**Step 1: Build the phase indicator component**

```jsx
import { useMemo } from "react";
import { COLORS, severityColor } from "./DesignSystem.js";
import { assessPhase } from "../engine/patterns.js";

export default function PhaseIndicator({ signals, phases }) {
  const assessment = useMemo(() => assessPhase(signals, phases), [signals, phases]);
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

      {/* Phase timeline */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 20 }}>
        {phaseScores.map((phase, i) => {
          const phaseColor = COLORS[phase.color] || COLORS.textMuted;
          const isCurrent = currentPhase?.id === phase.id;
          const isPartial = phase.total > 0 && phase.score > 0 && phase.score < 100;

          return (
            <div key={phase.id} style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
              <div style={{
                flex: 1, padding: "16px 14px", borderRadius: 8,
                background: isCurrent ? `${phaseColor}15` : `${COLORS.bg}`,
                border: `1px solid ${isCurrent ? phaseColor : COLORS.border}`,
                boxShadow: isCurrent ? `0 0 12px ${phaseColor}20` : "none",
                transition: "all 0.5s",
                position: "relative",
              }}>
                {/* Phase header */}
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

                {/* Description */}
                <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5, marginBottom: 8 }}>
                  {phase.description}
                </div>

                {/* Progress bar for non-baseline phases */}
                {phase.total > 0 && (
                  <div>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: COLORS.bg, overflow: "hidden", marginBottom: 4,
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: phase.score + "%",
                        background: phaseColor,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                      {phase.met}/{phase.total} conditions met
                    </div>
                  </div>
                )}
                {phase.total === 0 && (
                  <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                    Default state — no crisis signals required
                  </div>
                )}
              </div>
              {/* Arrow connector */}
              {i < phaseScores.length - 1 && (
                <div style={{
                  display: "flex", alignItems: "center", padding: "0 6px",
                  color: COLORS.textMuted, fontSize: 16,
                }}>
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Signal details for active/transitioning phase */}
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
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: sig.isMet ? severityColor(sig.currentSeverity) : COLORS.textMuted,
                }}>
                  {sig.name}
                </div>
                <div style={{ fontSize: 11, color: COLORS.text, fontWeight: 700 }}>
                  {sig.value}
                </div>
                <div style={{ fontSize: 8, color: COLORS.textMuted }}>
                  {sig.isMet ? "✓" : "○"} requires {sig.requiredSeverity}+ · current {sig.currentSeverity}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transition warnings */}
      {assessment.transitionIndicators.length > 0 && currentPhase?.id !== assessment.transitionIndicators[0]?.id && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 6,
          background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}20`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.orange, marginBottom: 4 }}>
            TRANSITION MONITOR
          </div>
          {assessment.transitionIndicators.map(t => (
            <div key={t.id} style={{ fontSize: 11, color: COLORS.textDim }}>
              {t.name}: {t.met}/{t.total} conditions ({t.score}%)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/PhaseIndicator.jsx
git commit -m "feat: create PhaseIndicator component for computed phase timeline"
```

---

### Task 17: Integrate PhaseIndicator into PatternsView

**Files:**
- Modify: `src/ui/PatternsView.jsx`

**Step 1: Import PhaseIndicator and render above PatternsContent**

Replace full content of `src/ui/PatternsView.jsx`:

```jsx
import PhaseIndicator from "./PhaseIndicator.jsx";
import SourceVerifyLink from "./SourceVerifyLink.jsx";

export default function PatternsView({ config, content, terms, signals }) {
  const PatternsContent = content.PatternsContent;
  return (
    <div>
      <div style={{ padding: "32px 32px 0" }}>
        <PhaseIndicator signals={signals || []} phases={config.phases || []} />
      </div>
      <PatternsContent />
      <div style={{ padding: "0 32px 32px" }}>
        <SourceVerifyLink sources={config.verifySources?.patterns} />
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/ui/PatternsView.jsx
git commit -m "feat: integrate PhaseIndicator into PatternsView"
```

---

### Task 18: Full Build Verification + Final Commit

**Files:** None new — verification only.

**Step 1: Clean build**

Run: `npx vite build`
Expected: SUCCESS with 0 errors. Note the bundle size and module count.

**Step 2: Check for any remaining issues**

Run: `npx vite build 2>&1 | head -20`
Verify no warnings about missing imports or unused variables.

**Step 3: Final commit if any loose changes**

```bash
git status
```

If any unstaged files remain, stage and commit:
```bash
git add -A
git commit -m "chore: final verification — 5-layer elevation complete"
```
