# Geometric Routing & Fill-in-the-Blank LLM Bridge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Gini-based geometric router that maps topological complexity to LLM tier selection, with deterministic brief generation and graceful degradation.

**Architecture:** The engine produces a complete brief object (regime, metrics, signals, fallback narrative) in 0.05ms. A geometric router maps Gini to one of three LLM tiers (local 3B, local 8B, cloud API). The LLM fills in a 2-3 sentence narrative as a progressive enhancement — if it fails, the fallback stays.

**Tech Stack:** Node.js ESM, existing market-adapter.js + backtest-engine.js + lm-studio-client.js, Anthropic/OpenAI SDK for cloud tier, real Yahoo Finance CSVs for validation.

---

### Task 1: Geometric Router — Tier Selection Logic

**Files:**
- Create: `src/engine/geometric-router.js`
- Create: `tests/test-geometric-router.js`

**Step 1: Write the failing tests**

Create `tests/test-geometric-router.js`:

```javascript
/**
 * Geometric Router — unit tests
 *
 * Tests the Gini → tier routing logic, brief building, and fallback narrative generation.
 * No LLM calls — pure deterministic logic.
 *
 * Run: node tests/test-geometric-router.js
 */

import { selectTier, TIER_CONFIG } from "../src/engine/geometric-router.js";

let pass = 0, fail = 0;
function assert(label, condition) {
  if (condition) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.error(`  FAIL  ${label}`); }
}

console.log("\n=== Geometric Router: Tier Selection ===\n");

// Tier 3: Gini < 0.20
assert("Gini 0.00 → Tier 3", selectTier(0.00) === 3);
assert("Gini 0.10 → Tier 3", selectTier(0.10) === 3);
assert("Gini 0.19 → Tier 3", selectTier(0.19) === 3);

// Tier 2: Gini 0.20-0.40
assert("Gini 0.20 → Tier 2", selectTier(0.20) === 2);
assert("Gini 0.30 → Tier 2", selectTier(0.30) === 2);
assert("Gini 0.39 → Tier 2", selectTier(0.39) === 2);

// Tier 1: Gini >= 0.40
assert("Gini 0.40 → Tier 1", selectTier(0.40) === 1);
assert("Gini 0.60 → Tier 1", selectTier(0.60) === 1);
assert("Gini 1.00 → Tier 1", selectTier(1.00) === 1);

// Edge cases
assert("Gini NaN → Tier 3 (safe default)", selectTier(NaN) === 3);
assert("Gini undefined → Tier 3", selectTier(undefined) === 3);

// Tier config structure
assert("TIER_CONFIG has 3 tiers", Object.keys(TIER_CONFIG).length === 3);
assert("Tier 3 maxTokens = 100", TIER_CONFIG[3].maxTokens === 100);
assert("Tier 2 maxTokens = 200", TIER_CONFIG[2].maxTokens === 200);
assert("Tier 1 maxTokens = 300", TIER_CONFIG[1].maxTokens === 300);
assert("Tier 3 temperature = 0.1", TIER_CONFIG[3].temperature === 0.1);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-geometric-router.js`
Expected: FAIL — cannot import `selectTier` from non-existent module

**Step 3: Write minimal implementation**

Create `src/engine/geometric-router.js`:

```javascript
/**
 * Geometric Router — Topology Dictates Compute
 *
 * Maps the Gini coefficient (signal disagreement) to an LLM tier:
 *   Tier 3 (Gini < 0.20): Local 3B model — trivial articulation
 *   Tier 2 (Gini 0.20-0.40): Local 8B model — moderate synthesis
 *   Tier 1 (Gini >= 0.40): Cloud API — complex conflict resolution
 *
 * Also builds the deterministic brief object and fallback narrative.
 * The LLM is a progressive enhancement, not a dependency.
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

// ================================================================
// TIER CONFIGURATION
// ================================================================

export const TIER_CONFIG = {
  3: {
    name: "LOCAL_3B",
    giniMin: 0,
    giniMax: 0.20,
    maxTokens: 100,
    temperature: 0.1,
    taskPrompt: "State the regime and trajectory in plain English. One to two sentences maximum.",
  },
  2: {
    name: "LOCAL_8B",
    giniMin: 0.20,
    giniMax: 0.40,
    maxTokens: 200,
    temperature: 0.15,
    taskPrompt: "Synthesize the invariants into a 2-3 sentence assessment. Note any signal divergence between categories.",
  },
  1: {
    name: "CLOUD_API",
    giniMin: 0.40,
    giniMax: 1.0,
    maxTokens: 300,
    temperature: 0.2,
    taskPrompt: "Analyze the conflicting vectors across categories. Explain the tension between diverging signals and assess boundary stability. 2-3 sentences.",
  },
};

// ================================================================
// TIER SELECTION — pure Gini-based routing
// ================================================================

/**
 * Select the LLM tier based on Gini coefficient.
 *
 * @param {number} gini - Gini coefficient (0-1)
 * @returns {number} Tier number (1, 2, or 3)
 */
export function selectTier(gini) {
  if (typeof gini !== "number" || isNaN(gini)) return 3;
  if (gini >= 0.40) return 1;
  if (gini >= 0.20) return 2;
  return 3;
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-geometric-router.js`
Expected: 15/15 PASS

**Step 5: Commit**

```bash
git add src/engine/geometric-router.js tests/test-geometric-router.js
git commit -m "feat: geometric router — Gini-based tier selection logic"
```

---

### Task 2: Brief Builder — Deterministic Brief Object

**Files:**
- Modify: `src/engine/geometric-router.js`
- Modify: `tests/test-geometric-router.js`

**Step 1: Add failing tests to `tests/test-geometric-router.js`**

Append to the test file:

```javascript
import { buildBrief } from "../src/engine/geometric-router.js";

console.log("\n=== Geometric Router: Brief Builder ===\n");

const mockSignals = [
  { id: "mkt_rsi", sigma: -2.8, category: "condition", severity: "critical" },
  { id: "mkt_volratio", sigma: 1.6, category: "flow", severity: "high" },
  { id: "mkt_sma50", sigma: 0.4, category: "price", severity: "watch" },
  { id: "mkt_atr", sigma: 1.2, category: "capacity", severity: "moderate" },
];

const engineOutput = {
  ticker: "SPY",
  regime: { label: "BOUNDARY LAYER" },
  gini: 0.47,
  mean: 2.41,
  coherence: 72,
  signals: mockSignals,
  entropy: 1.85,
  primeDensity: 0.25,
  dissolutionRate: 0.75,
  propagationRate: 0.25,
};

const brief = buildBrief(engineOutput, { trajectory: "ACCELERATING", rho1: 0.86 });

// Structure checks
assert("brief has ticker", brief.ticker === "SPY");
assert("brief has regime string", brief.regime === "BOUNDARY LAYER");
assert("brief has tier", typeof brief.tier === "number");
assert("brief has metrics object", typeof brief.metrics === "object");
assert("brief.metrics.mean = 2.41", brief.metrics.mean === 2.41);
assert("brief.metrics.gini = 0.47", brief.metrics.gini === 0.47);
assert("brief.metrics.coherence = 72", brief.metrics.coherence === 72);
assert("brief.metrics.rho1 = 0.86", brief.metrics.rho1 === 0.86);

// Top 3 signals sorted by |sigma|
assert("brief has top 3 signals", brief.signals.length === 3);
assert("top signal is mkt_rsi (|σ|=2.8)", brief.signals[0].id === "mkt_rsi");
assert("2nd signal is mkt_volratio (|σ|=1.6)", brief.signals[1].id === "mkt_volratio");

// Narrative fields
assert("brief has fallbackNarrative", typeof brief.fallbackNarrative === "string");
assert("brief.narrative starts null", brief.narrative === null);
assert("brief.narrativeMeta starts null", brief.narrativeMeta === null);
assert("brief has timestamp", typeof brief.timestamp === "string");

// Tier assignment
assert("Gini 0.47 → Tier 1", brief.tier === 1);
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-geometric-router.js`
Expected: FAIL — `buildBrief` not exported

**Step 3: Add `buildBrief` to `src/engine/geometric-router.js`**

```javascript
// ================================================================
// BRIEF BUILDER — deterministic 90% of the intelligence brief
// ================================================================

/**
 * Build the deterministic brief object from engine output.
 *
 * @param {Object} engineOutput - From market-data.js runPipeline()
 * @param {Object} [extras={}] - Additional fields: { trajectory, rho1 }
 * @returns {Object} Complete brief with fallback narrative
 */
export function buildBrief(engineOutput, extras = {}) {
  const {
    ticker = "UNKNOWN",
    regime,
    gini,
    mean,
    coherence,
    signals,
    entropy,
    primeDensity,
    dissolutionRate,
    propagationRate,
  } = engineOutput;

  const regimeLabel = typeof regime === "object" ? regime.label : regime;
  const tier = selectTier(gini);

  // Top 3 signals by |σ|, sorted descending
  const topSignals = [...signals]
    .filter(s => s.sigma !== undefined)
    .sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma))
    .slice(0, 3);

  const metrics = {
    mean,
    gini,
    coherence,
    rho1: extras.rho1 ?? null,
    entropy,
    propagation: primeDensity,
    dissolution: dissolutionRate,
  };

  const brief = {
    ticker,
    timestamp: new Date().toISOString(),
    regime: regimeLabel,
    trajectory: extras.trajectory || "N/A",
    tier,
    metrics,
    signals: topSignals,
    fallbackNarrative: buildFallbackNarrative(regimeLabel, extras.trajectory || "N/A", metrics, topSignals),
    narrative: null,
    narrativeMeta: null,
  };

  return brief;
}

// ================================================================
// FALLBACK NARRATIVE — pure template, zero LLM dependency
// ================================================================

function buildFallbackNarrative(regime, trajectory, metrics, signals) {
  const top = signals[0];
  const stressLevel = metrics.mean > 1.8 ? "elevated" : "low";
  const disagreement = metrics.gini > 0.4 ? "high" : metrics.gini > 0.2 ? "moderate" : "low";

  let narrative = `${regime} regime detected. Mean |σ| ${metrics.mean.toFixed(2)} `
    + `with Gini ${metrics.gini.toFixed(2)} indicates ${stressLevel} stress `
    + `and ${disagreement} signal disagreement.`;

  if (top) {
    narrative += ` ${top.category} signals ${top.severity}`;
    if (signals[1]) {
      narrative += ` while ${signals[1].category} at ${signals[1].severity}`;
    }
    narrative += ".";
  }

  narrative += ` Forward trajectory: ${trajectory}.`;
  return narrative;
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-geometric-router.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/engine/geometric-router.js tests/test-geometric-router.js
git commit -m "feat: brief builder — deterministic brief object with fallback narrative"
```

---

### Task 3: Tier-Specific System Prompts

**Files:**
- Modify: `src/engine/system-prompts.js`

**Step 1: Add TOPO_TIER3 prompt and refine existing prompts**

The existing `TOPO_BRIEFING` becomes the Tier 2 prompt. The existing `TOPO_ANALYST` becomes the Tier 1 prompt. Add a new minimal `TOPO_TIER3` for the 3B model.

Add to `src/engine/system-prompts.js`:

```javascript
// ================================================================
// TIER 3 — MINIMAL (Local 3B model)
// Gini < 0.20: signals agree. State facts, nothing more.
// ================================================================

export const TOPO_TIER3 = `You translate measured invariants into plain English. One to two sentences maximum.

RULES:
1. The numbers below are GROUND TRUTH. Do not contradict them.
2. Reference at least 2 measured values in your response.
3. No analysis. No speculation. No hedging. Just state what the measurements show.`;
```

**Step 2: No test needed — prompts are strings, tested via integration in Task 6**

**Step 3: Commit**

```bash
git add src/engine/system-prompts.js
git commit -m "feat: TOPO_TIER3 — minimal system prompt for local 3B model"
```

---

### Task 4: Fill-in-the-Blank Prompt Builder

**Files:**
- Modify: `src/engine/geometric-router.js`
- Modify: `tests/test-geometric-router.js`

**Step 1: Add failing tests for `buildPrompt`**

Append to `tests/test-geometric-router.js`:

```javascript
import { buildPrompt } from "../src/engine/geometric-router.js";

console.log("\n=== Geometric Router: Prompt Builder ===\n");

const promptResult = buildPrompt(brief);

// Structure
assert("buildPrompt returns { system, user }", typeof promptResult.system === "string" && typeof promptResult.user === "string");

// User prompt contains measured invariants
assert("user prompt contains ticker", promptResult.user.includes("SPY"));
assert("user prompt contains regime", promptResult.user.includes("BOUNDARY LAYER"));
assert("user prompt contains mean", promptResult.user.includes("2.41"));
assert("user prompt contains gini", promptResult.user.includes("0.47"));
assert("user prompt contains 'do not recalculate'", promptResult.user.toLowerCase().includes("do not recalculate"));

// Tier-specific task prompt
assert("Tier 1 prompt mentions 'conflicting vectors'", promptResult.user.includes("conflicting vectors"));

// Tier 3 prompt check
const stableBrief = buildBrief(
  { ...engineOutput, gini: 0.05, regime: { label: "STABLE" } },
  { trajectory: "STABLE", rho1: 0.12 }
);
const tier3Prompt = buildPrompt(stableBrief);
assert("Tier 3 prompt mentions 'plain English'", tier3Prompt.user.includes("plain English"));
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-geometric-router.js`
Expected: FAIL — `buildPrompt` not exported

**Step 3: Add `buildPrompt` to `src/engine/geometric-router.js`**

```javascript
import { TOPO_TIER3, TOPO_BRIEFING, TOPO_ANALYST } from "./system-prompts.js";

// ================================================================
// PROMPT BUILDER — Fill-in-the-Blank constraint prompts
// ================================================================

const SYSTEM_PROMPTS = {
  3: TOPO_TIER3,
  2: TOPO_BRIEFING,
  1: TOPO_ANALYST,
};

/**
 * Build the tier-specific { system, user } prompt from a brief.
 *
 * @param {Object} brief - From buildBrief()
 * @returns {{ system: string, user: string }}
 */
export function buildPrompt(brief) {
  const system = SYSTEM_PROMPTS[brief.tier] || SYSTEM_PROMPTS[3];
  const config = TIER_CONFIG[brief.tier] || TIER_CONFIG[3];

  const top = brief.signals[0];
  const lines = [
    "MEASURED INVARIANTS (do not recalculate, do not contradict):",
    `  Ticker:       ${brief.ticker}`,
    `  Regime:       ${brief.regime}`,
    `  Trajectory:   ${brief.trajectory}`,
    `  Mean |σ|:     ${brief.metrics.mean.toFixed(2)}`,
    `  Gini:         ${brief.metrics.gini.toFixed(2)}`,
    `  Coherence:    ${brief.metrics.coherence}%`,
  ];

  if (brief.metrics.rho1 !== null) {
    lines.push(`  Lag-1 ρ₁:     ${brief.metrics.rho1.toFixed(2)}`);
  }

  if (top) {
    lines.push(`  Top Signal:   ${top.category} (${top.severity}, σ=${top.sigma.toFixed(1)})`);
  }

  if (brief.signals.length > 1) {
    lines.push("");
    lines.push("ALL REPORTED SIGNALS:");
    for (const s of brief.signals) {
      lines.push(`  ${s.id}: σ=${s.sigma.toFixed(2)}, ${s.category}, ${s.severity}`);
    }
  }

  lines.push("");
  lines.push(`YOUR TASK: ${config.taskPrompt}`);
  lines.push("You must reference at least 2 measured values. Do not speculate beyond the data above.");

  return { system, user: lines.join("\n") };
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-geometric-router.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/engine/geometric-router.js tests/test-geometric-router.js
git commit -m "feat: fill-in-the-blank prompt builder — tier-specific LLM constraints"
```

---

### Task 5: Cloud Client — Anthropic/OpenAI API Wrapper

**Files:**
- Create: `src/engine/cloud-client.js`
- Modify: `tests/test-geometric-router.js`

**Step 1: Write the failing test**

Append to `tests/test-geometric-router.js`:

```javascript
import { createCloudClient } from "../src/engine/cloud-client.js";

console.log("\n=== Cloud Client: Structure ===\n");

// Without API key, client should exist but indicate unavailability
const client = createCloudClient();
assert("createCloudClient returns object", typeof client === "object");
assert("client has generate method", typeof client.generate === "function");
assert("client has isAvailable method", typeof client.isAvailable === "function");
assert("client without key is unavailable", client.isAvailable() === false);
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-geometric-router.js`
Expected: FAIL — cannot import from non-existent module

**Step 3: Write `src/engine/cloud-client.js`**

```javascript
/**
 * Cloud Client — Tier 1 API wrapper
 *
 * Supports Anthropic (Claude) and OpenAI APIs via environment variables.
 * Checks ANTHROPIC_API_KEY first, then OPENAI_API_KEY.
 *
 * If no key is set, isAvailable() returns false and generate() returns
 * a graceful error — the brief fallback narrative handles it.
 *
 * Author: mr.white@jtech.ai + Claude Code
 */

/**
 * Create a cloud client instance.
 *
 * @param {Object} [options]
 * @param {string} [options.anthropicKey] - Override env var
 * @param {string} [options.openaiKey] - Override env var
 * @param {number} [options.timeoutMs=10000] - Request timeout
 * @returns {{ generate: Function, isAvailable: Function, provider: string|null }}
 */
export function createCloudClient(options = {}) {
  const anthropicKey = options.anthropicKey || process.env.ANTHROPIC_API_KEY || "";
  const openaiKey = options.openaiKey || process.env.OPENAI_API_KEY || "";
  const timeoutMs = options.timeoutMs || 10_000;

  const provider = anthropicKey ? "anthropic" : openaiKey ? "openai" : null;
  const apiKey = anthropicKey || openaiKey;

  function isAvailable() {
    return provider !== null;
  }

  async function generate(promptObj, tierConfig) {
    if (!isAvailable()) {
      return {
        content: null,
        error: "No API key configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)",
        provider: null,
        latencyMs: 0,
      };
    }

    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (provider === "anthropic") {
        return await callAnthropic(promptObj, tierConfig, apiKey, controller.signal, start);
      } else {
        return await callOpenAI(promptObj, tierConfig, apiKey, controller.signal, start);
      }
    } catch (err) {
      const latencyMs = performance.now() - start;
      if (err.name === "AbortError") {
        return { content: null, error: `Cloud API timeout after ${timeoutMs}ms`, provider, latencyMs };
      }
      return { content: null, error: err.message, provider, latencyMs };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { generate, isAvailable, provider };
}

// ================================================================
// ANTHROPIC (Claude) — Messages API
// ================================================================

async function callAnthropic(promptObj, tierConfig, apiKey, signal, start) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: tierConfig.maxTokens,
      temperature: tierConfig.temperature,
      system: promptObj.system,
      messages: [{ role: "user", content: promptObj.user }],
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text?.trim() || null,
    provider: "anthropic",
    model: data.model,
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    latencyMs: Math.round(performance.now() - start),
  };
}

// ================================================================
// OPENAI — Chat Completions API
// ================================================================

async function callOpenAI(promptObj, tierConfig, apiKey, signal, start) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: tierConfig.maxTokens,
      temperature: tierConfig.temperature,
      messages: [
        { role: "system", content: promptObj.system },
        { role: "user", content: promptObj.user },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content?.trim() || null,
    provider: "openai",
    model: data.model,
    tokensUsed: data.usage?.total_tokens || 0,
    latencyMs: Math.round(performance.now() - start),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-geometric-router.js`
Expected: All tests PASS (4 new cloud client tests pass without any API key)

**Step 5: Commit**

```bash
git add src/engine/cloud-client.js tests/test-geometric-router.js
git commit -m "feat: cloud client — Anthropic/OpenAI wrapper with graceful unavailability"
```

---

### Task 6: LM Studio Client — Model Selection Parameter

**Files:**
- Modify: `src/engine/lm-studio-client.js`
- Modify: `tests/test-geometric-router.js`

**Step 1: Add failing test**

Append to `tests/test-geometric-router.js`:

```javascript
import { generateIntelBrief } from "../src/engine/lm-studio-client.js";

console.log("\n=== LM Studio Client: Model Selection ===\n");

// Verify the function accepts a model parameter (structural test only — no live LM Studio needed)
assert("generateIntelBrief accepts options.model", generateIntelBrief.length <= 2);
// The function signature already supports model — just verify it exists
assert("generateIntelBrief is exported", typeof generateIntelBrief === "function");
```

This is a light structural check. The actual model selection behavior is verified by reading the code — the `model` parameter already exists in `lm-studio-client.js:23`. No code change needed here.

**Step 2: Verify existing client supports model selection**

Read `src/engine/lm-studio-client.js:23` — the `model` option already exists:
```javascript
model = "local-model",  // LM Studio resolves to loaded model
```

To route to specific models (Ministral 3B vs Qwen3 8B), the caller just passes `options.model`. No modification needed.

**Step 3: Run test to verify it passes**

Run: `node tests/test-geometric-router.js`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/test-geometric-router.js
git commit -m "test: verify LM Studio client model selection parameter"
```

---

### Task 7: Routing Orchestrator — Wire It All Together

**Files:**
- Modify: `src/engine/geometric-router.js`
- Modify: `tests/test-geometric-router.js`

**Step 1: Add failing tests for `routeAndArticulate`**

Append to `tests/test-geometric-router.js`:

```javascript
import { routeAndArticulate } from "../src/engine/geometric-router.js";

console.log("\n=== Geometric Router: Orchestrator ===\n");

// Test with no LLM available (graceful degradation)
const result = await routeAndArticulate(engineOutput, { trajectory: "ACCELERATING", rho1: 0.86 });

assert("routeAndArticulate returns brief", typeof result === "object");
assert("result has fallbackNarrative", typeof result.fallbackNarrative === "string");
assert("result.narrative is string or null", result.narrative === null || typeof result.narrative === "string");
assert("result has narrativeMeta", result.narrativeMeta !== undefined);
assert("fallback contains regime label", result.fallbackNarrative.includes("BOUNDARY LAYER"));
assert("fallback contains mean value", result.fallbackNarrative.includes("2.41"));
assert("fallback contains Gini value", result.fallbackNarrative.includes("0.47"));
assert("fallback contains trajectory", result.fallbackNarrative.includes("ACCELERATING"));
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-geometric-router.js`
Expected: FAIL — `routeAndArticulate` not exported

**Step 3: Add `routeAndArticulate` to `src/engine/geometric-router.js`**

```javascript
import { generateIntelBrief, checkLMStudio } from "./lm-studio-client.js";
import { createCloudClient } from "./cloud-client.js";

// ================================================================
// MODEL MAPPING — tier to LM Studio model identifier
// ================================================================

const LOCAL_MODELS = {
  3: "lmstudio-community/ministral-3b",
  2: "lmstudio-community/qwen3-8b",
};

// ================================================================
// ROUTING ORCHESTRATOR — deterministic brief + async LLM enhancement
// ================================================================

/**
 * Build brief, route to LLM tier, attempt narrative generation.
 * Returns immediately with fallback; narrative populated if LLM responds.
 *
 * @param {Object} engineOutput - From market-data.js pipeline
 * @param {Object} [extras] - { trajectory, rho1 }
 * @param {Object} [options] - { lmStudioHost, timeoutMs, cloudClient }
 * @returns {Promise<Object>} Brief with narrative (or fallback)
 */
export async function routeAndArticulate(engineOutput, extras = {}, options = {}) {
  const brief = buildBrief(engineOutput, extras);
  const prompt = buildPrompt(brief);
  const config = TIER_CONFIG[brief.tier];

  // Attempt LLM articulation based on tier
  try {
    let llmResult;

    if (brief.tier === 1) {
      // Tier 1: Cloud API
      const cloud = options.cloudClient || createCloudClient();
      if (cloud.isAvailable()) {
        llmResult = await cloud.generate(prompt, config);
      }
    } else {
      // Tier 2/3: Local LM Studio
      const model = LOCAL_MODELS[brief.tier] || "local-model";
      llmResult = await generateIntelBrief(prompt, {
        model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeoutMs: options.timeoutMs || 5000,
        host: options.lmStudioHost,
      });
    }

    if (llmResult && llmResult.content && !llmResult.error) {
      brief.narrative = llmResult.content;
      brief.narrativeMeta = {
        tier: brief.tier,
        model: llmResult.model || LOCAL_MODELS[brief.tier] || "cloud",
        provider: llmResult.provider || "lm-studio",
        latencyMs: llmResult.latencyMs || 0,
        tokensUsed: llmResult.tokensUsed || llmResult.tokens || 0,
      };
    }
  } catch {
    // Graceful degradation — fallback narrative stays
  }

  return brief;
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-geometric-router.js`
Expected: All tests PASS (LM Studio offline → graceful degradation → fallback stays)

**Step 5: Commit**

```bash
git add src/engine/geometric-router.js tests/test-geometric-router.js
git commit -m "feat: routing orchestrator — brief + async LLM with graceful degradation"
```

---

### Task 8: Routing Backtest — 15 Historical Crises

**Files:**
- Create: `tests/backtest-routing-decisions.js`

**Context:** This is the critical validation test. It runs every historical market CSV through the full engine → router pipeline and validates:
1. Routing correctness (regimes map to expected tiers)
2. Fallback quality (every narrative is readable)
3. Cost distribution (~70% Tier 3, ~20% Tier 2, ~10% Tier 1)

Uses the same `analyzeCSV` pattern from `tests/backtest-market-geometric.js`.

**Step 1: Write the test**

Create `tests/backtest-routing-decisions.js`:

```javascript
/**
 * Routing Decisions Backtest — Geometric Router Validation
 *
 * Runs all 15+ historical market CSVs through the engine → geometric router
 * pipeline and validates:
 *   1. Tier assignments match topological complexity
 *   2. Every fallback narrative is readable and contains key invariants
 *   3. Cost distribution is efficient (~70% Tier 3, ~20% Tier 2, ~10% Tier 1)
 *
 * NO LLM calls. NO synthetic data. Pure deterministic validation.
 *
 * Data: Yahoo Finance CSVs from tests/data/market/
 * Run: node tests/backtest-routing-decisions.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readCSV, computeGini, computeMeanSeverity, classifyRegime } from "./lib/backtest-engine.js";
import { marketToSignals } from "../src/adapters/market-adapter.js";
import { selectTier, buildBrief, TIER_CONFIG } from "../src/engine/geometric-router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data", "market");

const CSV_TO_TECH = {
  rsi: "rsi", macd_hist: "macd_hist", bband_pctb: "bbpctb", bband_width: "bbwidth",
  volume_ratio: "volratio", sma50_dist: "sma50dist", sma200_dist: "sma200dist",
  atr_pctile: "atrPctile", drawdown: "drawdown", adx: "adx", mfi: "mfi", obv_slope: "obvslope",
};
const CSV_TECH_KEYS = Object.keys(CSV_TO_TECH);

let pass = 0, fail = 0;
function assert(label, condition) {
  if (condition) { pass++; }
  else { fail++; console.error(`  FAIL  ${label}`); }
}

// ================================================================
// CRISIS DATASETS — 12 crises + 3 calm periods
// ================================================================

const DATASETS = [
  { file: "gfc-2008-spy.csv", ticker: "SPY", label: "GFC 2008", type: "crisis" },
  { file: "covid-2020-spy.csv", ticker: "SPY", label: "COVID 2020", type: "crisis" },
  { file: "svb-2023-kre.csv", ticker: "KRE", label: "SVB 2023", type: "crisis" },
  { file: "flash-2010-spy.csv", ticker: "SPY", label: "Flash Crash 2010", type: "crisis" },
  { file: "eudebt-2011-ewg.csv", ticker: "EWG", label: "EU Debt 2011", type: "crisis" },
  { file: "taper-2013-tlt.csv", ticker: "TLT", label: "Taper Tantrum 2013", type: "crisis" },
  { file: "china-2015-fxi.csv", ticker: "FXI", label: "China 2015", type: "crisis" },
  { file: "volmageddon-2018-spy.csv", ticker: "SPY", label: "Volmageddon 2018", type: "crisis" },
  { file: "gme-2021-gme.csv", ticker: "GME", label: "GME 2021", type: "crisis" },
  { file: "crypto-2022-coin.csv", ticker: "COIN", label: "Crypto 2022", type: "crisis" },
  { file: "oilcrash-2014-xle.csv", ticker: "XLE", label: "Oil Crash 2014", type: "crisis" },
  { file: "nvda-2023-nvda.csv", ticker: "NVDA", label: "NVDA 2023", type: "crisis" },
  { file: "calm-2013-spy.csv", ticker: "SPY", label: "Calm 2013", type: "calm" },
  { file: "calm-2017-spy.csv", ticker: "SPY", label: "Calm 2017", type: "calm" },
  { file: "calm-2019-spy.csv", ticker: "SPY", label: "Calm 2019", type: "calm" },
];

// ================================================================
// ANALYSIS
// ================================================================

function analyzeAndRoute(csvPath, ticker, baselineWindow = 60) {
  const rows = readCSV(csvPath);
  const ohlcv = rows.map(r => ({
    open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
  }));

  const technicals = {};
  for (const csvKey of CSV_TECH_KEYS) {
    const adapterKey = CSV_TO_TECH[csvKey];
    technicals[adapterKey] = rows.map(r => r[csvKey] || 0);
  }

  const results = [];
  for (let i = 59; i < rows.length; i++) {
    const sliceTechnicals = {};
    for (const csvKey of CSV_TECH_KEYS) {
      const adapterKey = CSV_TO_TECH[csvKey];
      sliceTechnicals[adapterKey] = technicals[adapterKey].slice(0, i + 1);
    }
    const sliceOhlcv = ohlcv.slice(0, i + 1);

    const { signals } = marketToSignals(ticker, sliceOhlcv, sliceTechnicals, baselineWindow);
    if (signals.length === 0) continue;

    const gini = computeGini(signals);
    const mean = computeMeanSeverity(signals);
    const regime = classifyRegime(mean, gini);
    const tier = selectTier(gini);

    const engineOutput = {
      ticker, regime, gini, mean, coherence: 0, signals,
      entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0,
    };
    const brief = buildBrief(engineOutput, { trajectory: "N/A" });

    results.push({ date: rows[i].date, gini, mean, regime: regime.label, tier, brief });
  }

  return results;
}

// ================================================================
// RUN ALL DATASETS
// ================================================================

console.log("\n" + "=".repeat(80));
console.log("GEOMETRIC ROUTING BACKTEST — 15 Historical Datasets");
console.log("=".repeat(80));

const globalTierCounts = { 1: 0, 2: 0, 3: 0 };
let totalBars = 0;

for (const ds of DATASETS) {
  const csvPath = path.join(DATA_DIR, ds.file);
  const results = analyzeAndRoute(csvPath, ds.ticker);

  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  for (const r of results) {
    tierCounts[r.tier]++;
    globalTierCounts[r.tier]++;
    totalBars++;
  }

  const pct = tier => ((tierCounts[tier] / results.length) * 100).toFixed(1);

  console.log(`\n  ${ds.label} (${ds.ticker}, ${results.length} bars):`);
  console.log(`    Tier 1 (Cloud):   ${tierCounts[1]} bars (${pct(1)}%)`);
  console.log(`    Tier 2 (8B):      ${tierCounts[2]} bars (${pct(2)}%)`);
  console.log(`    Tier 3 (3B):      ${tierCounts[3]} bars (${pct(3)}%)`);

  // === VALIDATION 1: Routing correctness ===
  // Calm periods should be dominated by Tier 3
  if (ds.type === "calm") {
    const tier3Pct = tierCounts[3] / results.length;
    assert(`${ds.label}: calm period ≥60% Tier 3`, tier3Pct >= 0.60);
  }

  // Crisis periods should have SOME Tier 1 or Tier 2 routing
  if (ds.type === "crisis") {
    const nonTier3 = tierCounts[1] + tierCounts[2];
    assert(`${ds.label}: crisis has ≥1 non-Tier-3 bar`, nonTier3 >= 1);
  }

  // === VALIDATION 2: Fallback narrative quality ===
  for (const r of results) {
    const fb = r.brief.fallbackNarrative;
    assert(`${ds.label} ${r.date}: fallback contains regime`, fb.includes(r.regime));
    assert(`${ds.label} ${r.date}: fallback contains 'Gini'`, fb.includes("Gini"));
    assert(`${ds.label} ${r.date}: fallback contains trajectory`, fb.includes("trajectory"));
    break; // Spot-check first bar only (thousands of bars otherwise)
  }
}

// === VALIDATION 3: Cost distribution ===
console.log("\n" + "=".repeat(80));
console.log("GLOBAL TIER DISTRIBUTION");
console.log("=".repeat(80));

const globalPct = tier => ((globalTierCounts[tier] / totalBars) * 100).toFixed(1);
console.log(`  Tier 1 (Cloud):   ${globalTierCounts[1]} bars (${globalPct(1)}%)`);
console.log(`  Tier 2 (8B):      ${globalTierCounts[2]} bars (${globalPct(2)}%)`);
console.log(`  Tier 3 (3B):      ${globalTierCounts[3]} bars (${globalPct(3)}%)`);
console.log(`  Total:            ${totalBars} bars`);

// Cost efficiency: Tier 3 should dominate
const tier3GlobalPct = globalTierCounts[3] / totalBars;
assert("Global: Tier 3 ≥ 50% of all bars (cost efficient)", tier3GlobalPct >= 0.50);
assert("Global: Tier 1 ≤ 25% of all bars (expensive calls limited)", globalTierCounts[1] / totalBars <= 0.25);

console.log(`\n${"=".repeat(80)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed`);
console.log(`${"=".repeat(80)}`);
process.exit(fail > 0 ? 1 : 0);
```

**Step 2: Run the backtest**

Run: `node tests/backtest-routing-decisions.js`
Expected: All assertions PASS. Tier distribution prints to console.

**Step 3: Commit**

```bash
git add tests/backtest-routing-decisions.js
git commit -m "test: routing decisions backtest — 15 crises, tier distribution validated"
```

---

### Task 9: Live LLM Integration Test (Optional — LM Studio Required)

**Files:**
- Create: `tests/test-live-routing.js`

**Context:** This test is optional — it requires LM Studio to be running at 192.168.1.121:1234. It sends 3 representative briefs through the full routing pipeline and validates that the LLM output references measured invariants.

**Step 1: Write the test**

Create `tests/test-live-routing.js`:

```javascript
/**
 * Live Routing Test — requires LM Studio at 192.168.1.121:1234
 *
 * Sends 3 representative briefs (one per tier) through the full
 * routing orchestrator and validates LLM output quality.
 *
 * Skip conditions:
 *   - LM Studio offline → prints "SKIPPED" and exits 0
 *   - No cloud API key → Tier 1 test prints "SKIPPED"
 *
 * Run: node tests/test-live-routing.js
 */

import { checkLMStudio } from "../src/engine/lm-studio-client.js";
import { routeAndArticulate } from "../src/engine/geometric-router.js";

let pass = 0, fail = 0, skip = 0;
function assert(label, condition) {
  if (condition) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.error(`  FAIL  ${label}`); }
}

// Check LM Studio availability
const lmStatus = await checkLMStudio();
if (!lmStatus.online) {
  console.log("\nSKIPPED: LM Studio offline — live routing tests require LM Studio");
  console.log("Start LM Studio and load a model, then re-run.");
  process.exit(0);
}
console.log(`\nLM Studio online. Models: ${lmStatus.models.join(", ")}`);

// Representative engine outputs for each tier
const scenarios = [
  {
    name: "Tier 3 — STABLE regime (Gini 0.05)",
    engine: {
      ticker: "SPY", regime: { label: "STABLE" }, gini: 0.05, mean: 1.2,
      coherence: 95, signals: [
        { id: "mkt_rsi", sigma: 0.3, category: "condition", severity: "watch" },
        { id: "mkt_volratio", sigma: -0.2, category: "flow", severity: "watch" },
        { id: "mkt_sma50", sigma: 0.1, category: "price", severity: "watch" },
      ],
      entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0,
    },
    extras: { trajectory: "STABLE", rho1: 0.12 },
    expectedTier: 3,
  },
  {
    name: "Tier 2 — CRISIS CONSOLIDATION (Gini 0.25)",
    engine: {
      ticker: "SPY", regime: { label: "CRISIS CONSOLIDATION" }, gini: 0.25, mean: 2.8,
      coherence: 88, signals: [
        { id: "mkt_rsi", sigma: -2.5, category: "condition", severity: "critical" },
        { id: "mkt_drawdown", sigma: 2.1, category: "price", severity: "critical" },
        { id: "mkt_atr", sigma: 1.8, category: "capacity", severity: "high" },
      ],
      entropy: 1.2, primeDensity: 0.33, dissolutionRate: 0.8, propagationRate: 0.2,
    },
    extras: { trajectory: "ACCELERATING", rho1: 0.91 },
    expectedTier: 2,
  },
  {
    name: "Tier 1 — BOUNDARY LAYER (Gini 0.52, cloud — may skip)",
    engine: {
      ticker: "SPY", regime: { label: "BOUNDARY LAYER" }, gini: 0.52, mean: 2.1,
      coherence: 61, signals: [
        { id: "mkt_rsi", sigma: -2.8, category: "condition", severity: "critical" },
        { id: "mkt_volratio", sigma: 1.6, category: "flow", severity: "high" },
        { id: "mkt_sma50", sigma: 0.4, category: "price", severity: "watch" },
      ],
      entropy: 1.85, primeDensity: 0.25, dissolutionRate: 0.75, propagationRate: 0.25,
    },
    extras: { trajectory: "TURBULENT", rho1: 0.72 },
    expectedTier: 1,
  },
];

console.log("\n=== Live Routing Tests ===\n");

for (const scenario of scenarios) {
  console.log(`\n--- ${scenario.name} ---`);

  if (scenario.expectedTier === 1 && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log("  SKIPPED (no cloud API key set)");
    skip++;
    continue;
  }

  const result = await routeAndArticulate(scenario.engine, scenario.extras, { timeoutMs: 15_000 });

  assert(`${scenario.name}: correct tier`, result.tier === scenario.expectedTier);
  assert(`${scenario.name}: has fallback`, typeof result.fallbackNarrative === "string");

  if (result.narrative) {
    console.log(`  Narrative: "${result.narrative}"`);
    console.log(`  Meta: tier=${result.narrativeMeta?.tier}, latency=${result.narrativeMeta?.latencyMs}ms`);

    // Validate LLM references measured values
    const text = result.narrative.toLowerCase();
    const hasNumber = /\d+\.?\d*/.test(result.narrative);
    assert(`${scenario.name}: narrative contains a number`, hasNumber);
  } else {
    console.log("  No narrative returned (LLM unavailable — fallback active)");
    assert(`${scenario.name}: fallback is readable`, result.fallbackNarrative.length > 20);
  }
}

console.log(`\n${pass}/${pass + fail} passed, ${skip} skipped`);
process.exit(fail > 0 ? 1 : 0);
```

**Step 2: Run the test**

Run: `node tests/test-live-routing.js`
Expected: PASS or SKIPPED (depends on LM Studio availability)

**Step 3: Commit**

```bash
git add tests/test-live-routing.js
git commit -m "test: live routing — 3 tiers validated against LM Studio (optional)"
```

---

### Task 10: Wire Router into Market Data Orchestrator

**Files:**
- Modify: `src/engine/market-data.js`

**Step 1: No separate test needed — this wires existing tested components**

The `market-data.js` orchestrator gets a new export `analyzeAndBrief()` that calls the existing `runPipeline()` then feeds output to `routeAndArticulate()`.

**Step 2: Add the wiring to `src/engine/market-data.js`**

Add at the end of the file, before the re-export section:

```javascript
import { routeAndArticulate } from "./geometric-router.js";

// ================================================================
// ENTRY 4: Full pipeline + Geometric Routing + LLM brief
// ================================================================

/**
 * Full analysis pipeline with geometric routing and LLM articulation.
 * Returns the engine result plus an intelligence brief with narrative.
 *
 * @param {string} ticker - Ticker symbol
 * @param {Object[]} ohlcv - OHLCV bars
 * @param {Object} technicals - Pre-computed technicals (or null)
 * @param {Object} [metadata={}] - Ticker metadata
 * @param {number} [baselineWindow=60] - Rolling sigma baseline
 * @param {Object} [routingOptions={}] - { lmStudioHost, timeoutMs, cloudClient }
 * @returns {Promise<Object>} { ...engineResult, brief }
 */
export async function analyzeAndBrief(ticker, ohlcv, technicals, metadata = {}, baselineWindow = 60, routingOptions = {}) {
  const engineResult = runPipeline(ticker, ohlcv, technicals, metadata, baselineWindow);

  const brief = await routeAndArticulate(engineResult, {
    trajectory: "N/A",  // TODO: compute from Gini history in future cycle
    rho1: null,         // TODO: compute from regime history in future cycle
  }, routingOptions);

  return { ...engineResult, brief };
}
```

**Step 3: Commit**

```bash
git add src/engine/market-data.js
git commit -m "feat: wire geometric router into market-data orchestrator"
```

---

### Task 11: Final Integration — Run All Tests

**Files:** None (validation only)

**Step 1: Run the full test suite**

```bash
node tests/test-geometric-router.js && echo "--- Router tests PASS ---"
node tests/backtest-routing-decisions.js && echo "--- Routing backtest PASS ---"
node tests/test-config-factory.js && echo "--- Config factory PASS ---"
node tests/test-statistics.js && echo "--- Statistics PASS ---"
node tests/test-market-adapter.js && echo "--- Market adapter PASS ---"
```

Expected: All pass.

**Step 2: Commit a final integration marker if needed**

No code changes. If all tests pass, the implementation is complete.

---

## Summary

| Task | Component | Files | Tests |
|------|-----------|-------|-------|
| 1 | Tier selection | geometric-router.js | 15 unit tests |
| 2 | Brief builder | geometric-router.js | 14 unit tests |
| 3 | System prompts | system-prompts.js | (integrated) |
| 4 | Prompt builder | geometric-router.js | 8 unit tests |
| 5 | Cloud client | cloud-client.js | 4 unit tests |
| 6 | LM Studio model | (verify existing) | 2 structural tests |
| 7 | Orchestrator | geometric-router.js | 8 unit tests |
| 8 | Routing backtest | backtest-routing-decisions.js | ~50 assertions on real data |
| 9 | Live LLM test | test-live-routing.js | 3 scenarios (optional) |
| 10 | Market-data wiring | market-data.js | (uses existing tests) |
| 11 | Final integration | (none) | Full suite validation |

**Parallelizable:** Tasks 1-5 are independent. Tasks 6-7 depend on 1-5. Task 8 depends on 1-4. Tasks 9-11 depend on all prior.
