from typing import Any, Dict, Optional

from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.last_message: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        # Replace any existing connection for same client_id (reconnect scenario)
        old = self.active_connections.get(client_id)
        if old is not None and old is not websocket:
            try:
                await old.close(code=1012)
            except Exception:
                pass
        self.active_connections[client_id] = websocket

        # If we have a last-known status, replay it so the UI can recover after reconnect.
        last = self.last_message.get(client_id)
        if last:
            try:
                await websocket.send_json(last)
            except Exception:
                pass

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_personal_message(self, message: dict, client_id: str):
        self.last_message[client_id] = message
        ws: Optional[WebSocket] = self.active_connections.get(client_id)
        if not ws:
            return
        try:
            await ws.send_json(message)
        except Exception:
            # Drop broken connection
            self.disconnect(client_id)

manager = ConnectionManager()
