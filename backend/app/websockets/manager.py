from typing import Dict, Set
from fastapi import WebSocket
import json
import asyncio

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.download_tasks: Dict[str, asyncio.Task] = {}
    
    async def connect(self, client_id: str, websocket: WebSocket):
        """Accept and store new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, client_id: str):
        """Remove WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")
        
        if client_id in self.download_tasks:
            task = self.download_tasks[client_id]
            if not task.done():
                task.cancel()
            del self.download_tasks[client_id]
    
    async def send_progress(self, client_id: str, data: dict):
        """Send download progress update to specific client"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(data)
            except Exception as e:
                print(f"Error sending to {client_id}: {e}")
                self.disconnect(client_id)
    
    async def send_message(self, client_id: str, message: str, status: str = "info"):
        """Send text message to client"""
        await self.send_progress(client_id, {
            "type": "message",
            "status": status,
            "message": message
        })
    
    async def send_error(self, client_id: str, error: str):
        """Send error message to client"""
        await self.send_progress(client_id, {
            "type": "error",
            "error": error
        })
    
    async def send_complete(self, client_id: str, file_path: str):
        """Send download complete notification"""
        await self.send_progress(client_id, {
            "type": "complete",
            "file_path": file_path
        })

# Global connection manager instance
manager = ConnectionManager()
