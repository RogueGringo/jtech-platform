# Recalibration Grid Search — Design Document

**Date**: 2026-03-10
**Author**: mr.white@jtech.ai + Claude Code
**Trigger**: V&V audit N1 (calendar) and N3 (permutation) failures
**Status**: APPROVED

---

## Problem

The σ-based severity thresholds (1.0/1.5/2.0) and 60-bar rolling baseline are too sensitive:
- **N1 Failure**: Engine flags TRANSIENT SPIKE on 54-65% of bars during 2017 SPY (quietest year on record)
- **N3 Failure**: Shuffled OHLCV data retains mean-Gini topology (mean |r| = 0.52 vs threshold < 0.1)

## Approach: Empirical Grid Search

Sweep baseline window × threshold sets. For each combo, run a gated three-check gauntlet. Pick the tightest thresholds that pass all three.

### Search Space (16 combinations)

**Baselines**: [90, 120, 180, 252] trading days

**Threshold Sets** (watch/moderate/high/critical σ):
- Set 1: 0.0 / 1.0 / 1.5 / 2.0 (current — too tight)
- Set 2: 1.0 / 1.5 / 2.0 / 2.5 (shifted +0.5)
- Set 3: 1.5 / 2.0 / 2.5 / 3.0 (shifted +1.0)
- Set 4: 1.0 / 2.0 / 3.0 / 4.0 (geometric widening)

### Gated Gauntlet

1. **N1 Calendar** (SPY 2017) — STABLE ≥ 90%? Fast. If FAIL → skip.
2. **True Positive** (GFC Lehman Sep-Nov 2008) — Non-STABLE detected? Fast. If FAIL → skip.
3. **N3 Permutation** (GFC shuffled, 50 perms) — Mean permuted |r| < 0.1? Slow. Only if 1+2 pass.

### Selection Criteria

Winner = highest score (3 = all pass) → shortest baseline → tightest thresholds.

### Implementation

1. Hardcode winning baseline and thresholds into `src/adapters/market-adapter.js`
2. Re-run full V&V suite to confirm polarity inversion and cross-source still CONFIRMED
