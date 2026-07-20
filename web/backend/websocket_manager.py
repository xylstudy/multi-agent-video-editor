import json
from typing import Dict, List

from fastapi import WebSocket


class WebSocketManager:
    """管理每个 task_id 对应的 WebSocket 连接。"""

    def __init__(self):
        # task_id -> list[WebSocket]
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, task_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections.setdefault(task_id, []).append(websocket)

    def disconnect(self, task_id: str, websocket: WebSocket):
        conns = self.connections.get(task_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.connections.pop(task_id, None)

    async def broadcast(self, task_id: str, message: dict):
        conns = self.connections.get(task_id, [])
        if not conns:
            return
        text = json.dumps(message, ensure_ascii=False)
        dead = []
        for conn in conns:
            try:
                await conn.send_text(text)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(task_id, conn)


ws_manager = WebSocketManager()
