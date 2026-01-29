from __future__ import annotations

from typing import Any, Optional

import httpx

from app.core.config import settings


MODEL_MAP: dict[str, dict[str, str]] = {
    # Image-only model (kept for completeness)
    "real-esrgan": {"model": "nightmareai/real-esrgan", "input_key": "image"},
    # Video upscaler model
    "video-enhance": {"model": "iso-m/video-upscaler", "input_key": "video"},
}


class ReplicateUpscaleService:
    _base_url = "https://api.replicate.com/v1"

    def _headers(self) -> dict[str, str]:
        token = (settings.REPLICATE_API_TOKEN or "").strip()
        if not token:
            raise RuntimeError("REPLICATE_API_TOKEN is not configured on the server")
        return {
            "Authorization": f"Token {token}",
            "Content-Type": "application/json",
        }

    def resolve_model(self, model_key: Optional[str]) -> dict[str, str]:
        key = (model_key or settings.REPLICATE_MODEL or "video-enhance").strip().lower()
        if key in MODEL_MAP:
            return MODEL_MAP[key]
        # Fallback: treat the provided key as a Replicate model slug, e.g. "owner/name"
        input_key = (settings.REPLICATE_MODEL_INPUT or "video").strip() or "video"
        return {"model": key, "input_key": input_key}

    async def create_prediction(self, *, source_url: str, model_key: Optional[str] = None, extra_input: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        if not source_url:
            raise ValueError("source_url is required")

        model_cfg = self.resolve_model(model_key)
        payload: dict[str, Any] = {
            "input": {
                model_cfg["input_key"]: source_url,
                **(extra_input or {}),
            }
        }

        version = (settings.REPLICATE_MODEL_VERSION or "").strip()
        if version:
            payload["version"] = version
        else:
            payload["model"] = model_cfg["model"]

        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self._base_url}/predictions",
                headers=self._headers(),
                json=payload,
                timeout=60.0,
            )
            res.raise_for_status()
            return res.json()

    async def get_prediction(self, prediction_id: str) -> dict[str, Any]:
        if not prediction_id:
            raise ValueError("prediction_id is required")
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{self._base_url}/predictions/{prediction_id}",
                headers=self._headers(),
                timeout=30.0,
            )
            res.raise_for_status()
            return res.json()


replicate_upscale_service = ReplicateUpscaleService()
