from __future__ import annotations

from typing import Any, Optional

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


def require_user_id(authorization: Optional[str]) -> str:
    user_id = get_user_id_from_authorization(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


def require_ultimate(ai_enabled: bool) -> None:
    if not ai_enabled:
        raise HTTPException(status_code=403, detail="Ultimate subscription required")
