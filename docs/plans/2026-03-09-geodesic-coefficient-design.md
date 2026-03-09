# Geodesic Coefficient (δ_G) — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Derive a single transferable metric — the Geodesic Coefficient (δ_G) — that measures how much topological invariant injection improves any LLM's classification accuracy on human-annotated ground truth.

**Architecture:** Engine extracts invariants (11μs), injects into LLM prompt, measures F1 lift against ground truth.

## The Metric

```
δ_G = F1(engine→LLM fusion) - F1(raw LLM alone)
```

- δ_G > 0: Topology provably improves the LLM
- δ_G magnitude: How much improvement (in F1 percentage points)
- δ_G is transferable: test with any LLM to measure how much topology helps it

## Test Protocol

**Dataset:** 21,045 human-annotated disaster messages (Haiti 2010, Chile 2010, Pakistan floods, Sandy 2012). Published NLP benchmark (Figure Eight / Appen).

**Ground Truth Derivation:** 36 binary human labels → 5 severity tiers:
- critical: death=1
- high: search_and_rescue=1, missing_people=1, security=1, military=1, medical_help=1
- moderate: floods=1, storm=1, fire=1, earthquake=1, request=1, infrastructure_related=1
- low: related=1 (no specific crisis category)
- none: related=0

**Sample:** 200 stratified messages (40 per tier), deterministic selection.

**Three Approaches Measured:**

| Approach | Description | Speed |
|----------|-------------|-------|
| Engine Alone | 240-word prime dictionary → PD/Gini/regime → severity | 0.03ms/msg |
| Raw LLM | LFM2.5-1.2B classifies from text alone | ~750ms/msg |
| Engine→LLM Fusion | Engine invariants injected as LLM context | ~750ms/msg |

**Metrics:** Precision, Recall, F1 (macro-averaged across 5 tiers), exact accuracy, within ±1 tier.

## Fusion Prompt Design

The fusion prompt injects MEASURED invariants as facts:
```
PD=X.X% DR=XX% G=X.XXX Regime=REGIME
Rules: PD=0+STABLE→none. PD<1%→low. PD 1-3%→moderate. PD>3%→high. CRISIS→critical.
If PD=0 but text shows obvious need→moderate.
```

Key principle: "Trust the invariants over your own reading of the text." The engine provides mathematical signal the LLM cannot compute on its own.

## Scorecard Output

```
┌────────────────────┬────────────────┬────────────────┬────────────────┐
│                    │ Engine Alone   │ Raw LLM        │ Engine→LLM     │
├────────────────────┼────────────────┼────────────────┼────────────────┤
│ Macro F1           │    XX.X%       │    XX.X%       │    XX.X%       │
│ Exact accuracy     │    XX.X%       │    XX.X%       │    XX.X%       │
│ Within ±1 tier     │    XX.X%       │    XX.X%       │    XX.X%       │
├────────────────────┼────────────────┼────────────────┼────────────────┤
│ Speed              │    0.03ms      │    ~750ms      │    ~750ms      │
│ Parameters         │    240 words   │    1.2B        │    240 + 1.2B  │
├────────────────────┼────────────────┼────────────────┼────────────────┤
│ δ_G (Geodesic Coeff)│    —          │    baseline    │    +X.X% F1    │
└────────────────────┴────────────────┴────────────────┴────────────────┘
```

## Compute Reality Check

| System | Params | Hardware | Speed | Estimated F1 |
|--------|--------|----------|-------|-------------|
| JtechAi Engine | 240 words | CPU only | 0.03ms/msg | ~21% (measured) |
| LFM2.5-1.2B | 1.2B | Local GPU | ~750ms/msg | ~25% (measured) |
| Engine→LLM Fusion | 240 + 1.2B | Local GPU | ~750ms/msg | TBD (δ_G) |
| BERT-base | 110M | GPU | ~50ms/msg | ~70-75% (published) |
| GPT-4 | ~1.8T | Cloud | ~500ms/msg | ~80%+ (estimated) |

**The argument:** If δ_G > 0, then 240 words of topology measurably improve a 1.2B parameter model. Scale that to larger models — the geometric invariants don't change, only the LLM does. The engine is a constant-cost quality amplifier.

## ATFT Foundation

From Jones (2026), the Čech-de Rham isomorphism guarantees that discrete computation (200 prime words on a simplicial complex) faithfully captures the continuous cohomological invariants of the text manifold. The Gini trajectory IS the topological evolution function (Def. 2.2). The engine measures shape. The LLM translates shape to language. δ_G measures how much that translation improves with geometric context.

## Success Criteria

- δ_G > 0 consistently across multiple runs
- Fusion F1 > Raw LLM F1
- Zero parse errors (prompt format validated)
- All numbers measured, no estimates

## Author

mr.white@jtech.ai + Claude Code
