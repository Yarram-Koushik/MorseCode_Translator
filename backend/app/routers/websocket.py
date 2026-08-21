"""
WebSocket Hub: Real-time room presence, live Morse transmission telemetry,
and decoded message broadcasting.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List, Set, Any
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Real-time WebSockets"])

class ConnectionManager:
    """Manages active WebSocket connections mapped per room code."""
    def __init__(self):
        # room_code -> list of active WebSocket connections
        self.active_rooms: Dict[str, List[WebSocket]] = {}
        # websocket -> metadata dict { user_name, input_mode, room_code }
        self.connection_meta: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, room_code: str, user_name: str = "Operator", input_mode: str = "tap"):
        await websocket.accept()
        code = room_code.upper()
        if code not in self.active_rooms:
            self.active_rooms[code] = []
        self.active_rooms[code].append(websocket)
        self.connection_meta[websocket] = {
            "room_code": code,
            "user_name": user_name,
            "input_mode": input_mode
        }

        # Broadcast join notification & updated presence
        await self.broadcast_presence(code)

    def disconnect(self, websocket: WebSocket):
        meta = self.connection_meta.pop(websocket, None)
        if meta:
            code = meta.get("room_code")
            if code in self.active_rooms and websocket in self.active_rooms[code]:
                self.active_rooms[code].remove(websocket)
                if not self.active_rooms[code]:
                    del self.active_rooms[code]
            return code
        return None

    async def broadcast_presence(self, room_code: str):
        code = room_code.upper()
        if code not in self.active_rooms:
            return
        
        members = [
            {
                "user_name": self.connection_meta[ws]["user_name"],
                "input_mode": self.connection_meta[ws]["input_mode"]
            }
            for ws in self.active_rooms[code] if ws in self.connection_meta
        ]

        payload = {
            "type": "presence_update",
            "room_code": code,
            "member_count": len(members),
            "members": members
        }
        await self.broadcast_to_room(code, payload)

    async def broadcast_to_room(self, room_code: str, message: Dict[str, Any], exclude_ws: WebSocket = None):
        code = room_code.upper()
        if code not in self.active_rooms:
            return
        
        encoded_msg = json.dumps(message)
        dead_connections = []
        for ws in self.active_rooms[code]:
            if ws != exclude_ws:
                try:
                    await ws.send_text(encoded_msg)
                except Exception:
                    dead_connections.append(ws)
        
        for dead_ws in dead_connections:
            self.disconnect(dead_ws)

ws_manager = ConnectionManager()

@router.websocket("/ws/room/{room_code}")
async def websocket_room_endpoint(
    websocket: WebSocket,
    room_code: str,
    user_name: str = "Operator",
    input_mode: str = "tap"
):
    await ws_manager.connect(websocket, room_code, user_name, input_mode)
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except Exception:
                continue

            event_type = data.get("type")
            
            # Live Morse transmission event (e.g. dot/dash started or finished)
            if event_type == "morse_signal":
                # Broadcast real-time signal to all other room members
                await ws_manager.broadcast_to_room(
                    room_code=room_code,
                    message={
                        "type": "live_morse_signal",
                        "sender": user_name,
                        "input_mode": data.get("input_mode", input_mode),
                        "signal": data.get("signal"), # 'dot', 'dash', 'open', 'close', 'pulse_on', 'pulse_off'
                        "duration_ms": data.get("duration_ms"),
                        "sequence": data.get("sequence", ""),
                        "partial_text": data.get("partial_text", ""),
                        "confidence": data.get("confidence", 1.0),
                        "timestamp": data.get("timestamp")
                    },
                    exclude_ws=websocket
                )

            # Final completed message broadcast
            elif event_type == "chat_message":
                await ws_manager.broadcast_to_room(
                    room_code=room_code,
                    message={
                        "type": "chat_message",
                        "id": data.get("id"),
                        "sender_name": user_name,
                        "text": data.get("text", ""),
                        "morse_code": data.get("morse_code", ""),
                        "input_mode": data.get("input_mode", input_mode),
                        "confidence": data.get("confidence", 1.0),
                        "signal_quality": data.get("signal_quality", 1.0),
                        "timing_telemetry": data.get("timing_telemetry", []),
                        "timestamp": data.get("timestamp")
                    }
                )

            # Mode update (e.g., user switched from Eye to Audio)
            elif event_type == "update_mode":
                if websocket in ws_manager.connection_meta:
                    ws_manager.connection_meta[websocket]["input_mode"] = data.get("input_mode", input_mode)
                    await ws_manager.broadcast_presence(room_code)

    except WebSocketDisconnect:
        code = ws_manager.disconnect(websocket)
        if code:
            await ws_manager.broadcast_presence(code)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        code = ws_manager.disconnect(websocket)
        if code:
            await ws_manager.broadcast_presence(code)
