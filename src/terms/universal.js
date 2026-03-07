// Framework-level glossary — universal terms used across all JtechAi domains.
// These definitions power the HelpHover component for inline term explanations.

export default {
  "effect": "A measurable change in the physical state of a system caused by an event. Effects are countable, observable, and binary — a tanker either transited or it didn't. Tracking effects rather than events gives structural insight into what actually changed.",

  "event": "A narrated occurrence — something that happened and was reported. Events are loud and drive headlines but don't tell you how much the physical world actually changed. Two events that sound identical can produce completely different effects.",

  "condition:state": "The current measurable state of a specific system variable. For example, 'P&I coverage: 3/12 active' is a condition:state. Condition:states are the atoms of effect-tracking — discrete, observable facts about what is true right now.",

  "activity:state": "The rate of change of a condition:state over time. While a condition:state tells you where something is, an activity:state tells you how fast it is moving and in which direction. First and second derivatives of condition:states.",

  "phase transition": "A sudden, nonlinear shift in the rules governing a system — not just a bad day or high volatility, but a genuine change in what 'normal' means. Like water freezing: liquid, liquid, liquid, then solid. During phase transitions, the old map of the system stops working entirely.",

  "regime": "A persistent market state characterized by distinct statistical properties. Markets alternate between regimes (e.g., low-volatility tranquil vs. high-volatility agitated). Regime detection identifies which set of rules currently governs price behavior.",

  "consolidation": "When independent signals begin pointing in the same direction after a shock. Signal consolidation (positive Gini trajectory) indicates a genuine structural shift rather than a transient perturbation. The more independent systems that agree, the more likely the phase transition is real.",

  "dispersion": "When signals disagree with each other after a shock — some indicating crisis, others indicating business as usual. Signal dispersion (negative Gini trajectory) suggests a transient perturbation that will mean-revert, not a structural change.",

  "kernel condition": "The single binary indicator that gates all downstream effects. In maritime trade, insurance coverage is the kernel condition: either ships can sail insured or they cannot. When the kernel condition flips, everything downstream follows within hours to days.",

  "semantic prime": "An irreducible concept that cannot be explained in simpler terms within the framework. Effect, event, and condition:state are semantic primes — they define the vocabulary from which all other analytical concepts are built.",

  "boundary layer": "The transitional zone between two stable states during a phase transition. In the boundary layer, the old rules are failing but the new rules haven't fully taken hold. This is where the most value — and the most risk — concentrates.",

  "Gini trajectory": "A measure of whether the dominant signals in a system are absorbing lesser ones (consolidation) or fragmenting into noise (dispersion). Tracks the trajectory of signal inequality over time. Rising Gini = consolidation = structural shift likely.",

  "effect chain": "The causal sequence through which one changed condition:state alters the boundary conditions for the next. For example: insurance withdrawal → transit collapse → freight spike → LNG force majeure. Each link is independently verifiable.",

  "severity": "A classification of how far a condition:state has deviated from its baseline. Levels range from watch (within normal bounds) through moderate, high, and critical (extreme deviation indicating system stress or failure).",

  "coherence": "The degree to which independent indicators agree on the current system state. High coherence across multiple signals that share no common data source is strong evidence of a real structural condition rather than noise or manipulation.",

  "MS-GARCH": "Markov-Switching Generalized Autoregressive Conditional Heteroskedasticity. A statistical model that identifies distinct volatility regimes in financial time series. It detects when a market transitions from a tranquil state to an agitated state and vice versa.",

  "backwardation": "A forward curve structure where near-term prices are higher than future prices. In commodity markets, backwardation signals that the market believes the current shortage is temporary and prices will decline. The steeper the backwardation, the stronger the transitory consensus.",

  "contango": "A forward curve structure where future prices are higher than near-term prices. Contango in oil markets suggests adequate current supply with expectations of future tightening. It is the opposite of backwardation.",
};
