"""FastAPI entrypoint.

Run with::

    uvicorn app.main:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import api, ws

STATIC_DIR = Path(os.environ.get("PI_SERVICES_STATIC_DIR", "static"))

app = FastAPI(title="pi-services")

# Dev convenience: Vite on 5174 talking to backend on 8001.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


if STATIC_DIR.exists():
    # Serve built frontend.  SPA fallback: any non-/api/* request returns
    # index.html so React Router (if used later) keeps working.
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:  # noqa: ARG001
        return FileResponse(STATIC_DIR / "index.html")
