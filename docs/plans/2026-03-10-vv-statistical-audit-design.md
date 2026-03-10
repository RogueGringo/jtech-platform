# V&V Statistical Audit — Design Document

**Date**: 2026-03-10
**Author**: mr.white@jtech.ai + Claude Code
**Approach**: Dedicated V&V suite, separate from calibration backtests
**Significance threshold**: α = 0.001 (99.9% confidence — rare and undeniable)
**Status**: APPROVED

---

## 1. Overview

The Cycle 6 market analysis backtests produced calibration claims from 5 real OHLCV events. These claims are point estimates with zero inferential statistics — no confidence intervals, no p-values, no null hypothesis tests. This V&V suite stress-tests every claim at α = 0.001 with bootstrap resampling, permutation tests, binomial tests, and three layers of negative controls.

### Claims Under Scrutiny

1. **Polarity Inversion**: Market data has positive mean-Gini correlation (r=+0.487), text data has negative (r=-0.907). If real, this means different data types have topologically *opposite* crisis signatures.
2. **Walk-Forward Predictive Value**: Trajectory calls (CONSOLIDATING, ACCELERATING, etc.) predict forward returns at 51.5% (5d) and 50.8% (10d) — barely above chance.
3. **Engine Lead Time**: Topological engine detects regime shifts +6 to +17 trading days before traditional single-variable quant signals.
4. **Cross-Source Coherence**: GDELT linguistic events and FRED oil prices produce correlated regimes (r=0.802) on the same event with zero coordination.

### Design Principles

- **Calibration and validation are different concerns.** Existing backtests discover geometry. V&V proves the geometry is statistically real.
- **α = 0.001 everywhere.** If a claim can't survive 99.9% scrutiny, it's not a claim. Same doctrine as the platform: conviction must be rare and undeniable.
- **Three verdicts only.** CONFIRMED at α=0.001, INCONCLUSIVE (insufficient power), or REJECTED (claim does not survive scrutiny). No ambiguity.
- **Adaptive sample sizing.** Start with 15 events, run power analysis, keep adding until CIs stabilize or hit 25.

---

## 2. Component 1: Statistical Utilities

### `tests/lib/statistics.js`

Pure inferential functions the codebase currently lacks:

- **`bootstrapCI(data, statFn, α=0.001, B=10000)`** — BCa bootstrap confidence intervals. Resample `data` B times, compute `statFn` each time, return [lower, upper] bounds at 1-α confidence.
- **`permutationTest(xs, ys, statFn, B=10000)`** — Two-sample permutation test. Shuffle labels B times, compute test statistic each time, return p-value = fraction of permuted stats ≥ observed.
- **`binomialTest(successes, trials, p0=0.5)`** — Exact binomial test against null hypothesis of chance. Returns p-value via cumulative binomial probability.
- **`pearsonCI(r, n, α=0.001)`** — Fisher z-transform confidence interval for Pearson r.
- **`powerAnalysis(data, statFn, targetWidth, α=0.001, B=5000)`** — Estimate whether current sample size produces CIs narrower than `targetWidth`. Returns { sufficient, currentWidth, recommendedN }.
- **`fisherZTest(r1, n1, r2, n2)`** — Tests whether two Pearson correlations are significantly different. Returns z-statistic and p-value.

All pure functions. No side effects. No dependencies beyond Math.

---

## 3. Component 2: Expanded Event Set

### Seed Events (existing 5)

| Event | Ticker | Bars | Source |
|---|---|---|---|
| GFC 2008 | SPY | 503 | Yahoo Finance |
| COVID 2020 | SPY | 145 | Yahoo Finance |
| SVB 2023 | KRE | 144 | Yahoo Finance |
| NVDA AI Run 2023 | NVDA | 332 | Yahoo Finance |
| GME Squeeze 2021 | GME | 145 | Yahoo Finance |

### Initial Expansion (+10 events)

| Event | Ticker | Dates | Crisis Type |
|---|---|---|---|
| Dot-com Crash | QQQ | 2000-03 → 2002-10 | Sector bubble burst |
| Flash Crash 2010 | SPY | 2010-05-01 → 2010-06-15 | Transient algorithmic |
| EU Debt Crisis 2011 | EWG | 2011-07 → 2012-01 | Sovereign contagion |
| Taper Tantrum 2013 | TLT | 2013-05 → 2013-09 | Rate shock |
| China Deval 2015 | FXI | 2015-06 → 2016-02 | Currency/equity cascade |
| Oil Crash 2014 | XLE | 2014-06 → 2016-02 | Commodity collapse |
| Volmageddon 2018 | SPY | 2018-01 → 2018-04 | Volatility regime |
| Yen Carry Unwind 2024 | EWJ | 2024-07 → 2024-09 | Cross-asset dissolution |
| Tariff Shock 2025 | KWEB | 2025-03 → 2025-05 | Macro policy |
| Crypto Contagion 2022 | COIN | 2022-04 → 2022-12 | Sector blowup |

### Adaptive Sizing

After initial 15 events, run `powerAnalysis()` on the mean-Gini correlation bootstrap. If CI width > 0.15, add events from reserve list:
- LTCM 1998 (SPY), Brexit 2016 (EWU), Turkey 2018 (TUR), Archegos 2021 (VIAC), Meme Stocks 2024 (RDDT)

Stop when CIs stabilize or 25 events reached.

### Data Pipeline

`tests/data/market/fetch-market-data.py` extended — all Yahoo Finance via yfinance, computes all 12 technicals inline. Zero synthetic data.

---

## 4. Component 3: Three-Layer Negative Controls

### Layer N1: Calendar Controls

Known low-volatility periods:
- SPY 2013-06 → 2014-06 (post-taper, pre-China — VIX avg 13.5)
- SPY 2017-01 → 2017-12 (lowest annual VIX in history, avg 11.1)
- SPY 2019-04 → 2019-09 (quiet mid-cycle, no macro shocks)

**Pass condition**: Engine produces STABLE regime on ≥ 90% of trading days. False positive rate > 10% at α = 0.001 means severity thresholds need recalibration.

### Layer N2: Volatility Controls

- Pull VIX daily from Yahoo Finance (`^VIX`), find the 5 longest continuous stretches where VIX < 15
- Run SPY through the engine for each stretch
- **Pass condition**: Mean severity < 1.5 (watch-level), Gini > 0.15 (dispersed, not converging). Crisis topology in objectively calm markets = miscalibrated σ thresholds.

### Layer N3: Permutation Controls (Null Hypothesis)

- Take each of the 15+ real OHLCV datasets
- Shuffle bar order randomly (destroying temporal structure, preserving marginal distributions)
- Run through the engine 1000 times per event
- **Pass condition**: Permuted mean-Gini r falls within [-0.1, +0.1] in ≥ 99.9% of shuffles. Real r must fall outside the permutation distribution's 99.9% bounds. This IS the null hypothesis test — if the engine can't distinguish real from shuffled, every claim collapses.

---

## 5. Component 4: V&V Test Suite

### `tests/vv-polarity-inversion.js`

The central claim. Market crisis = indicator disagreement (positive mean-Gini), text crisis = signal convergence (negative mean-Gini).

- Compute mean-Gini Pearson r for every market event (15+) and every text domain (GDELT, CrisisFACTS, Oil/Hormuz)
- `fisherZTest(r_market, n_market, r_text, n_text)` — are the two correlations significantly different at α = 0.001?
- `bootstrapCI` on each r — do the 99.9% confidence intervals NOT overlap?
- `permutationTest` — shuffle category assignments within each domain, does the polarity vanish?
- **Verdict**: CONFIRMED if Fisher z p < 0.001 AND bootstrap CIs don't overlap AND permuted r collapses to ~0

### `tests/vv-walkforward.js`

Walk-forward hit rates across all 15+ events.

- `binomialTest(hits, trials, 0.5)` at each horizon — is hit rate significantly above chance?
- Stratify by trajectory type: CONSOLIDATING alone, ACCELERATING alone, combined
- Report per-event and pooled hit rates with 99.9% CIs
- **Verdict**: CONFIRMED if pooled binomial p < 0.001

### `tests/vv-lead-time.js`

Engine vs traditional quant detection timing.

- Run on all 15+ events
- `bootstrapCI` on lead-time distribution — is the mean lead time significantly > 0 days?
- Stratify: structural crises (multi-sector) vs transient shocks (single-day)
- **Verdict**: CONFIRMED if lower bound of 99.9% CI > 0

### `tests/vv-cross-source.js`

Cross-source regime coherence.

- `pearsonCI` on every cross-source correlation (GDELT-Brent, GDELT-mean, etc.)
- `permutationTest` — shuffle temporal alignment between sources, does coherence vanish?
- **Verdict**: CONFIRMED if all CIs exclude 0 AND permuted coherence < 0.1

### `tests/vv-negative-controls.js`

All three negative control layers in one file.

- Calendar + volatility + permutation independently scored
- **Verdict**: Engine is calibrated if false positive rate < 10% (calendar), mean severity < 1.5 (volatility), permuted topology indistinguishable from noise (permutation)

### `tests/vv-power-analysis.js`

Adaptive sample sizing.

- After all events loaded, run `powerAnalysis` on key claims
- Report whether current N is sufficient for 99.9% CIs narrower than 0.15
- If not, output list of recommended additional events to pull
- **Verdict**: Sample size sufficient if CI width < 0.15 for all primary claims

---

## 6. Execution

```bash
# Pull expanded event data
python tests/data/market/fetch-market-data.py

# Run V&V suite
node tests/vv-polarity-inversion.js    # The profound claim
node tests/vv-walkforward.js           # Predictive value
node tests/vv-lead-time.js             # Speed advantage
node tests/vv-cross-source.js          # Cross-domain coherence
node tests/vv-negative-controls.js     # False positive / null hypothesis
node tests/vv-power-analysis.js        # Sample sufficiency
```

Each test prints a verdict: **CONFIRMED at α=0.001**, **INCONCLUSIVE (insufficient power)**, or **REJECTED (claim does not survive scrutiny)**.

---

## 7. What Changes vs What Stays

### Stays Untouched

- All existing backtests (calibration layer — unchanged)
- All engine code (dynamics, topology, homology, zipf, projection)
- All adapters (market, financial-text, GDELT, CrisisFACTS)
- All domain configs and UI

### New Files

- `tests/lib/statistics.js` — inferential statistics utilities
- `tests/vv-polarity-inversion.js` — polarity inversion V&V
- `tests/vv-walkforward.js` — walk-forward predictive value V&V
- `tests/vv-lead-time.js` — engine lead time V&V
- `tests/vv-cross-source.js` — cross-source coherence V&V
- `tests/vv-negative-controls.js` — three-layer negative controls
- `tests/vv-power-analysis.js` — adaptive sample sizing
- `tests/data/market/*.csv` — additional OHLCV files for expanded events + negative controls

### Modified Files

- `tests/data/market/fetch-market-data.py` — extended with new tickers/date ranges

---

## 8. Possible Outcomes

### If claims CONFIRM at α = 0.001:
The topological framework has survived the most rigorous statistical scrutiny applied to any regime detection system. The polarity inversion is a genuine discovery about how different data types encode crisis.

### If claims are INCONCLUSIVE:
Sample size is insufficient. The adaptive sizing will tell us exactly how many more events we need. Pull them and re-run.

### If claims are REJECTED:
The calibration findings were artifacts of small sample sizes or threshold sensitivity. The engine's math is still valid (Gini, coherence, topology are well-defined), but the specific market claims need recalibration. This is the system working correctly — V&V exists to catch exactly this.
