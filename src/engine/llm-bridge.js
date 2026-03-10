// src/engine/llm-bridge.js
/**
 * LLM Bridge — Layer 2 Geometric Routing → LLM Articulation
 *
 * Translates measured topological invariants into structured prompts
 * for local LLM inference. The engine computes. The LLM articulates.
 * The LLM never classifies — regime is GROUND TRUTH from the math.
 *
 * Architecture: Engine (0.05ms) → Bridge (prompt build) → LLM (articulation)
 */

/**
 * Build an intelligence brief prompt from measured topological signature.
 *
 * @param {Object} signature - Complete engine output
 * @param {string} signature.regime - Engine-classified regime (STABLE | TRANSIENT SPIKE | BOUNDARY LAYER | CRISIS CONSOLIDATION)
 * @param {string} signature.ieRegime - IE doctrine regime (STABILITY | VULNERABILITY | OPPORTUNITY | CRISIS)
 * @param {number} signature.mean - Mean severity (1-4)
 * @param {number} signature.gini - Gini coefficient (0-1)
 * @param {number} signature.entropy - Shannon entropy
 * @param {number} signature.primeDensity - Fraction of text matching primes
 * @param {number} signature.dissolutionRate - Dissolution / total primes ratio
 * @param {number} [signature.dKL] - KL-divergence from baseline (Layer -1)
 * @param {boolean} [signature.spike] - Whether Layer -1 detected an anomaly
 * @param {string[]} [signature.emergentPrimes] - Words discovered by Layer -1
 * @param {number} [signature.beta0Count] - Number of β₀ features (narrative fragments)
 * @param {number} [signature.beta1Count] - Number of β₁ features (hysteresis cycles)
 * @param {number} [signature.onsetScale] - First filtration radius where β₀ drops
 * @param {number} [signature.maxPersistence] - Longest-lived topological feature
 * @param {number} [signature.coherence] - Cross-panel coherence (0-100)
 * @param {string} [signature.trajectory] - Gini trajectory (ACCELERATING | CONSOLIDATING | TURBULENT | RESOLVING)
 * @returns {{ system: string, user: string }}
 */
export function buildIntelligenceBrief(signature) {
  if (!signature || !signature.regime) {
    throw new Error("buildIntelligenceBrief requires a signature with at least { regime }");
  }

  const system = buildSystemPrompt(signature);
  const user = buildUserPrompt(signature);

  return { system, user };
}

// ================================================================
// SYSTEM PROMPT — 37F IE Analyst Role
// ================================================================

function buildSystemPrompt(sig) {
  const lines = [
    "You are a 37F Information Environment Analyst attached to a topological intelligence engine.",
    "",
    "GROUND RULES:",
    "1. Do NOT calculate severity, regime, or classification. These have been mathematically determined by a validated engine (52/52 tests, 6 domains, 21K real messages).",
    "2. Do NOT hallucinate data, statistics, or events not present in the brief.",
    "3. Every sentence you write MUST be anchored to a measured invariant provided below.",
    "4. You ARTICULATE the topology in operational language. You do not interpret, speculate, or editorialize.",
    "5. If emergent primes are provided, synthesize them into the operational picture — they are words the engine discovered WITHOUT any dictionary, purely from distributional anomaly.",
  ];

  // Layer 1 context (if available)
  if (sig.beta1Count !== undefined) {
    lines.push("");
    lines.push("TOPOLOGICAL CONTEXT (Vietoris-Rips Persistent Homology):");
    lines.push(`- β₀ = ${sig.beta0Count ?? "N/A"} connected components (narrative fragments). Fewer = more consolidated.`);
    lines.push(`- β₁ = ${sig.beta1Count} cycles detected. A cycle means a hysteresis loop: normalcy→escalation→peak→resolution→new normalcy. If β₁ > 0, the crisis has entered a recurring pattern.`);
    if (sig.onsetScale !== undefined && sig.onsetScale !== Infinity) {
      lines.push(`- Onset scale ε* = ${sig.onsetScale.toFixed(4)}. This is the filtration radius where narratives first merge. Lower = faster consolidation.`);
    }
    if (sig.maxPersistence !== undefined) {
      lines.push(`- Max persistence = ${sig.maxPersistence.toFixed(4)}. How long the dominant topological feature survives across scales. High = structural, not noise.`);
    }
  }

  // Layer -1 context (if available)
  if (sig.spike !== undefined) {
    lines.push("");
    lines.push("DISTRIBUTIONAL ANOMALY (KL-Divergence):");
    lines.push(`- D_KL = ${sig.dKL !== undefined ? sig.dKL.toFixed(4) : "N/A"}. Divergence from baseline language distribution.`);
    lines.push(`- Anomaly spike: ${sig.spike ? "YES — language has shifted significantly from baseline" : "NO — within normal distribution"}.`);
  }

  lines.push("");
  lines.push("OUTPUT FORMAT:");
  lines.push("1. REGIME: State the regime and what it means operationally (1 sentence).");
  lines.push("2. KEY SIGNALS: Cite the 3 most significant measured invariants (bullet points).");
  lines.push("3. EMERGENT VOCABULARY: If primes are provided, what do they reveal about the operational picture? (1-2 sentences).");
  lines.push("4. WATCH FORWARD: One sentence on what to monitor next based on trajectory.");
  lines.push("");
  lines.push("Clinical. Precise. No filler. 37F doctrine: conviction signal must be rare and undeniable.");

  return lines.join("\n");
}

// ================================================================
// USER PROMPT — Measured Invariants as Facts
// ================================================================

function buildUserPrompt(sig) {
  const lines = [
    "INTELLIGENCE BRIEF — TOPOLOGICAL INVARIANTS (MEASURED, NOT ESTIMATED)",
    "═".repeat(60),
    "",
    `REGIME: ${sig.regime}`,
    `IE DOCTRINE: ${sig.ieRegime || sig.regime}`,
    `TRAJECTORY: ${sig.trajectory || "N/A"}`,
    "",
    "LAYER 0 — SIGNAL GEOMETRY:",
    `  Mean Severity:     ${fmt(sig.mean)}`,
    `  Gini:              ${fmt(sig.gini)}`,
    `  Entropy:           ${fmt(sig.entropy)}`,
    `  Prime Density:     ${sig.primeDensity !== undefined ? (sig.primeDensity * 100).toFixed(1) + "%" : "N/A"}`,
    `  Dissolution Rate:  ${sig.dissolutionRate !== undefined ? (sig.dissolutionRate * 100).toFixed(0) + "%" : "N/A"}`,
  ];

  if (sig.coherence !== undefined) {
    lines.push(`  Cross-Panel Coherence: ${sig.coherence.toFixed(1)}%`);
  }

  // Layer 1 invariants
  if (sig.beta0Count !== undefined || sig.beta1Count !== undefined) {
    lines.push("");
    lines.push("LAYER 1 — PERSISTENT HOMOLOGY:");
    if (sig.beta0Count !== undefined) lines.push(`  β₀ (components):   ${sig.beta0Count}`);
    if (sig.beta1Count !== undefined) lines.push(`  β₁ (cycles):       ${sig.beta1Count}`);
    if (sig.onsetScale !== undefined && sig.onsetScale !== Infinity) {
      lines.push(`  Onset scale:       ${sig.onsetScale.toFixed(4)}`);
    }
    if (sig.maxPersistence !== undefined) {
      lines.push(`  Max persistence:   ${sig.maxPersistence.toFixed(4)}`);
    }
  }

  // Layer -1 invariants
  if (sig.dKL !== undefined) {
    lines.push("");
    lines.push("LAYER -1 — DISTRIBUTIONAL ANOMALY:");
    lines.push(`  D_KL:              ${sig.dKL.toFixed(4)}`);
    lines.push(`  Spike:             ${sig.spike ? "YES" : "NO"}`);
  }

  // Emergent primes
  if (sig.emergentPrimes && sig.emergentPrimes.length > 0) {
    lines.push("");
    lines.push("EMERGENT PRIMES (discovered without dictionary):");
    lines.push(`  [${sig.emergentPrimes.join(", ")}]`);
  }

  lines.push("");
  lines.push("═".repeat(60));
  lines.push("Synthesize the above into an operational intelligence brief.");

  return lines.join("\n");
}

// ================================================================
// HELPERS
// ================================================================

function fmt(val) {
  if (val === undefined || val === null) return "N/A";
  return typeof val === "number" ? val.toFixed(4) : String(val);
}
