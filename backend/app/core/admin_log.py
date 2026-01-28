from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional


class AdminLog:
    def __init__(self, max_entries: int = 500):
        self._entries: Deque[Dict[str, Any]] = deque(maxlen=max_entries)

    def add(self, event: str, data: Optional[Dict[str, Any]] = None) -> None:
        self._entries.append(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "event": event,
                "data": data or {},
            }
        )

    def list(self, limit: int = 200) -> List[Dict[str, Any]]:
        if limit <= 0:
            return []
        # newest first
        return list(self._entries)[-limit:][::-1]


admin_log = AdminLog()

