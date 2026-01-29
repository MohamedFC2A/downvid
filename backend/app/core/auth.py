from __future__ import annotations

from typing import Any, Optional

import httpx
import jwt
from fastapi import HTTPException

from app.core.config import settings


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    value = authorization.strip()
    if not value:
        return None
    if value.lower().startswith("bearer "):
        return value.split(" ", 1)[1].strip() or None
    return None


def get_user_id_from_authorization(authorization: Optional[str]) -> Optional[str]:
    """
    Returns the Supabase user_id (UUID string) from an Authorization header.

    If Supabase is not enabled, returns None (no auth enforcement).
    """
    if not settings.SUPABASE_ENABLED:
        return None

    token = _extract_bearer_token(authorization)
    if not token:
        return None

    # Prefer local verification if JWT secret is available.
    if (settings.SUPABASE_JWT_SECRET or "").strip():
        try:
            payload: dict[str, Any] = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except Exception:
            return None

        sub = payload.get("sub")
        return str(sub) if sub else None

    # Otherwise, validate token by calling Supabase Auth API.
    return None


async def resolve_user_id(authorization: Optional[str]) -> Optional[str]:
    if not settings.SUPABASE_ENABLED:
        return None

    token = _extract_bearer_token(authorization)
    if not token:
        return None

    local = get_user_id_from_authorization(authorization)
    if local:
        return local

    # Remote validation via Supabase Auth: GET /auth/v1/user
    base = (settings.SUPABASE_URL or "").strip().rstrip("/")
    if not base:
        return None
    service_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
    if not service_key:
        return None

    url = f"{base}/auth/v1/user"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {token}",
    }
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, timeout=10.0)
            if res.status_code != 200:
                return None
            data = res.json() or {}
            user_id = data.get("id")
            return str(user_id) if user_id else None
        except Exception:
            return None


async def require_user_id(authorization: Optional[str]) -> str:
    user_id = await resolve_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


def require_ultimate(ai_enabled: bool) -> None:
    if not ai_enabled:
        raise HTTPException(status_code=403, detail="Ultimate subscription required")
