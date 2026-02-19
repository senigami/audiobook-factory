import time
import uuid
import re
import os
import sys
from typing import Optional, List
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from .engines import wav_to_mp3, terminate_all_subprocesses, xtts_generate, get_audio_duration
from dataclasses import asdict
from .jobs import set_paused
from .config import (
    BASE_DIR, CHAPTER_DIR, UPLOAD_DIR, REPORT_DIR,
    XTTS_OUT_DIR, PART_CHAR_LIMIT, AUDIOBOOK_DIR, VOICES_DIR, COVER_DIR
)
from .state import get_jobs, get_settings, update_settings, clear_all_jobs, update_job
from .models import Job
from .jobs import enqueue, cancel as cancel_job, paused, requeue, clear_job_queue
from .textops import (
    split_by_chapter_markers, write_chapters_to_folder,
    find_long_sentences, clean_text_for_tts, safe_split_long_sentences,
    split_into_parts, sanitize_for_xtts, pack_text_to_limit
)

app = FastAPI()

app.mount("/out/xtts", StaticFiles(directory=str(XTTS_OUT_DIR)), name="out_xtts")
app.mount("/out/audiobook", StaticFiles(directory=str(AUDIOBOOK_DIR)), name="out_audiobook")
app.mount("/out/voices", StaticFiles(directory=str(VOICES_DIR)), name="out_voices")

# Serve React build if it exists
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # print(f"DEBUG: WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            # print(f"DEBUG: WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        # We use a copy to avoid modification during iteration
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                # print(f"DEBUG: Broadcast failed for a connection: {e}")
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages FROM client for now, but need to keep it open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS error: {e}")
        manager.disconnect(websocket)


# We'll use a globally accessible loop variable for the bridge
_main_loop = [None]

def broadcast_test_progress(name: str, progress: float, started_at: float = None):
    import asyncio
    loop = _main_loop[0]
    if loop and loop.is_running():
        msg = {"type": "test_progress", "name": name, "progress": progress}
        if started_at:
            msg["started_at"] = started_at
        asyncio.run_coroutine_threadsafe(
            manager.broadcast(msg),
            loop
        )

@app.on_event("startup")
def startup_event():
    # Re-populate in-memory queue from state on restart
    existing = get_jobs()
    count = 0
    for jid, j in existing.items():
        if j.status == "queued" or j.status == "running":
            # Reset stale jobs to 'cancelled' on startup to prevent auto-start
            update_job(jid,
                       status="cancelled",
                       progress=0.0,
                       started_at=None,
                       log="Reset on startup.",
                       finished_at=None,
                       eta_seconds=None,
                       error="Restarted",
                       warning_count=0)
            count += 1
    if count > 0:
        print(f"recovered {count} jobs from state")

    # Register bridge between state updates and WebSocket broadcast
    import asyncio
    from .state import add_job_listener

    def job_update_bridge(job_id, updates):
        # We need to bridge from the sync world of state.py to async WebSocket
        loop = _main_loop[0]

        if not loop or not loop.is_running():
            try:
                # If we're called from the main thread but loop not set, capture it
                loop = asyncio.get_running_loop()
                _main_loop[0] = loop
            except RuntimeError:
                # Still no running loop in this thread context
                return

        if loop and loop.is_running():
            # print(f"DEBUG: Broadcasting update for {job_id} on loop {id(loop)}")
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "job_updated", "job_id": job_id, "updates": updates}),
                loop
            )

    try:
        # Try to capture the running loop at startup
        _main_loop[0] = asyncio.get_running_loop()
        # print(f"INFO: WebSocket bridge registered loop {id(_main_loop[0])}")
    except RuntimeError:
        # Loop not running yet, will be captured on first bridge call or connection
        pass

    add_job_listener(job_update_bridge)

@app.on_event("shutdown")
def shutdown_event():
    print("Shutting down: killing subprocesses...")
    terminate_all_subprocesses()

def is_react_dev_active():
    """Checks if the React dev server is running on 127.0.0.1:5173"""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.1)
    try:
        s.connect(("127.0.0.1", 5173))
        s.close()
        return True
    except:
        return False

def list_chapters():
    CHAPTER_DIR.mkdir(parents=True, exist_ok=True)
    return sorted(CHAPTER_DIR.glob("*.txt"))

def read_preview(path: Path, max_chars: int = 8000) -> str:
    txt = path.read_text(encoding="utf-8", errors="replace")
    return txt[:max_chars] + ("\n\n...[preview truncated]..." if len(txt) > max_chars else "")

def output_exists(engine: str, chapter_file: str) -> bool:
    stem = Path(chapter_file).stem
    if engine == "xtts":
        return (XTTS_OUT_DIR / f"{stem}.mp3").exists() or (XTTS_OUT_DIR / f"{stem}.wav").exists()
    return False

def xtts_outputs_for(chapter_file: str):
    stem = Path(chapter_file).stem
    wav = XTTS_OUT_DIR / f"{stem}.wav"
    mp3 = XTTS_OUT_DIR / f"{stem}.mp3"
    return wav, mp3


def list_audiobooks():
    if not AUDIOBOOK_DIR.exists(): return []
    res = []
    # Sort m4b files by modification time or name, here we use name reverse
    m4b_files = sorted(AUDIOBOOK_DIR.glob("*.m4b"), reverse=True)

    import subprocess
    import shlex
    for p in m4b_files:
        item = {"filename": p.name, "title": p.name, "cover_url": None}

        # 1. Try to extract embedded title
        try:
            probe_cmd = f"ffprobe -v error -show_entries format_tags=title -of default=noprint_wrappers=1:nokey=1 {shlex.quote(str(p))}"
            title_res = subprocess.run(shlex.split(probe_cmd), capture_output=True, text=True, check=True, timeout=3)
            extracted_title = title_res.stdout.strip()
            if extracted_title:
                item["title"] = extracted_title
        except:
            pass

        # 2. Look for existing cover file
        found_img = False
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            c_path = p.with_suffix(ext)
            if c_path.exists():
                item["cover_url"] = f"/out/audiobook/{p.stem}{ext}"
                found_img = True
                break

        # 2. If not found, try to extract it from the m4b metadata
        if not found_img:
            target_jpg = p.with_suffix(".jpg")
            # This extracts the 'attached_pic' which is mapped as a video stream in m4b
            cmd = f"ffmpeg -y -i {shlex.quote(str(p))} -map 0:v -c copy -frames:v 1 {shlex.quote(str(target_jpg))}"
            try:
                # Run quietly and with a short timeout
                subprocess.run(shlex.split(cmd), capture_output=True, check=True, timeout=5)
                if target_jpg.exists() and target_jpg.stat().st_size > 0:
                    item["cover_url"] = f"/out/audiobook/{p.stem}.jpg"
            except:
                # If extraction fails (e.g. no embedded cover), just skip
                pass

        res.append(item)
    return res

@app.get("/")
def api_welcome():
    """Welcome endpoint for the API."""
    return {
        "name": "Audiobook Factory API",
        "status": "online",
        "frontend": "Please use the React frontend (usually on port 5173 in dev or served on this port in production if built).",
        "endpoints": {
            "home": "/api/home",
            "jobs": "/api/jobs",
            "speaker_profiles": "/api/speaker-profiles"
        }
    }

@app.get("/api/home")
def api_home():
    """Returns initial data for the React SPA."""
    from .jobs import cleanup_and_reconcile
    cleanup_and_reconcile()

    # 1. Get profiles first (this auto-sets default_speaker_profile if needed)
    profiles = list_speaker_profiles()

    # 2. Re-fetch settings so they include the potential new default
    settings = get_settings()

    chapters = [p.name for p in list_chapters()]
    jobs = {j.chapter_file: asdict(j) for j in get_jobs().values()}

    # status sets logic
    xtts_wav_only = []
    xtts_mp3 = []

    for c in chapters:
        stem = Path(c).stem
        if (XTTS_OUT_DIR / f"{stem}.mp3").exists():
            xtts_mp3.append(c)
        if (XTTS_OUT_DIR / f"{stem}.wav").exists():
            xtts_wav_only.append(c)

    return {
        "chapters": chapters,
        "jobs": jobs,
        "settings": settings,
        "paused": paused(),
        "narrator_ok": (VOICES_DIR / "Default").exists(),
        "xtts_mp3": xtts_mp3,
        "xtts_wav_only": xtts_wav_only,
        "audiobooks": list_audiobooks(),
        "speaker_profiles": profiles,
    }

@app.post("/settings")
def save_settings(
    safe_mode: Optional[bool] = Form(None),
    make_mp3: Optional[bool] = Form(None)
):
    curr = get_settings()
    new_safe = safe_mode if safe_mode is not None else curr.get("safe_mode", True)
    new_mp3 = make_mp3 if make_mp3 is not None else curr.get("make_mp3", False)

    update_settings(
        safe_mode=new_safe,
        make_mp3=new_mp3
    )
    return {"status": "success", "settings": get_settings()}

@app.post("/api/settings/default-speaker")
def set_default_speaker(name: str = Form(...)):
    update_settings(default_speaker_profile=name)
    return {"status": "success", "default_speaker_profile": name}

def process_and_split_file(filename: str, mode: str = "parts", max_chars: int = None) -> List[Path]:
    """Helper to split a file into chapters/parts in the CHAPTER_DIR."""
    if max_chars is None:
        max_chars = PART_CHAR_LIMIT

    path = UPLOAD_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Upload not found: {filename}")

    full_text = path.read_text(encoding="utf-8", errors="replace")

    # Normalize mode for comparison
    mode_clean = str(mode).strip().lower()
    print(f"DEBUG: process_and_split_file mode='{mode}' (clean='{mode_clean}') file='{filename}'")

    if mode_clean == "chapter":
        print("DEBUG: Splitting by chapter markers")
        chapters = split_by_chapter_markers(full_text)
        if not chapters:
            raise ValueError("No chapter markers found. Expected: Chapter 1: Title")
        return write_chapters_to_folder(chapters, CHAPTER_DIR, prefix="chapter", include_heading=True)
    else:
        # Default to parts for anything else
        stem = Path(filename).stem
        print(f"DEBUG: Defaulting to part splitting (current mode='{mode_clean}') for '{stem}'")

        chapters = split_into_parts(full_text, max_chars, start_index=1)
        return write_chapters_to_folder(chapters, CHAPTER_DIR, prefix=stem, include_heading=False)

@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    mode: str = "parts",
    max_chars: Optional[int] = None
):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / file.filename
    content = await file.read()
    dest.write_bytes(content)

    try:
        written = process_and_split_file(file.filename, mode=mode, max_chars=max_chars)
        return JSONResponse({
            "status": "success",
            "filename": file.filename,
            "chapters": [p.name for p in written]
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.post("/queue/start_xtts")
def start_xtts_queue(speaker_profile: Optional[str] = Form(None)):
    settings = get_settings()
    existing = get_jobs()
    active = {(j.engine, j.chapter_file) for j in existing.values() if j.status == "running"}

    for p in list_chapters():
        c = p.name
        if output_exists("xtts", c):
            continue
        if ("xtts", c) in active:
            continue

        # Prune any old records for this chapter to prevent duplicates
        # But PRESERVE the custom title and check for existing queued job
        existing_title = None
        existing_queued_id = None
        to_del = []
        for jid, j in existing.items():
            if j.chapter_file == c:
                if j.custom_title:
                    existing_title = j.custom_title
                if j.engine == "xtts":
                    if j.status == "queued":
                        existing_queued_id = jid
                    else:
                        to_del.append(jid)

        if to_del:
            from .state import delete_jobs
            delete_jobs(to_del)

        if existing_queued_id:
            update_job(existing_queued_id,
                       progress=0.0,
                       started_at=None,
                       finished_at=None,
                       eta_seconds=None,
                       log="",
                       error=None,
                       warning_count=0,
                       speaker_profile=speaker_profile)
            requeue(existing_queued_id)
            continue

        jid = uuid.uuid4().hex[:12]
        j = Job(
            id=jid,
            engine="xtts",
            chapter_file=c,
            status="queued",
            created_at=time.time(),
            safe_mode=bool(settings.get("safe_mode", True)),
            make_mp3=True,
            custom_title=existing_title,
            speaker_profile=speaker_profile
        )
        enqueue(j)
        update_job(jid, status="queued") # trigger bridge
    return JSONResponse({"status": "ok", "message": "XTTS queue started"})

@app.get("/queue/start_xtts")
def start_xtts_queue_get():
    # Fallback if something triggers GET (e.g., link click or manual navigation)
    return start_xtts_queue()


@app.post("/queue/pause")
def pause_queue():
    set_paused(True)
    return JSONResponse({"status": "ok", "message": "Queue paused"})

@app.post("/queue/resume")
def resume_queue():
    set_paused(False)
    return JSONResponse({"status": "ok", "message": "Queue resumed"})

@app.post("/api/queue/cancel_pending")
def cancel_pending():
    # 1. Clear in-memory queue
    clear_job_queue()
    # 2. Reset all non-done jobs in state
    existing = get_jobs()
    for jid, j in existing.items():
        if j.status == "queued" or j.status == "running":
            # For 'running' jobs, we should also try to terminate subprocesses
            if j.status == "running":
                cancel_job(jid)
            update_job(jid, status="cancelled", progress=0.0, started_at=None, log="Cancelled by user.")
    return JSONResponse({"status": "ok", "message": "Pending jobs cancelled"})

@app.post("/create_audiobook")
async def create_audiobook(
    title: str = Form(...),
    author: str = Form(None),
    narrator: str = Form(None),
    chapters: str = Form("[]"), # JSON string of {filename, title}
    cover: Optional[UploadFile] = File(None)
):
    import json
    import shutil
    try:
        chapter_list = json.loads(chapters)
    except:
        chapter_list = []

    COVER_DIR.mkdir(parents=True, exist_ok=True)
    AUDIOBOOK_DIR.mkdir(parents=True, exist_ok=True)

    cover_path = None
    if cover:
        ext = Path(cover.filename).suffix
        cover_filename = f"{uuid.uuid4().hex}{ext}"
        cover_path = str(COVER_DIR / cover_filename)
        with open(cover_path, "wb") as f:
            shutil.copyfileobj(cover.file, f)

    jid = uuid.uuid4().hex[:12]
    j = Job(
        id=jid,
        engine="audiobook",
        chapter_file=title, # use this field for the title
        status="queued",
        created_at=time.time(),
        safe_mode=False,
        make_mp3=False,
        author_meta=author,
        narrator_meta=narrator,
        chapter_list=chapter_list,
        cover_path=cover_path
    )
    enqueue(j)
    update_job(jid, status="queued")
    return JSONResponse({"status": "ok", "message": "Audiobook assembly enqueued"})

@app.get("/api/audiobook/prepare")
def prepare_audiobook():
    """Scans folders and returns a preview of chapters/durations for the modal."""
    from .config import XTTS_OUT_DIR

    src_dir = XTTS_OUT_DIR

    if not src_dir.exists():
        return JSONResponse({"title": "", "chapters": []})

    all_files = [f for f in os.listdir(src_dir) if f.endswith(('.wav', '.mp3'))]
    chapters_found = {}
    for f in all_files:
        stem = Path(f).stem
        ext = Path(f).suffix.lower()
        if stem not in chapters_found or ext == '.mp3':
             chapters_found[stem] = f

    def extract_number(filename):
        match = re.search(r'(\d+)', filename)
        return int(match.group(1)) if match else 0

    sorted_stems = sorted(chapters_found.keys(), key=lambda x: extract_number(x))

    preview = []
    total_sec = 0.0
    existing_jobs = get_jobs()
    job_titles = {j.chapter_file: j.custom_title for j in existing_jobs.values() if j.custom_title}

    for stem in sorted_stems:
        fname = chapters_found[stem]
        dur = get_audio_duration(src_dir / fname)

        display_name = job_titles.get(stem + ".txt") or job_titles.get(stem) or stem
        preview.append({
            "filename": fname,
            "title": display_name,
            "duration": dur
        })
        total_sec += dur

    return {
        "title": "Audiobook Project",
        "chapters": preview,
        "total_duration": total_sec
    }

@app.get("/api/speaker-profiles")
def list_speaker_profiles():
    if not VOICES_DIR.exists():
        return []

    dirs = sorted([d for d in VOICES_DIR.iterdir() if d.is_dir()], key=lambda x: x.name)
    settings = get_settings()
    default_speaker = settings.get("default_speaker_profile")

    # Auto-set default if only one exists and none currently set (or current set doesn't exist)
    if dirs:
        names = [d.name for d in dirs]
        if len(dirs) == 1 and default_speaker != names[0]:
            default_speaker = names[0]
            update_settings(default_speaker_profile=default_speaker)
        elif default_speaker and default_speaker not in names:
            # Current default was deleted
            default_speaker = names[0] if len(dirs) > 0 else None
            update_settings(default_speaker_profile=default_speaker)

    profiles = []
    for d in dirs:
        wav_count = len(list(d.glob("*.wav")))

        # Load metadata if exists
        from .jobs import get_speaker_settings
        spk_settings = get_speaker_settings(d.name)
        speed = spk_settings["speed"]
        test_text = spk_settings["test_text"]

        test_wav = VOICES_DIR / d.name / "sample.wav"

        profiles.append({
            "name": d.name,
            "is_default": d.name == default_speaker,
            "wav_count": wav_count,
            "speed": speed,
            "test_text": test_text,
            "preview_url": f"/out/voices/{d.name}/sample.wav" if test_wav.exists() else None
        })
    return profiles

@app.post("/api/speaker-profiles/{name}/test-text")
def update_speaker_test_text(name: str, text: str = Form(...)):
    import json
    profile_dir = VOICES_DIR / name
    if not profile_dir.exists():
        return JSONResponse({"status": "error", "message": "Profile not found"}, status_code=404)

    meta_path = profile_dir / "profile.json"
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
        except: pass

    meta["test_text"] = text
    meta_path.write_text(json.dumps(meta, indent=2))
    return {"status": "success", "test_text": text}

@app.post("/api/speaker-profiles/{name}/reset-test-text")
def reset_speaker_test_text(name: str):
    import json
    profile_dir = VOICES_DIR / name
    if not profile_dir.exists():
        return JSONResponse({"status": "error", "message": "Profile not found"}, status_code=404)

    meta_path = profile_dir / "profile.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
            if "test_text" in meta:
                del meta["test_text"]
                meta_path.write_text(json.dumps(meta, indent=2))
        except: pass

    from .jobs import get_speaker_settings
    new_settings = get_speaker_settings(name)
    return {"status": "success", "test_text": new_settings["test_text"]}

@app.post("/api/speaker-profiles/{name}/speed")
def update_speaker_speed(name: str, speed: float = Form(...)):
    profile_dir = VOICES_DIR / name
    if not profile_dir.exists():
        return JSONResponse({"status": "error", "message": "Profile not found"}, status_code=404)

    meta_path = profile_dir / "profile.json"
    import json
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
        except: pass

    meta["speed"] = speed
    meta_path.write_text(json.dumps(meta, indent=2))
    return {"status": "success", "speed": speed}

@app.post("/api/speaker-profiles/build")
async def build_speaker_profile(
    name: str = Form(...),
    files: List[UploadFile] = File(...)
):
    try:
        if not name or not name.strip():
            return JSONResponse({"status": "error", "message": "Invalid profile name"}, status_code=400)

        VOICES_DIR.mkdir(parents=True, exist_ok=True)
        profile_dir = VOICES_DIR / name

        # Security check to prevent path traversal
        if not str(profile_dir.resolve()).startswith(str(VOICES_DIR.resolve())):
             return JSONResponse({"status": "error", "message": "Invalid profile name (path traversal)"}, status_code=400)

        if profile_dir.exists():
            # Try to cleanup cached latents before deleting the old profile
            try:
                from .jobs import get_speaker_wavs
                from .engines import get_speaker_latent_path
                sw = get_speaker_wavs(name)
                if sw:
                    lp = get_speaker_latent_path(sw)
                    if lp and lp.exists():
                        lp.unlink()
            except:
                pass

            import shutil
            if profile_dir.is_dir():
                shutil.rmtree(profile_dir)
            else:
                profile_dir.unlink()
        profile_dir.mkdir()

        saved_count = 0
        for f in files:
            if not f.filename or not f.filename.lower().endswith(".wav"):
                continue

            # Use only the basename to prevent sub-directory creation/traversal
            basename = os.path.basename(f.filename)
            dest = profile_dir / basename
            content = await f.read()
            dest.write_bytes(content)
            saved_count += 1

        if saved_count == 0:
            return JSONResponse({"status": "error", "message": "No valid .wav files were uploaded"}, status_code=400)

        return {"status": "success", "profile": name, "files_saved": saved_count}
    except Exception as e:
        import traceback
        error_msg = f"Build failed: {str(e)}"
        print(f"ERROR in build_speaker_profile: {error_msg}")
        traceback.print_exc()
        return JSONResponse({"status": "error", "message": error_msg, "traceback": traceback.format_exc()}, status_code=500)

@app.post("/api/speaker-profiles/{name}/rename")
def rename_speaker_profile(name: str, new_name: str = Form(...)):
    from .jobs import get_speaker_wavs
    from .engines import get_speaker_latent_path
    import shutil

    old_dir = VOICES_DIR / name
    new_dir = VOICES_DIR / new_name

    if not old_dir.exists():
        return JSONResponse({"status": "error", "message": "Profile not found"}, status_code=404)
    if new_dir.exists():
        return JSONResponse({"status": "error", "message": f"Profile '{new_name}' already exists"}, status_code=400)

    # 1. Cleanup old latent cache for the old path
    try:
        sw = get_speaker_wavs(name)
        if sw:
            lp = get_speaker_latent_path(sw)
            if lp and lp.exists():
                print(f"Cleanup latent cache for renamed narrator: {name}")
                lp.unlink()
    except Exception as e:
        print(f"Warning: Failed to cleanup latent cache for {name}: {e}")

    # 2. Rename directory
    try:
        shutil.move(str(old_dir), str(new_dir))
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"Move failed: {str(e)}"}, status_code=500)

    # 3. Update global settings if this was the default
    settings = get_settings()
    if settings.get("default_speaker_profile") == name:
        update_settings(default_speaker_profile=new_name)

    return {"status": "success", "new_name": new_name}

@app.delete("/api/speaker-profiles/{name}")
def delete_speaker_profile(name: str):
    from .jobs import get_speaker_wavs
    from .engines import get_speaker_latent_path

    # 1. Try to find and delete cached latents first
    try:
        sw = get_speaker_wavs(name)
        if sw:
            latent_path = get_speaker_latent_path(sw)
            if latent_path and latent_path.exists():
                print(f"Deleting cached latents at {latent_path}")
                latent_path.unlink()
    except Exception as e:
        print(f"Warning: Failed to cleanup latent cache for {name}: {e}")

    # 2. Delete the profile directory
    profile_dir = VOICES_DIR / name
    if profile_dir.exists():
        import shutil
        shutil.rmtree(profile_dir)
        return {"status": "success"}
    return JSONResponse({"status": "error", "message": "Profile not found"}, status_code=404)

@app.post("/api/speaker-profiles/test")
def test_speaker_profile(name: str = Form(...)):
    # Quick one-sentence test
    from .jobs import get_speaker_wavs
    sw = get_speaker_wavs(name)
    if not sw:
        return JSONResponse({"status": "error", "message": "No WAVs found for profile"}, status_code=400)

    test_out = VOICES_DIR / name / "sample.wav"
    from .jobs import get_speaker_settings
    spk_settings = get_speaker_settings(name)
    test_text = spk_settings["test_text"]
    speed = spk_settings["speed"]

    # We run it synchronously for the test
    from .jobs import get_speaker_settings
    settings = get_settings() # Added to get safe_mode setting
    test_start_time = time.time()
    broadcast_test_progress(name, 0.0, started_at=test_start_time)

    def on_xtts_output(line: str):
        # Parse progress from XTTS tqdm output: "Synthesizing:  33%|███▎      | 1/3 [00:05<00:11,  5.69s/sent]"
        # We look for "n/total"
        match = re.search(r'(\d+)/(\d+)\s+\[', line)
        if match:
            current = int(match.group(1))
            total = int(match.group(2))
            if total > 0:
                prog = current / total
                broadcast_test_progress(name, prog, started_at=test_start_time)
        print(line, end="", file=sys.stderr)

    rc = xtts_generate(
        text=test_text,
        out_wav=test_out,
        safe_mode=settings.get("safe_mode", True),
        on_output=on_xtts_output,
        cancel_check=lambda: False,
        speaker_wav=sw,
        speed=speed
    )

    # Final 100% signal
    if rc == 0:
        broadcast_test_progress(name, 1.0)
    else:
        broadcast_test_progress(name, 0.0)

    if rc == 0 and test_out.exists():
        return {"status": "success", "audio_url": f"/out/voices/{name}/sample.wav"}
    return JSONResponse({"status": "error", "message": f"Test generation failed (rc={rc})"}, status_code=500)

@app.post("/cancel")
def cancel(job_id: str = Form(...)):
    cancel_job(job_id)
    return JSONResponse({"status": "ok", "message": f"Job {job_id} cancelled"})

@app.delete("/api/audiobook/{filename}")
def delete_audiobook(filename: str):
    path = AUDIOBOOK_DIR / filename
    if path.exists():
        path.unlink()
        return JSONResponse({"status": "ok", "message": f"Deleted {filename}"})
    return JSONResponse({"status": "error", "message": "File not found"}, status_code=404)

@app.post("/api/chapter/reset")
def reset_chapter(chapter_file: str = Form(...)):
    existing = get_jobs()
    stem = Path(chapter_file).stem

    # 1. Stop any running jobs and delete files
    for jid, j in existing.items():
        if j.chapter_file == chapter_file:
            cancel_job(jid)

    # 2. Delete files on disk
    count = 0
    for d in [XTTS_OUT_DIR]:
        for ext in [".wav", ".mp3"]:
            f = d / f"{stem}{ext}"
            if f.exists():
                f.unlink()
                count += 1

    # 3. Update job records to 'cancelled' so they don't auto-start
    # but preserve custom titles etc.
    for jid, j in existing.items():
        if j.chapter_file == chapter_file:
            update_job(jid,
                       status="cancelled",
                       progress=0.0,
                       output_wav=None,
                       output_mp3=None,
                       log="Audio reset by user.",
                       error=None,
                       warning_count=0)

    return JSONResponse({"status": "ok", "message": f"Reset {chapter_file}, deleted {count} files"})

@app.delete("/api/chapter/{filename}")
def delete_chapter(filename: str):
    path = CHAPTER_DIR / filename
    stem = path.stem

    # 1. Delete audio files
    for d in [XTTS_OUT_DIR]:
        for ext in [".wav", ".mp3"]:
            f = d / f"{stem}{ext}"
            if f.exists():
                f.unlink()

    # 2. Delete job records
    existing = get_jobs()
    to_del = []
    for jid, j in existing.items():
        if j.chapter_file == filename:
            cancel_job(jid)
            to_del.append(jid)

    if to_del:
        from .state import delete_jobs
        delete_jobs(to_del)

    # 3. Delete text file
    if path.exists():
        path.unlink()
        return JSONResponse({"status": "ok", "message": f"Deleted chapter {filename}"})

    return JSONResponse({"status": "error", "message": "Chapter not found"}, status_code=404)

@app.post("/api/queue/single")
def enqueue_single(
    chapter_file: str = Form(...),
    engine: str = Form("xtts")
):
    settings = get_settings()
    existing = get_jobs()

    # 1. Prune old records for this chapter
    to_del = []
    existing_title = None
    for jid, j in existing.items():
        if j.chapter_file == chapter_file:
            if j.custom_title:
                existing_title = j.custom_title
            if j.engine == engine:
                if j.status == "running":
                    return JSONResponse({"status": "error", "message": "Chapter already running"}, status_code=400)
                to_del.append(jid)

    if to_del:
        from .state import delete_jobs
        delete_jobs(to_del)

    # 2. Create and enqueue
    jid = uuid.uuid4().hex[:12]
    j = Job(
        id=jid,
        engine=engine,
        chapter_file=chapter_file,
        status="queued",
        created_at=time.time(),
        safe_mode=bool(settings.get("safe_mode", True)),
        make_mp3=True,
        bypass_pause=True,
        custom_title=existing_title
    )
    enqueue(j)
    update_job(jid, status="queued") # trigger bridge

    return JSONResponse({"status": "ok", "job_id": jid})

def _run_analysis(chapter_file: str):
    p = CHAPTER_DIR / chapter_file
    if not p.exists():
        return None, "Chapter file not found."

    text = p.read_text(encoding="utf-8", errors="replace")

    # Stats
    char_count = len(text)
    word_count = len(text.split())
    # Rough sentence count based on punctuation
    sent_count = text.count('.') + text.count('?') + text.count('!')

    from .jobs import BASELINE_XTTS_CPS
    from .config import SENT_CHAR_LIMIT

    pred_seconds = int(char_count / BASELINE_XTTS_CPS)

    # Analysis logic
    raw_hits = find_long_sentences(text)

    # Processed text analysis
    cleaned_text = clean_text_for_tts(text)
    split_text = safe_split_long_sentences(cleaned_text)
    cleaned_hits = find_long_sentences(split_text)

    uncleanable = len(cleaned_hits)
    auto_fixed = len(raw_hits) - uncleanable

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORT_DIR / f"long_sentences_{Path(chapter_file).stem}.txt"

    lines = [
        f"Character Count   : {char_count:,}",
        f"Word Count        : {word_count:,}",
        f"Sentence Count    : {sent_count:,} (approx)",
        f"Predicted Time    : {pred_seconds // 60}m {pred_seconds % 60}s (@ {BASELINE_XTTS_CPS} cps)",
    ]

    if len(raw_hits) > 0:
        lines.extend([
            "--------------------------------------------------",
            f"Limit Threshold   : {SENT_CHAR_LIMIT} characters",
            f"Raw Long Sentences: {len(raw_hits)}",
            f"Auto-Fixable      : {auto_fixed} (handled by Safe Mode)",
            f"Action Required   : {uncleanable} (STILL too long after split!)",
            "--------------------------------------------------",
            ""
        ])
    else:
        lines.append("")

    if uncleanable > 0:
        lines.append("!!! ACTION REQUIRED: The following sentences could not be auto-split !!!")
        lines.append("")
        for idx, clen, start, end, s in cleaned_hits:
            lines.append(f"--- Uncleanable Sentence ({clen} chars) ---")
            lines.append(s)
            lines.append("")
    elif len(raw_hits) > 0:
        lines.append("✓ All long sentences will be successfully handled by Safe Mode.")

    report_text = "\n".join(lines)
    report_path.write_text(report_text, encoding="utf-8")
    return report_path, report_text


@app.post("/queue/backfill_mp3")
def backfill_mp3_queue():
    """Converts missing MP3s from existing WAVs and reconciles missing records."""
    from .jobs import cleanup_and_reconcile, requeue
    from .engines import wav_to_mp3
    from .state import update_job, get_jobs

    print("DEBUG: Starting backfill_mp3_queue")
    # 1. Reconcile state
    reset_ids = cleanup_and_reconcile()
    print(f"DEBUG: cleanup_and_reconcile reset {len(reset_ids)} jobs: {reset_ids}")

    converted = 0
    failed = 0

    # 2. Identify orphaned WAVs and convert surgically
    all_jobs = get_jobs()
    for d_path in [XTTS_OUT_DIR]:
        d_path.mkdir(parents=True, exist_ok=True)
        for wav in d_path.glob("*.wav"):
            mp3 = wav.with_suffix(".mp3")
            if mp3.exists():
                continue

            # Found a WAV without an MP3
            stem = wav.stem
            print(f"DEBUG: Found orphaned WAV: {wav} (stem: {stem})")

            jid = None
            job_obj = None
            for _jid, _j in all_jobs.items():
                if Path(_j.chapter_file).stem == stem:
                    jid = _jid
                    job_obj = _j
                    break

            if job_obj:
                print(f"DEBUG: Matching job found: {jid} for {job_obj.chapter_file}. make_mp3={job_obj.make_mp3}")
                if job_obj.make_mp3:
                    print(f"DEBUG: Converting {wav} to {mp3}")
                    rc = wav_to_mp3(wav, mp3)
                    if rc == 0 and mp3.exists():
                        print(f"DEBUG: Conversion success: {mp3}")
                        converted += 1
                        update_job(jid, status="done", output_mp3=mp3.name, output_wav=wav.name, progress=1.0)
                        if jid in reset_ids:
                            print(f"DEBUG: Removing {jid} from reset_ids to prevent requeue")
                            reset_ids.remove(jid)
                    else:
                        print(f"DEBUG: Conversion failed (rc={rc}): {wav}")
                        failed += 1
            else:
                print(f"DEBUG: No matching job for stem {stem}")

    print(f"DEBUG: Requeueing remaining {len(reset_ids)} missing jobs: {reset_ids}")
    for rid in reset_ids:
        requeue(rid)

    return JSONResponse({
        "status": "success",
        "converted": converted,
        "failed": failed,
        "reconciled_and_requeued": len(reset_ids)
    })

@app.post("/queue/backfill_mp3_xtts")
def backfill_mp3_xtts():
    """
    Create MP3s for any chapters where we already have XTTS WAV but no MP3 yet.
    Does NOT touch TTS generation, only converts existing wav -> mp3.
    """
    XTTS_OUT_DIR.mkdir(parents=True, exist_ok=True)

    converted = 0
    failed = 0

    for wav in sorted(XTTS_OUT_DIR.glob("*.wav")):
        mp3 = wav.with_suffix(".mp3")
        if mp3.exists():
            continue
        rc = wav_to_mp3(wav, mp3)
        if rc == 0 and mp3.exists():
            converted += 1
        else:
            failed += 1

    return PlainTextResponse(f"Backfill complete. Converted={converted}, Failed={failed}\n")

@app.get("/report/{name}", response_class=PlainTextResponse)
def report(name: str):
    p = REPORT_DIR / name
    if not p.exists():
        return PlainTextResponse("Report not found.", status_code=404)
    return PlainTextResponse(p.read_text(encoding="utf-8", errors="replace"))

@app.get("/api/jobs")
def api_jobs():
    """Returns jobs from state, augmented with file-based auto-discovery and pruning."""
    from .state import get_jobs
    from .jobs import cleanup_and_reconcile
    cleanup_and_reconcile()

    all_jobs = get_jobs()

    # Group by chapter_file, prioritizing running/queued over others
    # Sort by created_at so that for the same status, newer ones win.
    sorted_jobs = sorted(all_jobs.values(), key=lambda j: (1 if j.status in ["running", "queued"] else 0, j.created_at))

    jobs_dict = {}
    for j in sorted_jobs:
        jobs_dict[j.chapter_file] = asdict(j)

    # Dynamic progress update based on time
    now = time.time()
    for j in jobs_dict.values():
        if j.get('status') == 'running' and j.get('started_at') and j.get('eta_seconds'):
            elapsed = now - j['started_at']
            time_prog = min(0.99, elapsed / float(j['eta_seconds']))
            j['progress'] = max(j.get('progress', 0.0), time_prog)

    # Auto-discovery
    chapters = [p.name for p in list_chapters()]
    for c in chapters:
        # If we already have a job record, don't override it unless it's not 'done'
        # and we find a finished file.
        existing = jobs_dict.get(c)
        if existing and existing['status'] == 'done' and (existing.get('output_mp3') or existing.get('output_wav')):
            continue

        stem = Path(c).stem
        x_mp3 = (XTTS_OUT_DIR / f"{stem}.mp3")
        x_wav = (XTTS_OUT_DIR / f"{stem}.wav")

        found_job = {}
        if x_mp3.exists():
            found_job.update({"status": "done", "engine": "xtts", "output_mp3": x_mp3.name})
        if x_wav.exists():
            found_job.update({"engine": "xtts", "output_wav": x_wav.name})
            if not found_job.get("status"):
                found_job["status"] = "done" # If only wav exists, it's still "done" in terms of generation

        if found_job:
            found_job["log"] = "Job auto-discovered from existing files."
            if existing:
                existing.update(found_job)
            else:
                jobs_dict[c] = {
                    "id": f"discovered-{c}",
                    "chapter_file": c,
                    "progress": 1.0,
                    "created_at": 0, # logical start
                    **found_job
                }

    jobs = list(jobs_dict.values())
    jobs.sort(key=lambda j: j.get('created_at', 0))

    # Optimization: Remove full logs from list view to save bandwidth, EXCEPT for running jobs
    for j in jobs:
        if j.get('status') == 'running':
            continue
        if 'log' in j:
            del j['log']

    return JSONResponse(jobs[:400])

@app.get("/api/active_job")
def api_active_job():
    """Returns the currently running job (if any) with full details."""
    jobs = get_jobs().values()
    running = [j for j in jobs if j.status == "running"]
    if not running:
        return JSONResponse(None)

    # Return the first running job (should only be one)
    j = running[0]

    # Calculate dynamic progress/elapsed for the API response too
    if j.started_at and j.eta_seconds:
        now = time.time()
        elapsed = now - j.started_at
        time_prog = min(0.99, elapsed / float(j.eta_seconds))
        j.progress = max(j.progress, time_prog)

    return JSONResponse(asdict(j))

@app.get("/api/job/{chapter_file}")
def api_get_job(chapter_file: str):
    """Returns full details for a specific job."""
    jobs = get_jobs().values()
    # Find job by chapter file
    found = [j for j in jobs if j.chapter_file == chapter_file]
    if found:
        return JSONResponse(asdict(found[0]))

    # If not found in memory/state, try auto-discovery again for logs?
    # For now just return 404
    return JSONResponse(None, status_code=404)

@app.post("/api/job/update_title")
def update_job_title(chapter_file: str = Form(...), new_title: str = Form(...)):
    """Updates the custom title for a specific job or all jobs for a chapter."""
    from .state import get_jobs, update_job, put_job
    import time
    import uuid
    all_jobs = get_jobs()

    # 1. Update EVERY existing job for this chapter file
    found_any = False
    for jid, j in all_jobs.items():
        if j.chapter_file == chapter_file:
            update_job(jid, custom_title=new_title)
            found_any = True

    # 2. If no jobs exist yet, create a placeholder job record so the name is saved
    if not found_any:
        # Check if the chapter file actually exists on disk
        if (CHAPTER_DIR / chapter_file).exists():
            jid = uuid.uuid4().hex[:12]
            # Create a stub job. We'll mark it as 'done' but with no output files,
            # or just leave it 'queued' without actually enqueuing it.
            # api_jobs will pick this up and show the custom_title.
            j = Job(
                id=jid,
                engine="xtts", # Default engine for the record
                chapter_file=chapter_file,
                status="done",
                created_at=time.time(),
                custom_title=new_title,
                log="Job record created to store custom title."
            )
            put_job(j)
            found_any = True

    if not found_any:
        return JSONResponse({"error": "Chapter not found."}, status_code=404)

    return JSONResponse({"status": "success", "custom_title": new_title})

@app.post("/queue/clear")
def clear_history():
    """Wipe job history, empty the in-memory queue, and stop processes."""
    terminate_all_subprocesses()
    clear_job_queue()
    clear_all_jobs()
    return JSONResponse({"status": "ok", "message": "History cleared and processes stopped"})


@app.get("/api/preview/{chapter_file}")
def api_preview(chapter_file: str, processed: bool = False):
    p = CHAPTER_DIR / chapter_file
    if not p.exists():
        return JSONResponse({"error": "not found"}, status_code=404)

    text = read_preview(p, max_chars=1000000)
    analysis = None

    if processed:
        settings = get_settings()
        is_safe = settings.get("safe_mode", True)

        # Include analysis report
        _, analysis = _run_analysis(chapter_file)

        if is_safe:
            # Mimic the engine processing pipeline (Safe Mode ON)
            text = sanitize_for_xtts(text)
            text = safe_split_long_sentences(text)
        else:
            # Raw mode: Absolute bare minimum to prevent speech engine crashes
            text = re.sub(r'[^\x00-\x7F]+', '', text) # ASCII only
            text = text.strip()

        text = pack_text_to_limit(text, pad=True)

    return JSONResponse({"text": text, "analysis": analysis})
