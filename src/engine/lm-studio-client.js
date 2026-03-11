// src/engine/lm-studio-client.js
/**
 * LM Studio Client — Local LLM Inference
 *
 * Sends structured prompts from llm-bridge.js to the local LM Studio
 * instance via OpenAI-compatible API. The engine routes, the bridge
 * formats, this module delivers and returns the articulation.
 *
 * No cloud. No API keys. Local silicon only.
 */

import { SYSTEM_PROFILE } from "./optimization.js";

const DEFAULT_HOST = SYSTEM_PROFILE.lmStudio.host;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Generate an intelligence brief by sending a prompt to LM Studio.
 *
 * @param {{ system: string, user: string }} promptObj - From buildIntelligenceBrief()
 * @param {Object} [options]
 * @param {string} [options.host] - LM Studio base URL (default: from SYSTEM_PROFILE)
 * @param {string} [options.model] - Model identifier (default: "local-model" — LM Studio resolves to loaded model)
 * @param {number} [options.temperature] - Sampling temperature (default: 0.1 — clinical 37F style)
 * @param {number} [options.maxTokens] - Max response tokens (default: 300)
 * @param {number} [options.timeoutMs] - Network timeout (default: 30s)
 * @returns {Promise<{ content: string, model: string, tokensUsed: number, latencyMs: number }>}
 */
export async function generateIntelBrief(promptObj, options = {}) {
  const {
    host = DEFAULT_HOST,
    model = "local-model",
    temperature = 0.1,
    maxTokens = 300,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const url = `${host}/v1/chat/completions`;
  const payload = {
    model,
    messages: [
      { role: "system", content: promptObj.system },
      { role: "user", content: promptObj.user },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  const start = performance.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LM Studio returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const latencyMs = performance.now() - start;

    const choice = data.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error("LM Studio returned empty response");
    }

    return {
      content: choice.message.content.trim(),
      model: data.model || model,
      tokensUsed: data.usage?.total_tokens || 0,
      latencyMs: Math.round(latencyMs),
    };
  } catch (err) {
    const latencyMs = performance.now() - start;

    if (err.name === "AbortError") {
      throw new Error(`LM Studio timeout after ${timeoutMs}ms — is LM Studio running at ${host}?`);
    }
    if (err.cause?.code === "ECONNREFUSED") {
      throw new Error(`LM Studio offline at ${host} — start LM Studio and load a model`);
    }

    throw new Error(`LM Studio error (${Math.round(latencyMs)}ms): ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if LM Studio is reachable and has a model loaded.
 *
 * @param {string} [host] - LM Studio base URL
 * @returns {Promise<{ online: boolean, models: string[] }>}
 */
export async function checkLMStudio(host = DEFAULT_HOST) {
  try {
    const res = await fetch(`${host}/v1/models`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { online: false, models: [] };
    const data = await res.json();
    const models = (data.data || []).map(m => m.id);
    return { online: true, models };
  } catch {
    return { online: false, models: [] };
  }
}
