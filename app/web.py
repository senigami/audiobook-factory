import asyncio
import os
import sys
import threading
from typing import Optional, List
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    BASE_DIR, XTTS_OUT_DIR, AUDIOBOOK_DIR, VOICES_DIR, SAMPLES_DIR, 
    UPLOAD_DIR, CHAPTER_DIR, REPORT_DIR, COVER_DIR, ASSETS_DIR, PROJECTS_DIR,
    FRONTEND_DIST
)
from .db import init_db
from .api import projects, chapters, voices, queue, settings, generation, system, analysis, jobs, manager

app = FastAPI()

# --- Static File Serving ---
app.mount("/out/xtts", StaticFiles(directory=str(XTTS_OUT_DIR)), name="out_xtts")
app.mount("/out/audiobook", StaticFiles(directory=str(AUDIOBOOK_DIR)), name="out_audiobook")
app.mount("/out/voices", StaticFiles(directory=str(VOICES_DIR)), name="out_voices")
app.mount("/out/samples", StaticFiles(directory=str(SAMPLES_DIR)), name="out_samples")
app.mount("/out/covers", StaticFiles(directory=str(COVER_DIR)), name="out_covers")
app.mount("/projects", StaticFiles(directory=str(PROJECTS_DIR)), name="projects")

# Serve React build if it exists
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

# --- WebSockets ---
_main_loop = [None]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    if not _main_loop[0]:
        try:
            _main_loop[0] = asyncio.get_running_loop()
        except RuntimeError: pass
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS error: {e}")
        manager.disconnect(websocket)

# --- Lifecycle Events ---
@app.on_event("startup")
async def startup_event():
    # Capture the main event loop
    _main_loop[0] = asyncio.get_running_loop()

    # Initialize DB
    init_db()

    # Ensure directories exist
    for d in [XTTS_OUT_DIR, AUDIOBOOK_DIR, VOICES_DIR, SAMPLES_DIR, UPLOAD_DIR, CHAPTER_DIR, REPORT_DIR, COVER_DIR, ASSETS_DIR, PROJECTS_DIR]:
        d.mkdir(parents=True, exist_ok=True)

@app.on_event("shutdown")
async def shutdown_event():
    from .engines import terminate_all_subprocesses
    terminate_all_subprocesses()

# --- Include Routers ---
app.include_router(projects.router)
app.include_router(chapters.router)
app.include_router(voices.router)
app.include_router(queue.router)
app.include_router(settings.router)
app.include_router(generation.router)
app.include_router(system.router)
app.include_router(analysis.router)
app.include_router(jobs.router)

# --- Catch-all for React Router ---
@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if full_path.startswith("api/") or "." in full_path.split("/")[-1]:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    # If no index, return a basic welcome for the API
    return JSONResponse({
        "name": "Audiobook Studio API",
        "status": "online",
        "frontend": "Not built/found",
        "endpoints": {
            "home": "/api/home",
            "jobs": "/api/jobs",
            "speaker_profiles": "/api/speaker-profiles"
        }
    })
