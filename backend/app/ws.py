"""WebSocket live log tail."""

from __future__ import annotations

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import systemd_client as sd

router = APIRouter()


@router.websocket("/ws/services/{name}/logs")
async def ws_tail(ws: WebSocket, name: str) -> None:
    await ws.accept()
    if not sd.is_valid_unit(name):
        await ws.send_json({"type": "error", "message": "invalid unit name"})
        await ws.close()
        return

    tail = sd.tail_logs(name)
    forward_task = asyncio.create_task(_forward(ws, tail))
    try:
        while True:
            # Detect client disconnect.  We don't need anything from them but
            # awaiting receive_text wakes up on close.
            try:
                await ws.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        forward_task.cancel()
        try:
            await forward_task
        except (asyncio.CancelledError, Exception):
            pass
        await tail.aclose()


async def _forward(ws: WebSocket, tail) -> None:
    try:
        async for line in tail:
            await ws.send_json({"type": "line", "line": line})
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        try:
            await ws.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
