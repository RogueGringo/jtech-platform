"""
Sovereign Agent Node System (SANS) - LM Studio Execution Manager

Integrates LM Studio v1 REST API for hardware-constrained, dynamic
model loading and native MCP-enabled stateful inference.

Measured system profile (2026-03-08):
  - LFM2.5-1.2B Q8: 55 tok/sec, 166ms stateful TTFT, 5.5s fresh
  - Nomic v1.5 embeddings: 768D, 100ms/call
  - Engine: 88,332 msgs/sec (11.3μs/msg)

The constrained pathway ensures only one model occupies VRAM at a time,
critical for 16-32GB unified memory configurations (Snapdragon/Apple Silicon).
"""

import os
import logging
import requests
import json
from typing import Dict, Any, Optional, List, Generator

logger = logging.getLogger(__name__)


# ================================================================
# MEASURED SYSTEM PROFILE — matches src/engine/optimization.js
# ================================================================

SYSTEM_PROFILE = {
    "engine": {
        "ms_per_message": 0.0113,
        "messages_per_second": 88_332,
    },
    "lm_studio": {
        "host": os.environ.get("LM_STUDIO_HOST", "http://192.168.1.121"),
        "port": int(os.environ.get("LM_STUDIO_PORT", "1234")),
        "model": "liquid/lfm2.5-1.2b",
        "quantization": "Q8_0",
        "context_length": 128_000,
        "tokens_per_second": 55,
        "fresh_call_ms": 5_574,
        "stateful_call_ms": 166,
        "stateful_total_ms": 440,
    },
    "embeddings": {
        "model": "text-embedding-nomic-embed-text-v1.5",
        "dimensions": 768,
        "first_call_ms": 3_480,
    },
}


class LMStudioNodeManager:
    """
    Manages the connection to a local LM Studio instance.

    Handles model loading/unloading within VRAM constraints,
    stateful v1 API sessions, and streaming chat with MCP tools.
    """

    def __init__(
        self,
        host: str = None,
        port: int = None,
    ):
        _host = host or SYSTEM_PROFILE["lm_studio"]["host"]
        _port = port or SYSTEM_PROFILE["lm_studio"]["port"]
        self.base_url = f"{_host}:{_port}"
        self.api_v1_url = f"{self.base_url}/api/v1"
        self.openai_url = f"{self.base_url}/v1"
        self.headers = {"Content-Type": "application/json"}

        # LM Studio v1 local doesn't require auth, but support it if configured
        self.api_key = os.environ.get("LM_STUDIO_API_KEY", "lm-studio")
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"

        # Stateful session tracking (v1 API)
        self._session_response_id: Optional[str] = None

    # ────────────────────────────────────────────────────────────
    # HEALTH & DISCOVERY
    # ────────────────────────────────────────────────────────────

    def check_health(self) -> Dict[str, Any]:
        """Verify LM Studio is online. Returns status dict."""
        try:
            response = requests.get(
                f"{self.openai_url}/models",
                headers=self.headers,
                timeout=5,
            )
            if response.status_code == 200:
                models = response.json().get("data", [])
                return {
                    "online": True,
                    "models_loaded": len(models),
                    "model_ids": [m["id"] for m in models],
                }
            return {"online": False, "error": f"HTTP {response.status_code}"}
        except requests.exceptions.RequestException as e:
            logger.error(f"LM Studio connection failed: {e}")
            return {"online": False, "error": str(e)}

    def list_available_models(self) -> List[Dict]:
        """Returns all models available to the Sovereign Node."""
        response = requests.get(
            f"{self.openai_url}/models",
            headers=self.headers,
        )
        response.raise_for_status()
        return response.json().get("data", [])

    # ────────────────────────────────────────────────────────────
    # VRAM CONSTRAINED MODEL MANAGEMENT
    # ────────────────────────────────────────────────────────────

    def ensure_constrained_pathway(
        self,
        model_identifier: str,
        max_context: int = 8192,
    ) -> bool:
        """
        The 32GB Constraint Handler.

        Checks if model is loaded. If not, unloads current models
        and loads the target (quantized) model to fit within VRAM.
        """
        logger.info(f"Ensuring {model_identifier} is active via Constrained Pathway...")

        # 1. Check currently loaded models
        active_models = self.list_available_models()
        loaded_model_ids = [
            m["id"] for m in active_models if m.get("state") == "loaded"
        ]

        if model_identifier in loaded_model_ids:
            logger.info(f"Model {model_identifier} is already loaded in VRAM.")
            return True

        # 2. If VRAM is constrained, unload existing models to free memory
        if loaded_model_ids:
            logger.warning(
                f"VRAM Constraint: Unloading active models {loaded_model_ids}"
            )
            for m_id in loaded_model_ids:
                self.unload_model(m_id)

        # 3. Load the target quantized model
        return self.load_model(model_identifier, max_context)

    def load_model(
        self,
        model_identifier: str,
        context_length: int = 8192,
    ) -> bool:
        """Push a model into VRAM via /api/v1/models/load."""
        payload = {
            "model": model_identifier,
            "context_length": context_length,
        }
        logger.info(f"Loading {model_identifier} into LM Studio...")
        try:
            response = requests.post(
                f"{self.api_v1_url}/models/load",
                headers=self.headers,
                json=payload,
            )
            if response.status_code == 200:
                logger.info("Model loaded successfully.")
                return True
            else:
                logger.error(f"Failed to load model: {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Load request failed: {e}")
            return False

    def unload_model(self, model_identifier: str) -> bool:
        """Clear model from VRAM via /api/v1/models/unload."""
        payload = {"model": model_identifier}
        try:
            response = requests.post(
                f"{self.api_v1_url}/models/unload",
                headers=self.headers,
                json=payload,
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    # ────────────────────────────────────────────────────────────
    # STATEFUL SESSION (v1 API)
    # ────────────────────────────────────────────────────────────

    def init_session(self, model: str = None) -> Dict[str, Any]:
        """
        Start a fresh stateful session via v1 API.
        Measured: 5.5s for system prompt processing.
        Subsequent calls via previous_response_id: 166ms TTFT.
        """
        _model = model or SYSTEM_PROFILE["lm_studio"]["model"]
        try:
            response = requests.post(
                f"{self.api_v1_url}/chat",
                headers=self.headers,
                json={
                    "model": _model,
                    "input": "IE Manifold session initialized. Standing by for geometric invariant injection.",
                    "stream": False,
                },
            )
            data = response.json()
            self._session_response_id = data.get("response_id")
            return {
                "response_id": self._session_response_id,
                "ttft": data.get("stats", {}).get("time_to_first_token_seconds", 0),
                "tok_per_sec": data.get("stats", {}).get("tokens_per_second", 0),
            }
        except requests.exceptions.RequestException as e:
            self._session_response_id = None
            return {"error": str(e)}

    def stateful_chat(self, prompt: str, model: str = None) -> Dict[str, Any]:
        """
        Continue a stateful session. Measured: 166ms TTFT.
        Falls back to fresh call if no session exists.
        """
        _model = model or SYSTEM_PROFILE["lm_studio"]["model"]

        if self._session_response_id:
            # Stateful continuation — 166ms TTFT
            try:
                response = requests.post(
                    f"{self.api_v1_url}/chat",
                    headers=self.headers,
                    json={
                        "model": _model,
                        "input": prompt,
                        "previous_response_id": self._session_response_id,
                        "stream": False,
                    },
                )
                data = response.json()
                self._session_response_id = data.get("response_id")
                return {
                    "content": data.get("output", [{}])[0].get("content", ""),
                    "tokens": data.get("stats", {}).get("total_output_tokens", 0),
                    "tok_per_sec": data.get("stats", {}).get("tokens_per_second", 0),
                    "ttft": data.get("stats", {}).get(
                        "time_to_first_token_seconds", 0
                    ),
                    "stateful": True,
                }
            except requests.exceptions.RequestException as e:
                return {"error": str(e), "stateful": True}

        # No session — fresh OpenAI-compat call
        return self.fresh_chat(prompt, _model)

    def fresh_chat(
        self,
        prompt: str,
        model: str = None,
        system_prompt: str = None,
        max_tokens: int = 300,
        temperature: float = 0.25,
    ) -> Dict[str, Any]:
        """
        Fresh LM Studio call via OpenAI-compat endpoint.
        Measured: 5,574ms TTFT (system prompt processing).
        """
        _model = model or SYSTEM_PROFILE["lm_studio"]["model"]
        _system = system_prompt or (
            "You are the JtechAi IE Manifold briefing engine. "
            "Translate geometric invariants into actionable intelligence. "
            "Be precise, clinical. No filler. No axiom recitation. Just the assessment."
        )

        try:
            response = requests.post(
                f"{self.openai_url}/chat/completions",
                headers=self.headers,
                json={
                    "model": _model,
                    "messages": [
                        {"role": "system", "content": _system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            data = response.json()
            return {
                "content": data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", ""),
                "tokens": data.get("usage", {}).get("completion_tokens", 0),
                "stateful": False,
            }
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "stateful": False}

    def reset_session(self):
        """Reset the stateful session."""
        self._session_response_id = None

    # ────────────────────────────────────────────────────────────
    # STREAMING CHAT WITH MCP
    # ────────────────────────────────────────────────────────────

    def chat_stream_with_mcp(
        self,
        messages: List[Dict],
        model_identifier: str = None,
    ) -> Generator[str, None, None]:
        """
        Stream a response using the v1 chat endpoint.
        LM Studio handles active MCP tools and stateful context.
        """
        _model = model_identifier or SYSTEM_PROFILE["lm_studio"]["model"]
        payload = {
            "model": _model,
            "messages": messages,
            "stream": True,
        }

        logger.debug("Initiating streaming chat with MCP capabilities...")
        response = requests.post(
            f"{self.api_v1_url}/chat",
            headers=self.headers,
            json=payload,
            stream=True,
        )
        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                line_str = line.decode("utf-8")
                if line_str.startswith("data: "):
                    data_str = line_str[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        if "choices" in chunk and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                yield delta["content"]
                    except json.JSONDecodeError:
                        continue

    # ────────────────────────────────────────────────────────────
    # IE MANIFOLD INTEGRATION — Tier-based briefing
    # ────────────────────────────────────────────────────────────

    def request_briefing(self, invariants: Dict, tier: int) -> Optional[Dict]:
        """
        Request a briefing based on geometric invariants.

        Tier 0: SILENT — no LLM call (engine only, 11μs)
        Tier 1: BRIEF  — stateful continuation (166ms TTFT)
        Tier 2: FULL   — fresh call with full context (5.5s)
        """
        if tier == 0:
            return None

        if tier == 1:
            prompt = (
                f"{invariants.get('regime', 'STABLE')} | "
                f"G={invariants.get('gini', 0):.3f} "
                f"PD={invariants.get('pd', 0) * 100:.1f}% | "
                f"{invariants.get('trajectory', 'STABLE')}. One sentence."
            )
            return self.stateful_chat(prompt)

        # Tier 2: Full assessment
        prompt = (
            f"REGIME: {invariants.get('regime', 'N/A')}\n"
            f"Gini: {invariants.get('gini', 0):.3f} | "
            f"Mean: {invariants.get('mean', 0):.2f}\n"
            f"Prime Density: {invariants.get('pd', 0) * 100:.1f}% dissolution\n"
            f"Dissolution Rate: {invariants.get('dissolution_rate', 0) * 100:.0f}%\n"
            f"Entropy: {invariants.get('entropy', 0):.3f}\n"
            f"Trajectory: {invariants.get('trajectory', 'N/A')}\n"
            f"Domain: {invariants.get('domain', 'unknown')}\n\n"
            f"Full IE Manifold assessment. Include regime classification, "
            f"center of gravity analysis, predictive trajectory."
        )
        return self.fresh_chat(prompt)
