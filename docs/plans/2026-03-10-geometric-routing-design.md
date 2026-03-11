# Geometric Routing & Fill-in-the-Blank LLM Bridge — Design Document

**Cycle:** 7
**Date:** 2026-03-10
**Author:** mr.white@jtech.ai + Claude Code
**Status:** APPROVED

---

## Principle

**Topology Dictates Compute.**

The deterministic engine (0.05ms) does 100% of the thinking. It decides the regime, measures the invariants, and builds 90% of the intelligence brief. The LLM is stripped of analytical authority and reduced to a strictly constrained translator: given exact mathematical truths, articulate them in human language.

The engine also decides *which* LLM handles the articulation. Signal disagreement (Gini coefficient) maps directly to cognitive load — low disagreement routes to cheap local models, high disagreement routes to capable cloud models. Cost scales with complexity, not volume.

---

## Section 1: Architecture

```
Ticker Input
    |
Market Adapter --> 12 signals with |sigma| continuous severity
    |
Engine (0.05ms) --> { regime, gini, mean, coherence, trajectory, rho1, ... }
    |
Brief Builder --> Deterministic brief (90%) + fallback narrative
    |
Geometric Router --> Gini --> Tier selection
    |
+-----------------------------------------------+
| Tier 3 (Gini < 0.20): Local 3B (Ministral)   |
| Tier 2 (Gini 0.20-0.40): Local 8B (Qwen3)   |
| Tier 1 (Gini >= 0.40): Cloud API (Claude)    |
+-----------------------------------------------+
    |
LLM returns 2-3 sentence narrative --> swaps fallback
```

### Tier Routing Logic

| Tier | Gini Range | Model | Rationale |
|------|------------|-------|-----------|
| 3 | < 0.20 | Local Ministral 3B | Low disagreement = signals agree. Trivial articulation task. |
| 2 | 0.20 - 0.40 | Local Qwen3 8B | Moderate disagreement. Needs to note signal divergence. |
| 1 | >= 0.40 | Cloud API (Claude Sonnet / GPT-4o) | High disagreement = conflicting vectors. Requires reasoning to synthesize contradictions without hallucinating. |

### Regime-Tier Alignment

- **STABLE** (low mean, low Gini): Always Tier 3. Signals quiet and in agreement.
- **CRISIS CONSOLIDATION** (high mean, low Gini): Tier 2 or 3. Market crashing but signals agree — unilateral directional move.
- **TRANSIENT SPIKE** (low mean, high Gini): Tier 1 or 2. One category elevated, others calm — needs nuanced articulation.
- **BOUNDARY LAYER** (high mean, high Gini): Always Tier 1. Signals violently disagreeing — maximum cognitive load.

### Existing Infrastructure

| File | Current State | Cycle 7 Change |
|------|--------------|-----------------|
| `src/engine/llm-bridge.js` | Single-tier prompt builder | Add tier-specific prompt variants |
| `src/engine/lm-studio-client.js` | Single model, timeout handling | Add model selection parameter |
| `src/engine/system-prompts.js` | TOPO_BRIEFING + TOPO_ANALYST | Add TOPO_TIER3; refine existing to Tier 2 and Tier 1 |

---

## Section 2: Brief Builder & Fill-in-the-Blank Constraints

### The Brief Object

The engine produces this deterministically, before any LLM is involved:

```javascript
{
  // === ENGINE TRUTH (100% deterministic, 0.05ms) ===
  ticker: "SPY",
  timestamp: "2024-03-15T16:00:00Z",
  regime: "BOUNDARY LAYER",
  trajectory: "ACCELERATING",
  tier: 1,

  metrics: {
    mean: 2.41,
    gini: 0.47,
    coherence: 72,
    rho1: 0.86,
    propagation: 0.63,
    dissolution: 0.18,
  },

  signals: [
    { id: "rsi_14", sigma: -2.8, category: "momentum", severity: "critical" },
    { id: "vix_level", sigma: 2.3, category: "volatility", severity: "high" },
    { id: "sma_cross", sigma: 0.4, category: "trend", severity: "watch" },
  ],

  // === FALLBACK NARRATIVE (deterministic template) ===
  fallbackNarrative: "BOUNDARY LAYER regime detected. Mean |sigma| 2.41 ...",

  // === LLM NARRATIVE (null until async swap) ===
  narrative: null,
  narrativeMeta: null,
}
```

### Fallback Narrative Generator

Pure string templates, zero LLM dependency. Guarantees 100% operational uptime:

```javascript
function buildFallbackNarrative(brief) {
  const { regime, trajectory, metrics, signals } = brief;
  const top = signals[0];
  return `${regime} regime detected. Mean |sigma| ${metrics.mean.toFixed(2)} `
    + `with Gini ${metrics.gini.toFixed(2)} indicates `
    + `${metrics.mean > 1.8 ? "elevated" : "low"} stress and `
    + `${metrics.gini > 0.4 ? "high" : metrics.gini > 0.2 ? "moderate" : "low"} `
    + `signal disagreement. ${top.category} signals ${top.severity}`
    + `${signals[1] ? ` while ${signals[1].category} at ${signals[1].severity}` : ""}. `
    + `Forward trajectory: ${trajectory}.`;
}
```

### Fill-in-the-Blank LLM Prompt

The LLM receives pre-formatted measured invariants and a surgically scoped task:

```
MEASURED INVARIANTS (do not recalculate, do not contradict):
  Ticker:      SPY
  Regime:      BOUNDARY LAYER
  Trajectory:  ACCELERATING
  Mean |sigma|: 2.41
  Gini:        0.47
  Coherence:   72%
  Lag-1 rho1:  0.86
  Top Signal:  momentum (critical, sigma=-2.8)

YOUR TASK: Write exactly 2-3 sentences synthesizing what these
invariants mean for a human analyst. You must reference at least
2 measured values. Do not speculate beyond the data above.
```

### Tier-Specific Prompt Scaling

| Tier | Gini | Prompt Complexity | Max Tokens | Temperature |
|------|------|-------------------|------------|-------------|
| 3 (3B local) | < 0.20 | Minimal: "State the regime and trajectory in plain English" | 100 | 0.1 |
| 2 (8B local) | 0.20-0.40 | Standard: "Synthesize the invariants, note any signal divergence" | 200 | 0.15 |
| 1 (Cloud) | >= 0.40 | Full: "Analyze conflicting vectors, explain the tension between categories, assess boundary stability" | 300 | 0.2 |

### Progressive Enhancement (Async Swap)

```
1. Engine computes brief        --> 0.05ms
2. UI renders with fallback     --> instant
3. Router fires async LLM call  --> non-blocking
4. On success: swap narrative   --> UI updates smoothly
5. On failure: fallback stays   --> user sees 90% of intelligence
```

The LLM is a progressive enhancement, not a single point of failure.

---

## Section 3: New Components, Integration, & Testing

### New Files

| File | Purpose |
|------|---------|
| `src/engine/geometric-router.js` | Gini-to-tier mapping, brief builder, fallback generator, routing orchestrator |
| `src/engine/cloud-client.js` | Anthropic/OpenAI API wrapper for Tier 1 |
| `tests/test-geometric-router.js` | Unit tests: routing logic, fallback generation, brief structure |
| `tests/backtest-routing-decisions.js` | Route all 15 historical crises, verify tier assignments + cost distribution |

### Modified Files

| File | Change |
|------|--------|
| `src/engine/lm-studio-client.js` | Add model selection parameter (Ministral 3B vs Qwen3 8B) |
| `src/engine/llm-bridge.js` | Tier-specific prompt variants (simple / standard / full) |
| `src/engine/system-prompts.js` | Add TOPO_TIER3 (minimal); refine TOPO_BRIEFING to Tier 2, TOPO_ANALYST to Tier 1 |
| `src/engine/market-data.js` | Wire routing into the orchestrator pipeline |

### Cloud API Client

Cycle 7 uses environment variables (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) for simplicity. The router runs server-side in Node — no key exposure risk. Migration to the FastAPI proxy (`hf-proxy/app.py`) is deferred to the UI integration cycle.

### Test Strategy

All tests use real historical market data from Cycle 6. No synthetic data.

1. **Routing correctness** — STABLE periods route to Tier 3, consolidated crises to Tier 2, boundary regimes to Tier 1
2. **Fallback quality** — Every fallback narrative contains regime label, mean, Gini, and trajectory (string assertions)
3. **Cost efficiency** — Across 15 crises, validate distribution: ~70% Tier 3, ~20% Tier 2, ~10% Tier 1
4. **Live LLM test** (optional, requires LM Studio online) — Send 3 representative briefs to local models, verify response references at least 2 measured invariants

### Explicit Scope Boundaries

**NOT building in Cycle 7:**
- No UI changes (brief object is React-ready; dashboard wiring is a separate cycle)
- No prompt fine-tuning or model quality evaluation
- No persistent brief storage or history
- No FastAPI proxy routing for cloud keys

---

## Success Criteria

1. `geometric-router.js` correctly maps any topological signature to the right tier
2. Every brief object includes a readable fallback narrative with zero LLM dependency
3. Tier-specific prompts constrain the LLM to translation-only (no analysis, no hallucination)
4. Historical backtest proves cost-efficient routing distribution across 15 real crises
5. Graceful degradation works: LM Studio offline = fallback renders, no crash, no blocking
6. Live LLM narratives (when available) reference measured invariants, not invented data
