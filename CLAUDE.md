# JtechAi Platform — Development Standards

## NO SYNTHETIC DATA — EVER

**This is a hard rule. There are no exceptions.**

All testing, validation, backtesting, and verification in this repository MUST use real-world data sourced from human-constructed datasets. The planet has oceans of publicly available historical data for every signal this platform tracks. Use it.

### What this means:

- **Never** generate fake signal arrays with hand-picked severity levels
- **Never** fabricate price series, volume data, or indicator values
- **Never** use placeholder or "representative" data when real data exists
- **Never** call a test a "backtest" if it runs against synthetic inputs
- **Always** source historical data from authoritative providers (EIA, CBOE, Yahoo Finance, MarineTraffic, Baker Hughes, etc.)
- **Always** document the data source, date range, and retrieval method
- **Always** validate model outputs against known real-world market states

### Why:

A platform that claims to decode reality cannot be validated against fiction. If the math cannot be verified against real historical data, the math is unproven. Unproven math behind confident vocabulary is exactly the dishonesty this platform exists to eliminate.

### For backtests specifically:

1. Pull historical time series from public APIs or archived datasets
2. Run signal data through the same `computeSeverity` thresholds the live platform uses
3. Feed resulting severity distributions through Gini, coherence, regime, and transition intensity functions
4. Compare computed regime classifications against documented historical market states
5. Report discrepancies as model calibration issues, not test failures

---

## GEOMETRIC VALIDATION — NO HARDCODED EXPECTED VALUES

**Validations test the SHAPE of mathematical output, not specific labels or numbers.**

The mathematical framework produces regime classifications from signal geometry. Tests must validate the **topology** of the signal distribution relative to its baseline — not match hardcoded regime labels or numeric thresholds.

### The Principle:

The correct test is whether the math produces the right **relationship** between baseline, peak, and recovery — not whether a specific date produces a specific regime label. Labels are a derivative of geometry. Test the geometry.

### What this means:

- **Never** write `validate(regime === "CRISIS CONSOLIDATION")` — this hardcodes a label
- **Always** write `validate(peakMean > baselineMean)` — this tests the geometric relationship
- **Never** assert a specific numeric value for Gini, mean, or coherence on a date
- **Always** assert the **direction** and **relative magnitude**: peak > baseline, convergence at peak, recovery narrows distance
- **Never** tune expected values to make tests pass — if the geometry doesn't hold, the model needs work
- **Always** validate structural invariants across the full trajectory:
  - Mean escalates from baseline → crisis peak (widening)
  - Gini converges at peak (signals enter same severity band)
  - Recovery narrows the mean back toward baseline
  - Transition intensity at event onset > pre-event baseline
  - Coherence at consolidated crisis > coherence at transient shock
  - Mean-Gini Pearson r < 0 during consolidation phases (inverse relationship)

### Why:

The framework claims that language (severity labels) derives from mindset (analytical frame), which determines regime classification (activity selection basis). If we hardcode expected regime labels, we're testing our assumptions, not the math. Geometric validation tests whether the mathematical properties **hold** regardless of which specific quadrant the signals land in.

A test that says "peak Gini < 0.15" is testing that signals converge at crisis peak — this is a geometric property. A test that says "regime = CRISIS CONSOLIDATION" is testing that our thresholds happen to produce a specific label — this is brittle and domain-coupled.

### For implementation and planning:

When writing backtest validations, domain configs, or cross-domain invariance tests:
1. Define the **baseline geometry** (signal distribution at rest)
2. Define **key dates** as topology markers (onset, peak, inflection, recovery)
3. Validate the **mathematical relationships** between those markers
4. Report the regime labels for human inspection, but don't assert them

---

## Author

mr.white@jtech.ai + Claude Code
