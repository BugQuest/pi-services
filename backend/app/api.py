"""REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from . import systemd_client as sd

router = APIRouter(prefix="/api")


class ActionResult(BaseModel):
    ok: bool
    message: str


@router.get("/services")
async def list_curated() -> dict:
    """Curated list: units symlinked into ENABLED_DIR."""
    names = sd.list_enabled_units()
    statuses = await sd.get_statuses(names) if names else []
    return {"services": [s.to_dict() for s in statuses]}


@router.get("/services/all")
async def list_all() -> dict:
    """Every service unit known to systemd."""
    names = await sd.list_all_units()
    statuses = await sd.get_statuses(names) if names else []
    return {"services": [s.to_dict() for s in statuses]}


@router.get("/services/{name}")
async def get_one(name: str) -> dict:
    if not sd.is_valid_unit(name):
        raise HTTPException(status_code=400, detail="invalid unit name")
    status = await sd.get_status(name)
    return status.to_dict()


@router.post("/services/{name}/{action}")
async def do_action(name: str, action: str) -> ActionResult:
    if not sd.is_valid_unit(name):
        raise HTTPException(status_code=400, detail="invalid unit name")
    if action not in {"start", "stop", "restart", "reload"}:
        raise HTTPException(status_code=400, detail="unsupported action")
    ok, message = await sd.control(name, action)
    return ActionResult(ok=ok, message=message)


@router.get("/services/{name}/logs")
async def history(name: str, lines: int = Query(default=200, ge=1, le=5000)) -> dict:
    if not sd.is_valid_unit(name):
        raise HTTPException(status_code=400, detail="invalid unit name")
    return {"name": name, "lines": await sd.logs_history(name, lines)}
