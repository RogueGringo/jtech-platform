// Framework-level glossary — universal terms used across all JtechAi domains.
// These definitions power the HelpHover component for inline term explanations.

export default {
  "effect": "A measurable change in the physical state of a system caused by an event. Effects are countable, observable, and binary — a tanker either transited or it didn't. Tracking effects rather than events gives structural insight into what actually changed.",

  "event": "A narrated occurrence — something that happened and was reported. Events are loud and drive headlines but don't tell you how much the physical world actually changed. Two events that sound identical can produce completely different effects.",

  "condition:state": "The current measurable state of a specific system variable. For example, 'P&I coverage: 3/12 active' is a condition:state. Condition:states are the atoms of effect-tracking — discrete, observable facts about what is true right now.",

  "activity:state": "The rate of change of a condition:state. Computed as the delta between current severity rank and baseline severity rank from configuration. Also tracks delta from the previous snapshot when history is available. Positive delta = escalating, negative = deescalating.",

  "phase transition": "A sudden, nonlinear shift in the rules governing a system. Detected via transition intensity: the change vector magnitude (sqrt of sum of squared deltas from baseline) plus alignment (fraction of signals moving in the same direction). High magnitude + high alignment (>= 70%) = phase transition. High magnitude + low alignment = turbulence.",

  "regime": "A persistent system state classified from 2D (mean severity, Gini coefficient) space. Four regimes: STABLE (low mean, low Gini), TRANSIENT SPIKE (low mean, high Gini), CRISIS CONSOLIDATION (high mean, low Gini), BOUNDARY LAYER (high mean, high Gini). Thresholds: mean >= 2.5, Gini >= 0.2.",

  "consolidation": "When independent signals begin pointing in the same direction after a shock. Detected when the Gini trajectory slope is positive (severity concentrating into fewer, higher-ranked signals). The more independent categories that agree, the more likely the phase transition is real.",

  "dispersion": "When signals disagree with each other after a shock — some indicating crisis, others business as usual. Detected when the Gini trajectory slope is negative (severity spreading across signals). Suggests a transient perturbation that will mean-revert, not a structural change.",

  "kernel condition": "The single binary indicator that gates all downstream effects. In maritime trade, insurance coverage is the kernel condition: either ships can sail insured or they cannot. When the kernel condition flips, everything downstream follows within hours to days.",

  "semantic prime": "An irreducible concept that cannot be explained in simpler terms within the framework. Effect, event, and condition:state are semantic primes — they define the vocabulary from which all other analytical concepts are built.",

  "boundary layer": "A computed regime state: high mean severity (>= 2.5) + high Gini coefficient (>= 0.2). Severity is elevated but concentrated unevenly — the system is between stable states. The old rules are failing but the new rules haven't fully taken hold. This is where the most value and risk concentrate.",

  "Gini trajectory": "The slope of the Gini coefficient computed over recent signal snapshots (minimum 3 required). Positive slope means severity is concentrating into fewer signals (consolidation). Negative slope means severity is spreading (dispersion). Computed as (G_recent - G_oldest) / intervals.",

  "effect chain": "The causal sequence through which one changed condition:state alters the boundary conditions for the next. For example: insurance withdrawal → transit collapse → freight spike → LNG force majeure. Each link is independently verifiable.",

  "severity": "A classification of how far a condition:state has deviated from its baseline. Levels range from watch (within normal bounds) through moderate, high, and critical (extreme deviation indicating system stress or failure).",

  "coherence": "The degree to which independent categories agree on system state. Measured as (1 - CV) * 100 where CV is the coefficient of variation across category mean severity ranks. High coherence means categories report similar severity levels — strong evidence of structural condition rather than noise.",

  "MS-GARCH": "Markov-Switching Generalized Autoregressive Conditional Heteroskedasticity. A statistical model that identifies distinct volatility regimes in financial time series. (Planned for future implementation cycle — not yet computed by the platform.)",

  "backwardation": "A forward curve structure where near-term prices are higher than future prices. In commodity markets, backwardation signals that the market believes the current shortage is temporary and prices will decline. The steeper the backwardation, the stronger the transitory consensus.",

  "contango": "A forward curve structure where future prices are higher than near-term prices. Contango in oil markets suggests adequate current supply with expectations of future tightening. It is the opposite of backwardation.",
};
