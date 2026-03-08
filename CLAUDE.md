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

## Author

mr.white@jtech.ai + Claude Code
