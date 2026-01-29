from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.core.config import settings


@dataclass(frozen=True)
class Profile:
    user_id: str
    plan: str
    downloads_used: int
    ultimate_until: Optional[str] = None

    @property
    def ultimate_active(self) -> bool:
        if self.plan.lower() != "ultimate":
            return False
        if not self.ultimate_until:
            return True
        raw = str(self.ultimate_until).strip()
        if not raw:
            return True
        try:
            # Supabase returns RFC3339; Python supports "+00:00". Handle "Z" just in case.
            if raw.endswith("Z"):
                raw = raw[:-1] + "+00:00"
            dt = datetime.fromisoformat(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt > datetime.now(timezone.utc)
        except Exception:
            # Fail-safe: if parsing fails, don't grant Ultimate.
            return False

    @property
    def ai_enabled(self) -> bool:
        return self.ultimate_active

    @property
    def effective_plan(self) -> str:
        return "ultimate" if self.ultimate_active else "free"

    @property
    def downloads_remaining(self) -> Optional[int]:
        if self.ultimate_active:
            return None
        return max(0, 5 - int(self.downloads_used or 0))


class SupabaseService:
    def __init__(self) -> None:
        self._url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        self._service_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

    def _enabled(self) -> bool:
        return settings.SUPABASE_ENABLED

    def _headers(self) -> dict[str, str]:
        # Service role bypasses RLS; do NOT expose this to the browser.
        return {
            "apikey": self._service_key,
            "Authorization": f"Bearer {self._service_key}",
            "Content-Type": "application/json",
        }

    async def get_or_create_profile(self, user_id: str) -> Profile:
        if not self._enabled():
            return Profile(user_id=user_id, plan="ultimate", downloads_used=0, ultimate_until=None)

        base = f"{self._url}/rest/v1/user_profiles"
        headers = self._headers()

        async with httpx.AsyncClient() as client:
            # Try select first
            res = await client.get(
                base,
                headers={**headers, "Accept": "application/json"},
                params={"user_id": f"eq.{user_id}", "select": "user_id,plan,downloads_used,ultimate_until"},
                timeout=15.0,
            )
            res.raise_for_status()
            rows = res.json() or []
            if rows:
                row = rows[0]
                return Profile(
                    user_id=str(row.get("user_id")),
                    plan=str(row.get("plan") or "free"),
                    downloads_used=int(row.get("downloads_used") or 0),
                    ultimate_until=row.get("ultimate_until"),
                )

            # Create profile with default plan
            insert = await client.post(
                base,
                headers={**headers, "Prefer": "return=representation"},
                json={"user_id": user_id},
                timeout=15.0,
            )
            insert.raise_for_status()
            created = (insert.json() or [{}])[0]
            return Profile(
                user_id=str(created.get("user_id") or user_id),
                plan=str(created.get("plan") or "free"),
                downloads_used=int(created.get("downloads_used") or 0),
                ultimate_until=created.get("ultimate_until"),
            )

    async def set_plan(self, *, user_id: str, plan: str) -> Profile:
        if not self._enabled():
            return Profile(user_id=user_id, plan=plan, downloads_used=0, ultimate_until=None)

        plan_norm = (plan or "").strip().lower()
        if plan_norm not in ("free", "ultimate"):
            raise ValueError("plan must be 'free' or 'ultimate'")

        base = f"{self._url}/rest/v1/user_profiles"
        headers = self._headers()

        async with httpx.AsyncClient() as client:
            # Upsert profile
            res = await client.post(
                base,
                headers={**headers, "Prefer": "resolution=merge-duplicates,return=representation"},
                params={"on_conflict": "user_id"},
                json={
                    "user_id": user_id,
                    "plan": plan_norm,
                    # For admin-set Ultimate, treat as unlimited unless you explicitly set ultimate_until in DB.
                    "ultimate_until": None,
                },
                timeout=15.0,
            )
            res.raise_for_status()
            row = (res.json() or [{}])[0]
            return Profile(
                user_id=str(row.get("user_id") or user_id),
                plan=str(row.get("plan") or plan_norm),
                downloads_used=int(row.get("downloads_used") or 0),
                ultimate_until=row.get("ultimate_until"),
            )

    async def consume_download(self, user_id: str) -> dict[str, Any]:
        """
        Atomically consumes a download slot (FREE: max 5; Ultimate: unlimited).
        Returns: {allowed, plan, downloads_used, downloads_remaining}
        """
        if not self._enabled():
            return {"allowed": True, "plan": "ultimate", "downloads_used": 0, "downloads_remaining": None}

        endpoint = f"{self._url}/rest/v1/rpc/consume_download"
        headers = self._headers()

        async with httpx.AsyncClient() as client:
            res = await client.post(endpoint, headers=headers, json={"p_user_id": user_id}, timeout=15.0)
            res.raise_for_status()
            # PostgREST returns an array for SETOF-returning functions
            payload = res.json()
            if isinstance(payload, list) and payload:
                return payload[0]
            if isinstance(payload, dict):
                return payload
            return {"allowed": False, "plan": "free", "downloads_used": 5, "downloads_remaining": 0}

    async def redeem_promo_code(self, *, user_id: str, code: str) -> dict[str, Any]:
        if not self._enabled():
            return {"success": True, "message": "Ultimate activated", "plan": "ultimate", "ultimate_until": None}

        endpoint = f"{self._url}/rest/v1/rpc/redeem_promo_code"
        headers = self._headers()
        async with httpx.AsyncClient() as client:
            res = await client.post(
                endpoint,
                headers=headers,
                json={"p_user_id": user_id, "p_code": code},
                timeout=15.0,
            )
            res.raise_for_status()
            payload = res.json()
            if isinstance(payload, list) and payload:
                return payload[0]
            if isinstance(payload, dict):
                return payload
            return {"success": False, "message": "Redeem failed", "plan": "free", "ultimate_until": None}


supabase_service = SupabaseService()
