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
