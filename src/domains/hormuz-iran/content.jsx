// Domain-specific prose and data for the Hormuz-Iran intelligence brief.
// Extracted from the monolithic App.jsx — contains all domain-unique content
// while keeping UI chrome and layout in shared template components.

import { COLORS, FONTS } from "../../ui/DesignSystem.js";
import Term from "../../ui/Term.jsx";

// ─── THESIS CONTENT ──────────────────────────────────────────
// The core thesis prose from ThesisTab (App.jsx ~lines 203-465).

export function ThesisContent({ terms = {} }) {
  return (
    <div style={{ padding: "32px", maxWidth: 1100 }}>
      {/* Central concept */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, #161a24 100%)`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "32px 36px",
        marginBottom: 28,
      }}>
        <h2 style={{ fontFamily: FONTS.heading, fontSize: 22, color: COLORS.gold, margin: "0 0 16px", fontWeight: 600 }}>
          The Core Insight: Events Are the Weather. Effects Are the Climate.
        </h2>
        <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7, margin: "0 0 16px" }}>
          Most operators, investors, and analysts track <strong style={{ color: COLORS.orange }}><Term t="event" terms={terms}>events</Term></strong> — "Iran closed the Strait,"
          "Brent hit $85," "OPEC announced 206K bpd increase." Events are loud, sudden, and they dominate
          every headline. They trigger emotional responses. They're the thunderclap.
        </p>
        <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7, margin: "0 0 16px" }}>
          The rare operator who consistently outperforms — across bull markets, bear markets, and especially
          during the violent transitions between them — tracks <strong style={{ color: COLORS.green }}><Term t="effect" terms={terms}>effects</Term></strong>. Effects are what
          actually changed in the physical world as a consequence of events. Not "Iran threatened closure" but
          <em> "tanker transits collapsed from 138/day to 1/day."</em> Not "oil prices surged" but <em>"seven of twelve
          P&I clubs canceled war risk coverage, removing insurance from 90% of the global fleet."</em>
        </p>
        <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7, margin: 0 }}>
          The difference sounds subtle. It is not. <strong style={{ color: COLORS.goldBright }}>It is the difference between reacting to noise and
          reading the actual state of the system.</strong> And that distinction becomes the difference between life and death
          during <Term t="phase transition" terms={terms}>phase transitions</Term> — the moments when the rules themselves are changing.
        </p>
      </div>

      {/* Event vs Effect visual */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", gap: 0, marginBottom: 28 }}>
        {/* Events column */}
        <div style={{
          background: `linear-gradient(180deg, ${COLORS.redDim}22 0%, ${COLORS.surface} 100%)`,
          border: `1px solid ${COLORS.redDim}`,
          borderRadius: "12px 0 0 12px",
          padding: 24,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: COLORS.red, fontWeight: 700, marginBottom: 12 }}>
            EVENTS (WHAT MOST PEOPLE TRACK)
          </div>
          {[
            "\"Iran closed the Strait of Hormuz\"",
            "\"Oil prices surged 15%\"",
            "\"OPEC+ agreed to increase production\"",
            "\"US launched Operation Epic Fury\"",
            "\"Markets in turmoil — Nikkei down 6.65%\"",
            "\"Analysts predict $100-200 oil\"",
          ].map((e, i) => (
            <div key={i} style={{
              padding: "8px 12px",
              margin: "6px 0",
              background: `${COLORS.red}10`,
              border: `1px solid ${COLORS.red}20`,
              borderRadius: 6,
              fontSize: 13,
              color: COLORS.textDim,
              fontStyle: "italic",
            }}>{e}</div>
          ))}
          <div style={{ marginTop: 16, padding: "12px", background: `${COLORS.red}15`, borderRadius: 8, fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
            Events are <strong style={{ color: COLORS.red }}>narration</strong>. They tell you a story happened.
            They don't tell you how much the story actually changed the physical world.
            Two events that sound identical can have completely different effects.
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.surface }}>
          <div style={{ fontSize: 24, color: COLORS.gold }}>→</div>
        </div>

        {/* Effects column */}
        <div style={{
          background: `linear-gradient(180deg, ${COLORS.greenDim}22 0%, ${COLORS.surface} 100%)`,
          border: `1px solid ${COLORS.greenDim}`,
          borderRadius: "0 12px 12px 0",
          padding: 24,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: COLORS.green, fontWeight: 700, marginBottom: 12 }}>
            EFFECTS (WHAT ACTUALLY CHANGED)
          </div>
          {[
            { text: "Tanker AIS signals: 138/day → 1 → 0", severity: "critical" },
            { text: "7/12 P&I clubs withdrew coverage (90% of fleet)", severity: "critical" },
            { text: "VLCC rates: $218K → $424K/day (all-time record)", severity: "high" },
            { text: "150+ vessels physically stranded in transit", severity: "high" },
            { text: "OPEC+ added 206K bpd (0.2% of demand — noise)", severity: "low" },
            { text: "QatarEnergy declared force majeure (20% global LNG)", severity: "critical" },
          ].map((e, i) => (
            <div key={i} style={{
              padding: "8px 12px",
              margin: "6px 0",
              background: `${e.severity === "critical" ? COLORS.green : e.severity === "high" ? COLORS.blue : COLORS.textMuted}15`,
              border: `1px solid ${e.severity === "critical" ? COLORS.green : e.severity === "high" ? COLORS.blue : COLORS.textMuted}30`,
              borderRadius: 6,
              fontSize: 13,
              color: COLORS.text,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: e.severity === "critical" ? COLORS.red : e.severity === "high" ? COLORS.orange : COLORS.textMuted,
                flexShrink: 0,
              }} />
              {e.text}
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "12px", background: `${COLORS.green}15`, borderRadius: 8, fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
            Effects are <strong style={{ color: COLORS.green }}>measurement</strong>. They tell you what physically moved.
            Insurance withdrawal is binary — either ships can sail insured or they can't.
            Tanker counts are countable. These are the <strong style={{ color: COLORS.green }}><Term t="condition:state" terms={terms}>condition:states</Term></strong> of the system.
          </div>
        </div>
      </div>

      {/* Phase transition explanation */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "28px 32px",
        marginBottom: 28,
      }}>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: 18, color: COLORS.gold, margin: "0 0 14px" }}>
          Why This Matters Most During Phase Transitions
        </h3>
        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7, margin: "0 0 14px" }}>
          A <strong style={{ color: COLORS.goldBright }}><Term t="phase transition" terms={terms}>phase transition</Term></strong> is the technical term for when the rules of the game
          change — not a bad day, not volatility, but a genuine shift in what "normal" means. Water doesn't
          get progressively colder until it freezes. It's liquid, liquid, liquid… then <em>solid</em>. The transition is
          sudden, nonlinear, and it changes every property of the substance. You can't navigate ice with a boat.
        </p>
        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7, margin: "0 0 14px" }}>
          Energy markets work the same way. For 50 years, the Strait of Hormuz was an open shipping lane —
          a background assumption so deeply embedded that nobody priced it. Then, in 72 hours, it became impassable.
          The "map" that every trader, insurer, and logistics company was using became <em>wrong</em>. Not slightly wrong.
          Categorically wrong. The geometry of the market — what's cheap, what's expensive, what's safe, what's risky —
          inverted completely.
        </p>

        {/* Visual: phase diagram */}
        <div style={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          marginTop: 20,
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ flex: 1, padding: "16px 20px", background: `${COLORS.blue}15` }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: COLORS.blue, fontWeight: 700, marginBottom: 8 }}>
              STABLE STATE: "RISK-ON"
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Hormuz open · Insurance normal · VLCC $20-40K/day · Brent $65-72 ·
              Model: optimize for cost efficiency, lean inventories, just-in-time delivery
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.blue }}>
              ← The "map" everyone was using
            </div>
          </div>
          <div style={{
            width: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(180deg, ${COLORS.red}40, ${COLORS.orange}40)`,
            padding: "12px 8px",
          }}>
            <div style={{ fontSize: 10, color: COLORS.goldBright, fontWeight: 700, textAlign: "center", letterSpacing: 1 }}>
              BOUNDARY<br/>LAYER
            </div>
            <div style={{ fontSize: 18, color: COLORS.goldBright, margin: "4px 0" }}>⚡</div>
            <div style={{ fontSize: 9, color: COLORS.textDim, textAlign: "center" }}>
              Feb 28 –<br/>Now
            </div>
          </div>
          <div style={{ flex: 1, padding: "16px 20px", background: `${COLORS.red}15` }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: COLORS.red, fontWeight: 700, marginBottom: 8 }}>
              NEW STATE: "CRISIS REGIME"
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Hormuz closed · No insurance · VLCC $424K/day · Brent $83-85+ ·
              Model: optimize for supply security, long inventory, domestic production
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.red }}>
              The new "map" →
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7, margin: "20px 0 0" }}>
          Here's the key: <strong style={{ color: COLORS.goldBright }}>the event-tracker is always late to a phase transition,
          and the effect-tracker is always early.</strong> The event-tracker waited for the headline "Iran closes Strait."
          The effect-tracker was already watching tanker AIS counts drop from 138 to 47 to 1 —
          <em>before</em> any formal announcement — and positioning accordingly. The effect-tracker doesn't need
          the announcement. The physical world already told the story.
        </p>
      </div>

      {/* Gini trajectory simplified */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.goldDim}`,
        borderRadius: 12,
        padding: "28px 32px",
      }}>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: 18, color: COLORS.gold, margin: "0 0 14px" }}>
          The One Question That Separates Transient Shocks from Structural Shifts
        </h3>
        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7, margin: "0 0 16px" }}>
          When a crisis hits, every indicator spikes. Oil, gold, VIX, freight rates — everything moves at once.
          The critical question isn't <em>"how much did things move?"</em> It's: <strong style={{ color: COLORS.goldBright }}>are the signals
          <Term t="consolidation" terms={terms}>consolidating</Term> or <Term t="dispersion" terms={terms}>dispersing</Term>?</strong>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ padding: 20, background: `${COLORS.green}10`, borderRadius: 8, border: `1px solid ${COLORS.green}30` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.green, marginBottom: 8 }}>
              DISPERSING → TRANSIENT SHOCK
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6 }}>
              Oil spikes but insurance stays. Tankers reroute but still transit. VLCC rates rise but from available capacity.
              VIX spikes then falls within days. <strong style={{ color: COLORS.text }}>The signals disagree with each other.</strong>
              Some say crisis, others say business as usual. This was June 2025 — the Israel-Iran 12-day war. Oil barely moved.
              Event was terrifying; effects were minimal.
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${COLORS.green}20`, borderRadius: 6, fontSize: 12, color: COLORS.green }}>
              Regime classification: Negative Gini trajectory. Signal dispersion indicates transient perturbation, not state change.
            </div>
          </div>
          <div style={{ padding: 20, background: `${COLORS.red}10`, borderRadius: 8, border: `1px solid ${COLORS.red}30` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, marginBottom: 8 }}>
              CONSOLIDATING → STRUCTURAL SHIFT
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6 }}>
              Oil spikes AND insurance withdraws AND tankers stop AND freight hits records AND LNG goes force majeure.
              <strong style={{ color: COLORS.text }}>Every independent indicator points the same direction.</strong>
              The signals are hierarchicalizing — fewer and fewer alternative explanations survive.
              This is March 2026. Every physical metric confirms disruption.
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${COLORS.red}20`, borderRadius: 6, fontSize: 12, color: COLORS.red }}>
              Regime classification: Positive Gini trajectory. Signal consolidation indicates genuine phase transition in progress.
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
          In the formal framework, this is called tracking the "<Term t="Gini trajectory" terms={terms}>Gini trajectory</Term> over Betti count" —
          measuring whether the dominant signals are absorbing the lesser ones (consolidation) or
          fragmenting into noise (dispersion). You don't need the math. You need the habit of asking:
          <strong style={{ color: COLORS.gold }}> "Are independent systems all telling me the same thing?"</strong>
        </p>
      </div>
    </div>
  );
}

// ─── NODES CATEGORIES DATA ───────────────────────────────────
// The 5 category objects with all node data from NodesTab (App.jsx ~lines 471-544).

export function getNodesCategories() {
  return [
    {
      id: "kernel",
      title: "THE KERNEL CONDITION",
      subtitle: "Insurance — the one indicator that gates everything else",
      color: COLORS.red,
      description: "Insurance is the kernel condition of global maritime trade. It's binary: either ships can sail with coverage, or they can't. When 7 of 12 P&I clubs pulled war risk coverage on March 3, they didn't just raise prices — they made it functionally illegal for most vessels to enter the Persian Gulf. No owner will risk an uninsured $150M VLCC. This single effect-indicator tells you more about the real state of the crisis than every news headline combined.",
      nodes: [
        { name: "P&I Club Status", current: "7/12 clubs withdrawn", signal: "critical", detail: "Gard, Skuld, NorthStandard, London, American Club, Steamship Mutual, Swedish Club — all out effective March 5. Covers ~90% of global fleet." },
        { name: "War Risk Premium Rate", current: "Effectively infinite", signal: "critical", detail: "No price available for remaining clubs. Market for coverage has ceased to function." },
        { name: "Reinsurance Market", current: "Suspended", signal: "critical", detail: "Munich Re, Swiss Re, Lloyd's syndicates have suspended Gulf coverage pending military assessment." },
      ],
      watchFor: "Phase transition signal: P&I club reinstatement. When insurers return, vessel transits follow within 48-72 hours. This is the leading indicator — all other recovery signals lag behind it."
    },
    {
      id: "physical",
      title: "PHYSICAL FLOW INDICATORS",
      subtitle: "What's actually moving (or not moving) in the real world",
      color: COLORS.orange,
      description: "Physical flows can't be faked, spun, or reinterpreted. A tanker either transited the Strait or it didn't. AIS transponder data, port arrivals, and pipeline nominations are the ground truth of energy markets.",
      nodes: [
        { name: "Daily Tanker Transits (AIS)", current: "0 signals March 2", signal: "critical", detail: "From 138/day January average. Single most dramatic metric — 100% collapse in 72 hours." },
        { name: "Stranded Vessel Count", current: "150+", signal: "high", detail: "Vessels in transit at time of closure. Each represents cargo, insurance claims, and supply chain disruption." },
        { name: "Bypass Pipeline Utilization", current: "~50% capacity used", signal: "moderate", detail: "East-West Petroline (5M bpd capacity) + ADCOP (1.5M bpd) = 6.5M total vs. 15M+ normally transiting. Gap of 8.5M+ bpd cannot be bypassed." },
        { name: "VLCC Spot Rates", current: "$423,736/day (record)", signal: "critical", detail: "Previous record was ~$350K during COVID tanker storage boom. Rates reflect both supply disruption and vessel unavailability." },
        { name: "SPR Drawdown Status", current: "~400M bbl (56% capacity)", signal: "high", detail: "Lowest since 1984. Biden released ~180M barrels 2022-23. Max drawdown 4.4M bpd for 90 days — covers ~25-30% of lost Hormuz flow. Full refill would cost $20B+ and take years." },
      ],
      watchFor: "Phase transition signal: First confirmed tanker transit through the Strait AND first insurance-backed cargo loading at Ras Tanura or Juaymah terminal. Both conditions must be met — one without the other is incomplete state change."
    },
    {
      id: "price",
      title: "PRICE ARCHITECTURE",
      subtitle: "The shape of the curve tells you what the market believes about duration",
      color: COLORS.blue,
      description: "The absolute price of oil tells you less than the structure of the forward curve. Backwardation (prompt prices above future prices) means the market believes the shortage is temporary. A flattening curve means it's becoming structural. The spread between WTI and Brent tells you about US isolation vs global exposure.",
      nodes: [
        { name: "Brent Front-Month", current: "~$83-85/bbl", signal: "high", detail: "Up 15-17% from $72 pre-strike. Still below $100 — market is pricing 2-4 week resolution." },
        { name: "WTI Cushing", current: "~$76/bbl", signal: "moderate", detail: "Brent-WTI spread widened to $7+ (from $4). US crude insulated but not immune." },
        { name: "WTI Forward Curve Shape", current: "Steep backwardation", signal: "high", detail: "Prompt $76 declining to $65 Dec 2026. Market consensus prices temporary disruption. Curve flattening at elevated levels would indicate shift to 'new normal' consensus." },
        { name: "Kansas Common Posted", current: "~$60-68/bbl (est.)", signal: "moderate", detail: "Typically $13-14 discount to WTI Cushing. Pre-crisis: $53.85. Post-crisis estimate reflects WTI pass-through." },
        { name: "OVX (Oil Volatility Index)", current: "63-69 (96th percentile)", signal: "high", detail: "Options market pricing extreme uncertainty. Both hedging cost and hedge value elevated simultaneously." },
      ],
      watchFor: "Regime signal: Curve flattening at elevated levels (backwardation collapse) = market consensus shifting from 'temporary disruption' to 'new normal.' This is the structural price signal — distinct from spot price movement."
    },
    {
      id: "domestic",
      title: "US DOMESTIC SUPPLY RESPONSE",
      subtitle: "Structural capacity constraints in the US production response",
      color: COLORS.purple,
      description: "The US shale machine — the world's swing producer — is structurally constrained. Oil-directed rig counts are down ~47% from late-2022 peaks. DUC (drilled uncompleted) inventories are at operational minimums. Even at $100 oil, it takes 6-9 months to meaningfully increase production. This inelasticity is the structural condition facing all existing domestic producers.",
      nodes: [
        { name: "Baker Hughes Oil Rig Count", current: "397 rigs (-47% from peak)", signal: "moderate", detail: "Down from 750 at Dec 2022 peak. ~517 total rigs (397 oil-directed). No meaningful response yet to Hormuz. At $50 WTI, rig counts could fall to 360-370." },
        { name: "DUC Inventory (Permian)", current: "~878 (halved from 2024)", signal: "high", detail: "Near operational minimum. Industry has been completing DUCs faster than drilling new ones for 18 months." },
        { name: "US Production Forecast", current: "~13.5M bpd → declining", signal: "moderate", detail: "Permian at ~6.6M bpd (45% of total). Diamondback CEO: 'At current oil prices, US shale oil production has likely peaked.' Breakevens ~$70/bbl avg, projected $95 by mid-2030s." },
        { name: "Frac Crew Availability", current: "Tight", signal: "moderate", detail: "Frac spread count has not increased with prices. Labor and equipment constraints limit response." },
      ],
      watchFor: "Regime signal: Rig count crossing above 450 oil rigs indicates meaningful supply response activation. Below 450, production declines continue regardless of price — structural inelasticity condition persists."
    },
    {
      id: "geopolitical",
      title: "GEOPOLITICAL STATE SPACE",
      subtitle: "Iran's collapsed tensor — regime, nuclear, proxy, and fiscal dimensions",
      color: COLORS.gold,
      description: "The February 28, 2026 strikes killed Supreme Leader Khamenei and triggered the first functional Hormuz closure in modern history. Iran's geopolitical state has collapsed into a singular crisis across regime stability, nuclear breakout, proxy activation, and fiscal failure dimensions. Each dimension reinforces the others — creating a self-amplifying crisis state.",
      nodes: [
        { name: "Iran Oil Production", current: "~100K bpd (from 1.7M)", signal: "critical", detail: "Kharg Island shut down post-strikes. Exports crashed 94%. Shadow fleet of ~1,500 tankers with ~300M barrels unsold at sea. Fiscal breakeven at $163/bbl (highest OPEC+)." },
        { name: "Regime Succession Status", current: "Contested", signal: "critical", detail: "Mojtaba Khamenei (age 56) selected by Assembly of Experts under IRGC pressure. Lacks religious credentials for father-son dynastic succession. Interim council formed March 2." },
        { name: "Nuclear Breakout Time", current: "Near-zero", signal: "critical", detail: "275 kg of 60%-enriched uranium — ~40x JCPOA limit. JCPOA formally terminated October 18, 2025. Fordow hit by GBU-57 bunker busters June 2025." },
        { name: "Proxy Network Activation", current: "Multi-front active", signal: "critical", detail: "Houthis resumed Red Sea attacks (Mar 2). Iraqi PMF groups declared participation. Iran struck Saudi Ras Tanura refinery (550K bpd). Hezbollah rearming despite severe degradation." },
        { name: "OPEC+ True Spare Capacity", current: "1.5-2.5M bpd (vs 5.3M official)", signal: "high", detail: "Independent analysts (Energy Aspects, Rapidan) estimate true deployable spare concentrated in Saudi Arabia and UAE only. Saudi has only produced 12M bpd for one month (Apr 2020)." },
        { name: "Geopolitical Risk Premium", current: "$7-9/bbl (likely underpriced)", signal: "high", detail: "Reuters poll of 34 analysts, Feb 2026. Compare: 1990 Gulf War ~$20-25/bbl premium, Russia-Ukraine 2022 ~$25-30/bbl. Current Hormuz closure is unprecedented in severity." },
      ],
      watchFor: "Phase transition signal: Duration threshold is 5 weeks. If closure extends beyond, Goldman projects $100 Brent. If Iranian retaliation degrades Saudi/UAE export infrastructure, market enters 1979-type structural repricing with multi-year mean reversion."
    },
  ];
}

// ─── EFFECT CHAINS ───────────────────────────────────────────
// Effect chain data from PlaybookTab (App.jsx ~lines 889-1143).
// Proprietary content removed: Pearsall Boundary Layer section,
// Kansas Common / Eagle Ford basin-specific chain entries.

export function getEffectChains() {
  return [
    {
      title: "MARITIME INSURANCE → PHYSICAL FLOW CASCADE",
      icon: "◈",
      chain: [
        { state: "P&I clubs withdraw war risk coverage", classification: "KERNEL", color: COLORS.red, downstream: "Removes legal basis for vessel transit. No owner exposes uninsured $150M hull to combat zone." },
        { state: "Tanker AIS transits collapse (138/day → 0)", classification: "PRIMARY EFFECT", color: COLORS.red, downstream: "15-17M bpd of crude, condensate, and LNG physically stops moving through the chokepoint." },
        { state: "VLCC spot rates hit all-time record ($424K/day)", classification: "SECONDARY EFFECT", color: COLORS.orange, downstream: "Remaining global vessel capacity reprices. Cape of Good Hope routing adds 10-14 days and $3-5M per voyage." },
        { state: "QatarEnergy declares force majeure on LNG contracts", classification: "TERTIARY EFFECT", color: COLORS.orange, downstream: "20% of global LNG supply enters contractual suspension. European and Asian gas markets decouple from spot." },
        { state: "SPR / IEA coordinated release enters consideration", classification: "POLICY RESPONSE", color: COLORS.blue, downstream: "411-415M barrel reserve. Max drawdown 4.4M bpd for 90 days. Covers ~25-30% of lost Hormuz flow." },
      ]
    },
    {
      title: "PRICE ARCHITECTURE → DOMESTIC ECONOMICS CASCADE",
      icon: "◆",
      chain: [
        { state: "Brent-WTI spread widens to $7+ (from $4 pre-crisis)", classification: "PRICE STRUCTURE", color: COLORS.blue, downstream: "US crude relatively insulated from global shock. Domestic barrels gain competitive advantage vs waterborne imports." },
        { state: "WTI forward curve enters steep backwardation", classification: "DURATION SIGNAL", color: COLORS.blue, downstream: "Market consensus: disruption is temporary (2-4 weeks). Prompt premium declining to $65 by Dec 2026. Curve shape encodes collective belief about resolution timeline." },
        { state: "OVX reaches 96th percentile (63-69)", classification: "VOLATILITY REGIME", color: COLORS.orange, downstream: "Options market prices extreme uncertainty. Hedging cost and hedging value both elevated simultaneously." },
      ]
    },
    {
      title: "SUPPLY INELASTICITY → STRUCTURAL CONSTRAINT CASCADE",
      icon: "◉",
      chain: [
        { state: "Baker Hughes oil rig count: 409 (-33% from 2022 peak)", classification: "CAPACITY", color: COLORS.purple, downstream: "Physical drilling activity insufficient to offset base decline rates. No meaningful rig response to price signal yet." },
        { state: "DUC inventory halved to ~878 (operational minimum)", classification: "BUFFER EXHAUSTION", color: COLORS.purple, downstream: "Industry has been completing DUCs faster than drilling new wells for 18 months. The backlog that historically absorbed price shocks is depleted." },
        { state: "EIA forecasts first US production decline since 2021", classification: "STRUCTURAL SHIFT", color: COLORS.red, downstream: "This is not price-responsive. Even at $100 WTI, 6-9 months minimum before meaningful production additions. The supply machine is structurally constrained." },
        { state: "Frac crew availability: tight, spread count flat", classification: "LABOR/EQUIPMENT", color: COLORS.orange, downstream: "Service sector has not rebuilt capacity shed during 2023-2024 downturn. Equipment and labor constraints limit theoretical response rate." },
      ]
    },
  ];
}

export function getScenarioPricing() {
  return [
    { scenario: "Negotiated Settlement", prob: "15-20%", price: "$62-65", driver: "Diplomatic off-ramp, OPEC spare deployed", color: COLORS.green },
    { scenario: "Prolonged Sanctions + Partial Reopening", prob: "35-40%", price: "$75-85", driver: "Sustained disruption, gradual normalization", color: COLORS.blue },
    { scenario: "Extended Closure (5+ weeks)", prob: "25-30%", price: "$95-110", driver: "15-20M bpd at risk, SPR/spare insufficient", color: COLORS.orange },
    { scenario: "Full Regional Conflagration", prob: "10-15%", price: "$120-150+", driver: "Saudi/UAE production hit, 1979-type structural shift", color: COLORS.red },
  ];
}

export function EffectChainClosing() {
  return (
    <>
      {/* Scenario-weighted price mapping (from Layer 4 of feedback report) */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 20,
      }}>
        <h3 style={{
          fontSize: 14, fontWeight: 700, color: COLORS.gold,
          letterSpacing: 1, margin: "0 0 6px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>◆</span>
          SCENARIO-WEIGHTED PRICE MAPPING
        </h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 16px" }}>
          Morgan Stanley / Dallas Fed framework. VIX-OVX divergence (OVX ~69 vs VIX ~18) confirms oil-specific supply shock,
          not broad macro fear. MS-GARCH regime detection confirms extreme-volatility state (Regime 2).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {getScenarioPricing().map((s, i) => (
            <div key={i} style={{
              padding: "16px", borderRadius: 8,
              background: `${s.color}08`, border: `1px solid ${s.color}25`,
              borderTop: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: 1, marginBottom: 8 }}>
                {s.scenario.toUpperCase()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 4 }}>
                {s.price}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Brent /bbl</div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: COLORS.text,
                padding: "4px 8px", borderRadius: 4,
                background: `${s.color}15`, display: "inline-block", marginBottom: 8,
              }}>
                P: {s.prob}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
                {s.driver}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: `${COLORS.gold}08`, border: `1px solid ${COLORS.gold}15`,
        }}>
          <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: COLORS.gold }}>Critical duration threshold: 5 weeks.</strong> If Hormuz reopens within 2-3 weeks,
            this follows the 2019 Abqaiq pattern (transitory, rapid mean reversion). Beyond 5 weeks &mdash; Goldman's threshold for
            $100 Brent &mdash; it enters 1990 Gulf War territory. If retaliation degrades Saudi/UAE infrastructure,
            the market enters <strong style={{ color: COLORS.red }}>1979-type structural repricing</strong> with multi-year mean reversion.
          </p>
        </div>
      </div>

      {/* Closing frame — objective, not prescriptive */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "28px 32px",
      }}>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: 18, color: COLORS.gold, margin: "0 0 14px" }}>
          The Geometry Is the Same at Every Scale
        </h3>
        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7, margin: "0 0 14px" }}>
          A global energy market passing from open-Hormuz to closed-Hormuz.
          A portfolio passing from one pricing regime to another.
          The structure is identical: stable state → boundary layer → new state. The condition:states change.
          The geometry of what's connected to what rearranges. The old map stops working.
        </p>
        <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.7, margin: "0 0 14px" }}>
          Effect-tracking is reading the actual topology of the system — what's physically true right now —
          rather than the narrative about what's true. Insurance status is binary. Tanker counts are countable.
          Curve shape is observable. Rig counts are published.
          None of these require interpretation. All of them require attention.
        </p>
        <p style={{ fontSize: 14, color: COLORS.goldBright, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
          The framework doesn't tell you what to do. It tells you what's actually happening —
          at every scale, in every regime, especially across the boundary layers where
          the difference between seeing clearly and not seeing at all is the entire game.
        </p>
      </div>
    </>
  );
}

// ─── PATTERNS CONTENT ────────────────────────────────────────
// AIS data status, phase detection methodology, historical correlation table,
// multi-scale regime detection. Extracted from PatternsTab.jsx.
// Standalone VERIFY_SOURCES removed — verify sources come from config.

export function PatternsContent({ terms = {} }) {
  return (
    <div style={{ padding: "32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: FONTS.heading, fontSize: 22, color: COLORS.gold, margin: "0 0 6px" }}>
          Patterns of Life — Analytical Framework
        </h2>
        <p style={{ fontSize: 13, color: COLORS.textDim, margin: 0, lineHeight: 1.5, maxWidth: 700 }}>
          Historical conflict-to-price correlation, multi-scale <Term t="regime" terms={terms}>regime</Term> detection methodology, and <Term t="phase transition" terms={terms}>phase transition</Term>{" "}
          framework. All data sourced from published records and verified analyst reports.
        </p>
      </div>

      {/* AIS Data Status — honest about what we don't have */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: COLORS.textMuted,
          }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.textMuted }}>
            LIVE AIS TRANSIT DATA — NOT CONNECTED
          </div>
        </div>
        <p style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 12px" }}>
          Real-time tanker transit tracking requires a live AIS data feed (MarineTraffic API, Kpler, or Vortexa).
          This dashboard does not currently have a live AIS connection. Verify transit status directly:
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "MarineTraffic — Hormuz Live Map", url: "https://www.marinetraffic.com/en/ais/home/centerx/56.3/centery/26.6/zoom/9" },
            { label: "Kpler — Tanker Flows", url: "https://www.kpler.com/" },
            { label: "Vortexa — Freight Analytics", url: "https://www.vortexa.com/" },
          ].map((src, i) => (
            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 5, fontSize: 11,
              background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}20`,
              color: COLORS.blue, textDecoration: "none", letterSpacing: 0.3,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.orange, flexShrink: 0 }} />
              {src.label}
            </a>
          ))}
        </div>
      </div>

      {/* Phase transition detection methodology */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 12 }}>
          PHASE DETECTION METHODOLOGY
        </div>
        <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 16px" }}>
          When connected to live AIS data, phase detection scores are computed from: 7-day transit volatility (25%),
          first derivative / rate of change (35%), second derivative / acceleration (20%), stranded vessel presence (20%),
          with an insurance withdrawal multiplier. Score &ge;75 = phase transition confirmed.
          Score &ge;40 = boundary layer entered. Score &ge;15 = perturbation detected.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {/* First derivative */}
          <div style={{
            padding: 16, borderRadius: 8,
            background: `${COLORS.blue}08`, border: `1px solid ${COLORS.blue}20`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.blue, letterSpacing: 1, marginBottom: 8 }}>
              FIRST DERIVATIVE (dx/dt)
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Rate of change in transit count. Measures <em>velocity</em> of flow change.
              Negative first derivative indicates declining transits. Magnitude indicates severity.
            </div>
          </div>

          {/* Second derivative */}
          <div style={{
            padding: 16, borderRadius: 8,
            background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}20`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.orange, letterSpacing: 1, marginBottom: 8 }}>
              SECOND DERIVATIVE (d²x/dt²)
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Acceleration of change. Measures whether decline is <em>accelerating</em> or <em>decelerating</em>.
              Sign change indicates inflection point (system approaching terminal state).
            </div>
          </div>

          {/* Kernel condition */}
          <div style={{
            padding: 16, borderRadius: 8,
            background: `${COLORS.purple}08`, border: `1px solid ${COLORS.purple}20`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.purple, letterSpacing: 1, marginBottom: 8 }}>
              KERNEL CONDITION
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              Insurance withdrawal is the binary gate function. When P&I clubs withdraw coverage,
              transit cessation follows within 48-72 hours regardless of other conditions.
              This is the near-sufficient condition for closure.
            </div>
          </div>
        </div>
      </div>

      {/* Historical conflict-to-price correlation — TRUE reference data */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.gold }}>
            HISTORICAL CONFLICT-TO-PRICE CORRELATION
          </div>
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            padding: "2px 6px", borderRadius: 3,
            background: `${COLORS.blue}15`, color: COLORS.blue,
          }}>VERIFIED REFERENCE DATA</span>
        </div>
        <p style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, margin: "0 0 16px" }}>
          Mean reversion times have shortened dramatically due to US shale elasticity, SPR availability, and faster information flow.
          Source: EIA historical data, academic literature, analyst reports (Goldman Sachs, Morgan Stanley, Dallas Fed).
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                {["Event", "Initial Shock", "Time to Peak", "Mean Reversion", "Type"].map(h => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: "left", fontSize: 10,
                    fontWeight: 700, letterSpacing: 1, color: COLORS.gold,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { event: "1973 Arab Embargo", shock: "+300%", peak: "~3 months", reversion: "Never", type: "Structural", color: COLORS.red },
                { event: "1979 Iran Revolution", shock: "+150%", peak: "~18 months", reversion: "~6-7 years", type: "Structural", color: COLORS.red },
                { event: "1990 Gulf War", shock: "+120%", peak: "~2.5 months", reversion: "~6 months", type: "Transitory", color: COLORS.orange },
                { event: "2003 Iraq Invasion", shock: "+30%", peak: "Pre-invasion", reversion: "Days (premium)", type: "Mixed", color: COLORS.blue },
                { event: "2019 Abqaiq Attack", shock: "+15%", peak: "1 day", reversion: "~2 weeks", type: "Transitory", color: COLORS.green },
                { event: "2022 Russia-Ukraine", shock: "+30%", peak: "~3 weeks", reversion: "~8 weeks", type: "Transitory", color: COLORS.orange },
                { event: "2026 Iran/Hormuz (current)", shock: "+13% (day 1)", peak: "TBD", reversion: "TBD", type: "TBD — monitoring", color: COLORS.gold, isCurrent: true },
              ].map(row => (
                <tr key={row.event} style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: row.isCurrent ? `${COLORS.gold}08` : "transparent",
                }}>
                  <td style={{ padding: "8px 12px", color: row.color, fontWeight: 600 }}>{row.event}</td>
                  <td style={{ padding: "8px 12px", color: COLORS.text }}>{row.shock}</td>
                  <td style={{ padding: "8px 12px", color: COLORS.textDim }}>{row.peak}</td>
                  <td style={{ padding: "8px 12px", color: COLORS.textDim }}>{row.reversion}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                      padding: "2px 6px", borderRadius: 3,
                      background: `${row.color}15`, color: row.color,
                    }}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Scale Regime Detection */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.goldDim}12, ${COLORS.surface})`,
        border: `1px solid ${COLORS.goldDim}`,
        borderRadius: 12,
        padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: FONTS.heading, fontSize: 18, color: COLORS.gold, margin: 0 }}>
            Multi-Scale Regime Detection (MS-GARCH Framework)
          </h3>
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            padding: "2px 6px", borderRadius: 3,
            background: `${COLORS.blue}15`, color: COLORS.blue,
          }}>METHODOLOGY — Scarcioffolo & Etienne (2021)</span>
        </div>
        <p style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7, margin: "0 0 16px" }}>
          Markov-Switching GARCH identifies two volatility regimes: Regime 1 (low, persistent, tranquil) and
          Regime 2 (high, less persistent, agitated). The RS-GARCH-MIDAS framework significantly beats
          single-regime counterparts in out-of-sample forecasting. Key diagnostic: VIX-OVX divergence —
          when OVX spikes without corresponding VIX move, this confirms oil-specific supply shock, not broad macro fear.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            {
              scale: "MICRO (hours)",
              indicator: "AIS transponder signals",
              what: "Verify at MarineTraffic",
              detection: "Leading indicator — detectable before formal announcements",
              color: COLORS.blue,
            },
            {
              scale: "MESO (days)",
              indicator: "Insurance market binary state",
              what: "Verify at IGPANDI.org",
              detection: "Kernel condition change = leading indicator for physical flows",
              color: COLORS.orange,
            },
            {
              scale: "MACRO (weeks)",
              indicator: "Forward curve structure",
              what: "Verify at CME NYMEX",
              detection: "Curve shape encodes market belief about disruption duration",
              color: COLORS.purple,
            },
            {
              scale: "STRUCTURAL (months)",
              indicator: "Supply response capacity",
              what: "Verify at Baker Hughes, EIA",
              detection: "Inelasticity is the condition — not the event",
              color: COLORS.red,
            },
          ].map((s, i) => (
            <div key={i} style={{
              padding: 16, borderRadius: 8,
              background: `${s.color}08`, border: `1px solid ${s.color}20`,
              borderLeft: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: 1, marginBottom: 6 }}>
                {s.scale}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                {s.indicator}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>
                {s.what}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
                {s.detection}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
