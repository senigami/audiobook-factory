import time, uuid, re, os
from typing import Optional, List, Tuple
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .engines import wav_to_mp3, terminate_all_subprocesses
from dataclasses import asdict
from .jobs import set_paused
from .config import (
    BASE_DIR, CHAPTER_DIR, UPLOAD_DIR, REPORT_DIR,
    XTTS_OUT_DIR, PIPER_OUT_DIR, NARRATOR_WAV, PART_CHAR_LIMIT, AUDIOBOOK_DIR
)
from .state import get_jobs, get_settings, update_settings, load_state, save_state, clear_all_jobs, update_job
from .models import Job
from .jobs import enqueue, cancel as cancel_job, toggle_pause, paused, requeue, clear_job_queue
from .voices import list_piper_voices
from .textops import (
    split_by_chapter_markers, write_chapters_to_folder, 
    find_long_sentences, clean_text_for_tts, safe_split_long_sentences,
    split_into_parts, sanitize_for_xtts, pack_text_to_limit
)

app = FastAPI()

# Ensure directories exist before mounting
for d in [XTTS_OUT_DIR, PIPER_OUT_DIR, AUDIOBOOK_DIR, BASE_DIR / "static"]:
    d.mkdir(parents=True, exist_ok=True)

templates = Environment(
    loader=FileSystemLoader(str(BASE_DIR / "templates")),
    autoescape=select_autoescape(["html"])
)

app.mount("/out/xtts", StaticFiles(directory=str(XTTS_OUT_DIR)), name="out_xtts")
app.mount("/out/piper", StaticFiles(directory=str(PIPER_OUT_DIR)), name="out_piper")
app.mount("/out/audiobook", StaticFiles(directory=str(AUDIOBOOK_DIR)), name="out_audiobook")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

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

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Basic error handling for stale connections
                pass

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
    except Exception:
        manager.disconnect(websocket)

@app.on_event("startup")
def startup_event():
    # Re-populate in-memory queue from state on restart
    existing = get_jobs()
    count = 0
    for jid, j in existing.items():
        if j.status == "queued":
            requeue(jid)
            count += 1
        elif j.status == "running":
            # Reset interrupted running jobs to queued
            update_job(jid, status="queued", error="Restarted")
            requeue(jid)
            count += 1
    if count > 0:
        print(f"recovered {count} jobs from state")

    # Register bridge between state updates and WebSocket broadcast
    import asyncio
    from .state import add_job_listener

    # Capture the main loop correctly in the startup thread
    main_loop = None
    try:
        main_loop = asyncio.get_event_loop()
    except Exception:
        pass

    def job_update_bridge(job_id, updates):
        # We need to bridge from the sync world of state.py to async WebSocket
        loop = main_loop
        if not loop or not loop.is_running():
            try:
                loop = asyncio.get_event_loop()
            except Exception:
                return

        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "job_updated", "job_id": job_id, "updates": updates}),
                loop
            )

    add_job_listener(job_update_bridge)

@app.on_event("shutdown")
def shutdown_event():
    print("Shutting down: killing subprocesses...")
    terminate_all_subprocesses()

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
    return (PIPER_OUT_DIR / f"{stem}.mp3").exists() or (PIPER_OUT_DIR / f"{stem}.wav").exists()

def xtts_outputs_for(chapter_file: str):
    stem = Path(chapter_file).stem
    wav = XTTS_OUT_DIR / f"{stem}.wav"
    mp3 = XTTS_OUT_DIR / f"{stem}.mp3"
    return wav, mp3

def piper_outputs_for(chapter_file: str):
    stem = Path(chapter_file).stem
    wav = PIPER_OUT_DIR / f"{stem}.wav"
    mp3 = PIPER_OUT_DIR / f"{stem}.mp3"
    return wav, mp3

def list_audiobooks():
    if not AUDIOBOOK_DIR.exists(): return []
    return sorted([p.name for p in AUDIOBOOK_DIR.glob("*.m4b")], reverse=True)

@app.get("/", response_class=HTMLResponse)
def home(chapter: str = ""):
    from .jobs import cleanup_and_reconcile
    cleanup_and_reconcile()
    
    chapters = [p.name for p in list_chapters()]
    jobs = list(get_jobs().values())
    jobs.sort(key=lambda j: j.created_at, reverse=True)

    settings = get_settings()
    piper_voices = list_piper_voices()

    # --- status sets (MUST be inside this function) ---
    xtts_wav_only = set()
    xtts_mp3 = set()
    piper_wav_only = set()
    piper_mp3 = set()

    for c in chapters:
        stem = Path(c).stem

        x_wav = (XTTS_OUT_DIR / f"{stem}.wav").exists()
        x_mp3 = (XTTS_OUT_DIR / f"{stem}.mp3").exists()
        if x_mp3:
            xtts_mp3.add(c)
        elif x_wav:
            xtts_wav_only.add(c)

        p_wav = (PIPER_OUT_DIR / f"{stem}.wav").exists()
        p_mp3 = (PIPER_OUT_DIR / f"{stem}.mp3").exists()
        if p_mp3:
            piper_mp3.add(c)
        elif p_wav:
            piper_wav_only.add(c)

    preview_text = ""
    if chapter:
        p = CHAPTER_DIR / chapter
        if p.exists():
            preview_text = read_preview(p)

    tpl = templates.get_template("index.html")
    return HTMLResponse(tpl.render(
        chapters=chapters,
        selected_chapter=chapter,
        preview_text=preview_text,
        jobs=jobs[:200],
        settings=settings,
        piper_voices=piper_voices,
        paused=paused(),
        narrator_ok=NARRATOR_WAV.exists(),
        xtts_mp3=xtts_mp3,
        xtts_wav_only=xtts_wav_only,
        piper_mp3=piper_mp3,
        piper_wav_only=piper_wav_only,
        audiobooks=list_audiobooks(),
    ))

@app.get("/api/home")
def api_home():
    """Returns initial data for the React SPA."""
    from .jobs import cleanup_and_reconcile
    cleanup_and_reconcile()
    
    chapters = [p.name for p in list_chapters()]
    jobs = {j.chapter_file: asdict(j) for j in get_jobs().values()}
    settings = get_settings()
    piper_voices = list_piper_voices()
    
    # status sets logic
    xtts_wav_only = []
    xtts_mp3 = []
    piper_wav_only = []
    piper_mp3 = []

    for c in chapters:
        stem = Path(c).stem
        if (XTTS_OUT_DIR / f"{stem}.mp3").exists(): xtts_mp3.append(c)
        elif (XTTS_OUT_DIR / f"{stem}.wav").exists(): xtts_wav_only.append(c)
        if (PIPER_OUT_DIR / f"{stem}.mp3").exists(): piper_mp3.append(c)
        elif (PIPER_OUT_DIR / f"{stem}.wav").exists(): piper_wav_only.append(c)

    return {
        "chapters": chapters,
        "jobs": jobs,
        "settings": settings,
        "piper_voices": piper_voices,
        "paused": paused(),
        "narrator_ok": NARRATOR_WAV.exists(),
        "xtts_mp3": xtts_mp3,
        "xtts_wav_only": xtts_wav_only,
        "piper_mp3": piper_mp3,
        "piper_wav_only": piper_wav_only,
        "audiobooks": list_audiobooks(),
    }

@app.post("/settings")
def save_settings(
    safe_mode: str = Form(None),
    make_mp3: str = Form(None),
    default_piper_voice: str = Form("")
):
    update_settings(
        safe_mode=bool(safe_mode),
        make_mp3=bool(make_mp3),
        default_piper_voice=(default_piper_voice or None)
    )
    return RedirectResponse("/", status_code=303)

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / file.filename
    content = await file.read()
    dest.write_bytes(content)
    return RedirectResponse(f"/split?file={dest.name}", status_code=303)

@app.get("/split", response_class=HTMLResponse)
def split_page(file: str):
    tpl = templates.get_template("split.html")
    return HTMLResponse(tpl.render(file=file, part_limit=PART_CHAR_LIMIT))

@app.post("/split")
def do_split(
    file: str = Form(...),
    mode: str = Form("parts"),
    max_chars: Optional[int] = Form(None)
):
    if max_chars is None:
        max_chars = PART_CHAR_LIMIT
    path = UPLOAD_DIR / file
    if not path.exists():
        return JSONResponse({"error": "upload not found"}, status_code=404)

    full_text = path.read_text(encoding="utf-8", errors="replace")
    
    # Normalize mode for comparison
    mode_clean = str(mode).strip().lower()
    print(f"DEBUG: do_split mode='{mode}' (clean='{mode_clean}') file='{file}'")

    if mode_clean == "chapter":
        print(f"DEBUG: Splitting by chapter markers")
        chapters = split_by_chapter_markers(full_text)
        prefix = "chapter"
        if not chapters:
            return PlainTextResponse(f"No chapter markers found. Expected: Chapter 1591: Years Later", status_code=400)
    else:
        # Default to parts for anything else
        print(f"DEBUG: Defaulting to part splitting (current mode='{mode_clean}')")
        existing_files = list(CHAPTER_DIR.glob("part_*.txt"))
        max_idx = 0
        for f in existing_files:
            m = re.search(r"part_(\d+)", f.name)
            if m:
                max_idx = max(max_idx, int(m.group(1)))
        
        start_idx = max_idx + 1
        chapters = split_into_parts(full_text, max_chars, start_index=start_idx)
        prefix = "part"

    written = write_chapters_to_folder(chapters, CHAPTER_DIR, prefix=prefix)
    return RedirectResponse(f"/?chapter={written[0].name}", status_code=303)

@app.post("/queue/start_xtts")
def start_xtts_queue():
    settings = get_settings()
    existing = get_jobs()
    active = {(j.engine, j.chapter_file) for j in existing.values() if j.status in ["queued", "running"]}

    for p in list_chapters():
        c = p.name
        if output_exists("xtts", c):
            continue
        if ("xtts", c) in active:
            continue

        jid = uuid.uuid4().hex[:12]
        enqueue(Job(
            id=jid,
            engine="xtts",
            chapter_file=c,
            status="queued",
            created_at=time.time(),
            safe_mode=bool(settings.get("safe_mode", True)),
            make_mp3=bool(settings.get("make_mp3", True)),
        ))
    return RedirectResponse("/", status_code=303)
    
@app.get("/queue/start_xtts")
def start_xtts_queue_get():
    # Fallback if something triggers GET (e.g., link click or manual navigation)
    return start_xtts_queue()

@app.post("/queue/start_piper")
def start_piper_queue(piper_voice: str = Form("")):
    settings = get_settings()
    voice = piper_voice or settings.get("default_piper_voice")
    if not voice:
        return PlainTextResponse("Select a Piper voice (or set default).", status_code=400)

    for p in list_chapters():
        c = p.name
        if output_exists("piper", c):
            continue
        jid = uuid.uuid4().hex[:12]
        enqueue(Job(
            id=jid,
            engine="piper",
            chapter_file=c,
            status="queued",
            created_at=time.time(),
            safe_mode=False,
            make_mp3=bool(settings.get("make_mp3", True)),
            piper_voice=voice
        ))
    return RedirectResponse("/", status_code=303)

@app.post("/queue/pause")
def pause_queue():
    set_paused(True)
    return RedirectResponse("/", status_code=303)

@app.post("/queue/resume")
def resume_queue():
    set_paused(False)
    return RedirectResponse("/", status_code=303)

@app.post("/create_audiobook")
def create_audiobook(
    title: str = Form(...),
    author: str = Form(None),
    narrator: str = Form(None),
    chapters: str = Form("[]") # JSON string of {filename, title}
):
    import json
    try:
        chapter_list = json.loads(chapters)
    except:
        chapter_list = []
    AUDIOBOOK_DIR.mkdir(parents=True, exist_ok=True)
    jid = uuid.uuid4().hex[:12]
    enqueue(Job(
        id=jid,
        engine="audiobook",
        chapter_file=title, # use this field for the title
        status="queued",
        created_at=time.time(),
        safe_mode=False,
        make_mp3=False,
        # We'll store Author/Narrator in the log or as extra fields if we had them,
        # but for now let's pass them through the enqueue system.
        # Actually, let's just use j.author/narrator if we add them to model.
        # For a quick fix without model migration, let's put them in the log start
        # or use a dedicated field. I'll add them to the model for cleanliness.
        author_meta=author,
        narrator_meta=narrator,
        chapter_list=chapter_list
    ))
    return RedirectResponse("/", status_code=303)

@app.get("/api/audiobook/prepare")
def prepare_audiobook():
    """Scans folders and returns a preview of chapters/durations for the modal."""
    from .engines import get_audio_duration
    from .config import XTTS_OUT_DIR, PIPER_OUT_DIR
    
    src_dir = XTTS_OUT_DIR
    if not any(src_dir.glob("*.wav")) and not any(src_dir.glob("*.mp3")):
        src_dir = PIPER_OUT_DIR
        
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
    
    # Get custom titles from state
    from .state import get_jobs
    job_titles = {j.chapter_file: j.custom_title for j in get_jobs().values() if j.custom_title}
    
    preview = []
    total_sec = 0.0
    for stem in sorted_stems:
        fname = chapters_found[stem]
        dur = get_audio_duration(src_dir / fname)
        
        display_name = job_titles.get(stem + ".txt") or job_titles.get(stem) or stem
        
        preview.append({
            "filename": fname,
            "title": display_name,
            "start_sec": total_sec,
            "duration": dur
        })
        total_sec += dur
        
    return JSONResponse({
        "chapters": preview,
        "total_duration": total_sec
    })

@app.post("/cancel")
def cancel(job_id: str = Form(...)):
    cancel_job(job_id)
    return RedirectResponse("/", status_code=303)

@app.post("/analyze_long")
def analyze_long(chapter_file: str = Form(""), ajax: bool = Form(False)):
    if not chapter_file:
        return PlainTextResponse("Pick a chapter from the list first.", status_code=400)

    p = CHAPTER_DIR / chapter_file
    if not p.exists():
        return PlainTextResponse("Chapter file not found.", status_code=404)

    text = p.read_text(encoding="utf-8", errors="replace")
    
    # Stats
    char_count = len(text)
    word_count = len(text.split())
    # Rough sentence count based on punctuation
    sent_count = text.count('.') + text.count('?') + text.count('!')
    
    # Predict time (using XTTS constant for general reference, or make it dynamic later)
    # Importing BASELINE_XTTS_CPS would be circular if not careful, but web.py imports nothing from jobs.py?
    # Actually web.py imports from jobs.py (start_xtts_queue -> get_jobs). 
    # But jobs.py imports web.py? No.
    # Let's import the constants or just define them/import them from config if possible.
    # jobs.py has them. Let's move constants to config.py or just use the value 25.0 for now to avoid circular import issues if they exist.
    # Wait, web.py DOES NOT import jobs.py at top level?
    # It imports `start_xtts_queue` logic? No, web.py *defines* the routes.
    # It imports `enqueue` from `jobs`.
    # Let's see imports in web.py...
    
    # Actually, simplistic approach: use the same 25.0 hardcoded or import if safe.
    # Checking file outline... web.py imports:
    # from .jobs import enqueue, cancel, paused, resume_queue, pause_queue, clear_job_queue
    # So importing BASELINE_XTTS_CPS from jobs should be fine.
    
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
        f"Analysis Report: {chapter_file}",
        f"--------------------------------------------------",
        f"Character Count   : {char_count:,}",
        f"Word Count        : {word_count:,}",
        f"Sentence Count    : {sent_count:,} (approx)",
        f"Predicted Time    : {pred_seconds // 60}m {pred_seconds % 60}s (@ {BASELINE_XTTS_CPS} cps)",
        f"--------------------------------------------------",
        f"Limit Threshold   : {SENT_CHAR_LIMIT} characters",
        f"Raw Long Sentences: {len(raw_hits)}",
        f"Auto-Fixable      : {auto_fixed} (handled by Safe Mode)",
        f"Action Required   : {uncleanable} (STILL too long after split!)",
        f"--------------------------------------------------",
        ""
    ]
    
    if uncleanable > 0:
        lines.append("!!! ACTION REQUIRED: The following sentences could not be auto-split !!!")
        lines.append("")
        for idx, clen, start, end, s in cleaned_hits:
            lines.append(f"--- Uncleanable Sentence ({clen} chars) ---")
            lines.append(s)
            lines.append("")
    elif len(raw_hits) > 0:
        lines.append("✓ All long sentences will be successfully handled by Safe Mode.")
    else:
        lines.append("✓ No long sentences found.")

    report_text = "\n".join(lines)
    report_path.write_text(report_text, encoding="utf-8")
    
    settings = get_settings()
    is_safe = settings.get("safe_mode", True)

    if ajax:
        return JSONResponse({
            "report": report_text,
            "safe_mode": is_safe
        })
    return RedirectResponse(f"/report/{report_path.name}", status_code=303)
@app.get("/analyze_batch", response_class=HTMLResponse)
def analyze_batch():
    chapters = list_chapters()
    results = []
    
    from .config import SENT_CHAR_LIMIT
    
    for p in chapters:
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
            raw_hits = find_long_sentences(text)
            
            # Analyze what safe split would do
            cleaned_text = clean_text_for_tts(text)
            split_text = safe_split_long_sentences(cleaned_text)
            cleaned_hits = find_long_sentences(split_text)
            
            uncleanable_count = len(cleaned_hits)
            
            results.append({
                "filename": p.name,
                "char_count": len(text),
                "raw_count": len(raw_hits),
                "auto_fixed": len(raw_hits) - uncleanable_count,
                "uncleanable": uncleanable_count,
                "report_name": f"long_sentences_{p.stem}.txt"
            })
        except Exception as e:
            print(f"Error processing {p.name}: {e}")
            results.append({
                "filename": p.name,
                "char_count": 0,
                "raw_count": 0,
                "auto_fixed": 0,
                "uncleanable": 0,
                "error": str(e)
            })
    
    settings = get_settings()
    is_safe = settings.get("safe_mode", True)

    tpl = templates.get_template("report_batch.html")
    return HTMLResponse(tpl.render(
        results=results,
        limit=SENT_CHAR_LIMIT,
        safe_mode=is_safe
    ))


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
    for d_path in [XTTS_OUT_DIR, PIPER_OUT_DIR]:
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
    jobs_dict = {j.chapter_file: asdict(j) for j in all_jobs.values()}
    for j in all_jobs.values():
        if j.custom_title:
            jobs_dict[j.chapter_file]['custom_title'] = j.custom_title
    
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
        if existing and existing['status'] == 'done':
            continue
            
        stem = Path(c).stem
        x_mp3 = (XTTS_OUT_DIR / f"{stem}.mp3")
        p_mp3 = (PIPER_OUT_DIR / f"{stem}.mp3")
        x_wav = (XTTS_OUT_DIR / f"{stem}.wav")
        p_wav = (PIPER_OUT_DIR / f"{stem}.wav")
        
        found_job = None
        if x_mp3.exists():
            found_job = {"status": "done", "engine": "xtts", "output_mp3": x_mp3.name, "log": "Job auto-discovered from existing files."}
        elif p_mp3.exists():
            found_job = {"status": "done", "engine": "piper", "output_mp3": p_mp3.name, "log": "Job auto-discovered from existing files."}
        elif x_wav.exists():
            found_job = {"status": "wav", "engine": "xtts", "output_wav": x_wav.name, "log": "WAV file found. Waiting for MP3 conversion."}
        elif p_wav.exists():
            found_job = {"status": "wav", "engine": "piper", "output_wav": p_wav.name, "log": "WAV file found. Waiting for MP3 conversion."}
            
        if found_job:
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
    
    # Optimization: Remove full logs from list view to save bandwidth
    for j in jobs:
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
    """Updates the custom title for a specific job."""
    from .state import get_jobs, update_job
    jobs = get_jobs().values()
    found = [j for j in jobs if j.chapter_file == chapter_file]
    if not found:
        # If no job exists yet, we should probably create one or just return error
        # For now, if it's a known chapter file, find its discovered ID
        if (CHAPTER_DIR / chapter_file).exists():
            # In a real app we might want to put_job here, 
            # but usually the user is editing an existing job record.
            return JSONResponse({"error": "Job record not found. Please start processing first."}, status_code=404)
        return JSONResponse({"error": "Chapter not found."}, status_code=404)
    
    update_job(found[0].id, custom_title=new_title)
    return JSONResponse({"status": "success", "custom_title": new_title})

@app.post("/queue/clear")
def clear_history():
    """Wipe job history and empty the in-memory queue."""
    clear_job_queue()
    clear_all_jobs()
    return RedirectResponse("/", status_code=303)


@app.get("/api/preview/{chapter_file}")
def api_preview(chapter_file: str, processed: bool = False):
    p = CHAPTER_DIR / chapter_file
    if not p.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    
    text = read_preview(p, max_chars=1000000)
    
    if processed:
        # Mimic the engine processing pipeline
        text = sanitize_for_xtts(text)
        
        settings = get_settings()
        if settings.get("safe_mode", True):
            text = safe_split_long_sentences(text)
        
        text = pack_text_to_limit(text)
        
    return JSONResponse({"text": text})
