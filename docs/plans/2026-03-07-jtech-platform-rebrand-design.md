# JtechAi All-Source Intelligence Platform -- Rebrand & Framework Separation

**Author**: mr.white@jtech.ai + Claude Code
**Date**: 2026-03-07
**Status**: Approved

---

## 1. Vision

Build a configurable, all-source intelligence platform where:

- Human language is the raw signal (news, filings, reports, any text source)
- Language encodes the geometry of intent and value within interaction manifolds
- Semantic primes -- action, effect, condition, state, transition -- form the universal extraction layer
- Mathematics maps those primes into computable structures (regime detection, consolidation/dispersion, phase transition identification)
- The output is a validated structural reading of system state -- a "reality decoder"
- Domain-agnostic: Hormuz/Iran is case study #1. Stocks, bonds, commodities, any domain fits the same framework

Future iterations will explore local LLM inference (via LM Studio) for learning the mapping between mathematical form and semantic expression of activity:state to condition:state -- pending V&V.

## 2. Cycle 1 Scope

### 2.1 Rebrand

| From | To |
|---|---|
| (old brand) | JtechAi |
| (old package name) | jtech-intel-platform |
| (old FastAPI title) | JtechAi Intelligence |
| (old HF space URL) | TBD (update when new space created) |
| No author attribution | mr.white@jtech.ai, co-authored with Claude Code |

All files touched: README.md, package.json, package-lock.json, index.html, App.jsx, DataService.jsx, app.py, launcher/*.py, run.sh, Dockerfile, .github/workflows/*.yml

### 2.2 Removals

**Terminated:**
- PORTFOLIO MAP tab -- legacy asset positioning (Kansas, Pearsall, Utica)
- All old branding strings across all files
- Feedback report Layer 3 domestic asset specifics tied to proprietary positions
- Hardcoded domain prose embedded directly in UI components
- Inline style sprawl in monolithic App.jsx (~800+ lines)
- VERIFY_SOURCES.portfolio entries

**NOT removed (pure framework / public data):**
- Effects vs events thesis (universal concept)
- Tracking nodes (kernel conditions, physical flows, price architecture, geopolitical state)
- Domestic Supply as a category (rig counts, DUCs, production -- public data)
- Patterns of Life, Effect Chains, Signal Monitor, Live Feed tabs
- All data infrastructure (RSS, price fetching, classification engine)
- Classification engine logic (extracted and generalized)

### 2.3 Architecture: Engine / UI / Domain Separation

```
src/
  engine/                    <- GENERAL (never domain-specific)
    classify.js              <- effect/event scoring from domain keyword config
    signals.js               <- severity computation, threshold eval, live data merge
    regime.js                <- consolidation/dispersion, phase transition detection
    feeds.js                 <- RSS ingestion, proxy rotation, cache, dedup
    prices.js                <- commodity price fetching (multi-strategy)

  ui/                        <- GENERAL UI (renders whatever config provides)
    App.jsx                  <- loads active domain config, renders shell
    Header.jsx               <- dynamic branding + tabs from config
    ThesisView.jsx           <- renders domain thesis content with help hovers
    NodesView.jsx            <- tracking nodes grid with expandable detail
    EffectChainView.jsx      <- cascade flow visualization
    SignalMonitor.jsx         <- multi-dimensional signal grid + regime indicator
    LiveFeed.jsx             <- classified feed with chain mapping
    PatternsView.jsx         <- patterns of life visualization
    HelpHover.jsx            <- reusable tooltip for term education
    RegimeBadge.jsx          <- persistent regime state indicator
    DesignSystem.js          <- colors, typography, spacing, shared styles

  domains/                   <- DOMAIN-SPECIFIC (one folder per project)
    hormuz-iran/
      config.js              <- all domain-specific data (see section 2.4)
      content.jsx            <- thesis prose, node descriptions, watch-for text
      terms.js               <- domain-specific glossary for help hovers

    _template/               <- copy to create new domain
      config.js
      content.jsx
      terms.js

  terms/
    universal.js             <- framework-level glossary (semantic primes,
                                regime, phase transition, consolidation, etc.)

hf-proxy/
  app.py                     <- rebranded, reads domain config for feed sources

index.html                   <- JtechAi branding
package.json                 <- jtech-intel-platform, mr.white@jtech.ai author
```

**The rule**: Everything in engine/ and ui/ is domain-agnostic. Everything domain-specific lives in domains/<name>/. A new intelligence project = a new folder with config.js, content.jsx, and terms.js.

### 2.4 Domain Config Shape

Each domain's config.js exports:

```js
export default {
  // Identity
  id: "hormuz-iran",
  name: "Strait of Hormuz Crisis",
  subtitle: "Effects-Based Analysis",

  // Tabs -- which to show, in what order
  tabs: [
    { id: "thesis", label: "THE THESIS" },
    { id: "nodes", label: "TRACKING NODES" },
    { id: "patterns", label: "PATTERNS OF LIFE" },
    { id: "playbook", label: "EFFECT CHAINS" },
    { id: "monitor", label: "SIGNAL MONITOR" },
    { id: "feed", label: "LIVE FEED" },
  ],

  // Signal definitions
  signals: [
    { id: "pni", category: "kernel", name: "P&I Club Coverage", ... },
    // ...
  ],

  // Severity thresholds per signal
  severityThresholds: {
    brent: [["critical", 95], ["high", 80], ["moderate", 70]],
    // ...
  },

  // Category display metadata
  categories: {
    kernel: { label: "KERNEL CONDITION", color: "red" },
    physical: { label: "PHYSICAL FLOWS", color: "orange" },
    // ...
  },

  // Classification vocabulary
  effectKeywords: [...],
  eventKeywords: [...],
  chainTerms: { "Maritime Insurance Cascade": [...], ... },

  // Feed sources
  feedSources: [
    { id: "google-hormuz", name: "Google News -- Hormuz", url: "...", category: "maritime", priority: 1 },
    // ...
  ],

  // Commodity price strategies
  priceSymbols: {
    brent: "BZ=F",
    wti: "CL=F",
    ovx: "^OVX",
  },

  // Upstream verification links per tab
  verifySources: {
    thesis: [{ label: "MarineTraffic", url: "..." }, ...],
    // ...
  },
};
```

### 2.5 Visual & Educational Layer

**Help hovers**: Every technical term in the UI gets a tooltip:
- Framework terms (from terms/universal.js): "semantic prime," "condition:state," "phase transition," "regime," "consolidation," "dispersion," "Gini trajectory," "Betti count"
- Domain terms (from domains/*/terms.js): "P&I club," "VLCC," "backwardation," "force majeure," etc.
- Implementation: HelpHover component wraps any term, pulls definition from glossary

**Multi-dimensional signal visualizations**:
- Signal grid shows relationships between signals, not just individual cards
- Consolidation clustering: when signals agree, they visually group tighter
- Dispersion spreading: when signals disagree, visual separation increases
- Severity heat: color intensity maps to severity across the grid

**Regime state indicator (RegimeBadge)**:
- Persistent element visible on all tabs
- Shows current assessed regime: STABLE / TRANSITIONING / CRISIS
- Lists the top signals driving the assessment
- Updates as live data flows in

**Effect chain flow diagrams**:
- Visual cascade maps: insurance withdrawal -> fleet stoppage -> freight spike -> price restructuring
- Each node shows current condition:state
- Arrows show causal propagation direction
- Active chains highlighted based on live signal data

**Semantically neutral language**:
- No jargon that presumes domain expertise
- Terms are precise but accessible
- Every concept earnable through the interface itself (help hovers)
- Technical terms use universal vocabulary, not domain-specific shorthand

### 2.6 Branding

- **Platform name**: JTECH AI
- **Header subtitle**: All-Source Intelligence Platform
- **Author**: mr.white@jtech.ai
- **Co-author**: Claude Code (in commits, package.json)
- **Visual identity**: Dark theme retained (#0a0c10 bg), refined color palette in DesignSystem.js, Playfair Display + DM Sans typography
- **README**: Describes the platform generically with Hormuz/Iran as the included domain example

## 3. Deployment

- **GitHub Pages**: Static SPA (current deploy.yml workflow, updated)
- **Local**: npm run dev (Vite dev server)
- **HF Space**: Docker container serving frontend + API (current setup, rebranded)
- **Future**: Local server with LM Studio compute for advanced analysis

## 4. Future Cycles (Out of Scope for Cycle 1)

- Local LLM integration via LM Studio for semantic analysis
- Mathematical computation engine (MS-GARCH, Bayesian regime switching, topological data analysis)
- Domain config UI (create/edit domains through the interface)
- Multi-domain simultaneous monitoring
- Persistent storage / historical state tracking
- V&V framework for validating activity:state -> condition:state mappings

## 5. Success Criteria

- [ ] Zero references to old brand in any file
- [ ] No Portfolio Map tab or legacy asset content
- [ ] Engine, UI, and domain layers fully separated
- [ ] Hormuz/Iran works identically as a domain config (no regression)
- [ ] _template/ domain scaffold exists and is documented
- [ ] Help hovers functional on all framework terms
- [ ] Regime indicator visible and updating from live signals
- [ ] Effect chain visualization renders from domain config
- [ ] Deploys cleanly to GitHub Pages
- [ ] All commits authored mr.white@jtech.ai + Claude Code
