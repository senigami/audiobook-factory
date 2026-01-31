import time, uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .engines import wav_to_mp3, terminate_all_subprocesses
from dataclasses import asdict
from .jobs import set_paused
from .config import (
    BASE_DIR, CHAPTER_DIR, UPLOAD_DIR, REPORT_DIR,
    XTTS_OUT_DIR, PIPER_OUT_DIR, NARRATOR_WAV, PART_CHAR_LIMIT
)
from .state import get_jobs, get_settings, update_settings, load_state, save_state, clear_all_jobs, update_job
from .models import Job
from .jobs import enqueue, cancel as cancel_job, toggle_pause, paused, requeue, clear_job_queue
from .voices import list_piper_voices
from .textops import (
    split_by_chapter_markers, write_chapters_to_folder, 
    find_long_sentences, clean_text_for_tts, safe_split_long_sentences,
    split_into_parts
)

app = FastAPI()
templates = Environment(
    loader=FileSystemLoader(str(BASE_DIR / "templates")),
    autoescape=select_autoescape(["html"])
)

app.mount("/out/xtts", StaticFiles(directory=str(XTTS_OUT_DIR)), name="out_xtts")
app.mount("/out/piper", StaticFiles(directory=str(PIPER_OUT_DIR)), name="out_piper")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

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

@app.get("/", response_class=HTMLResponse)
def home(chapter: str = ""):
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
    ))

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
    mode: str = Form("chapter"),
    max_chars: int = Form(PART_CHAR_LIMIT)
):
    path = UPLOAD_DIR / file
    if not path.exists():
        return JSONResponse({"error": "upload not found"}, status_code=404)

    full_text = path.read_text(encoding="utf-8", errors="replace")
    
    if mode == "parts":
        chapters = split_into_parts(full_text, max_chars)
        prefix = "part"
    else:
        chapters = split_by_chapter_markers(full_text)
        prefix = "chapter"
        if not chapters:
            return PlainTextResponse("No chapter markers found. Expected: Chapter 1591: Years Later", status_code=400)

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
    """Create MP3s for any WAV files missing them in both xtts and piper dirs."""
    converted = 0
    failed = 0
    
    for d in [XTTS_OUT_DIR, PIPER_OUT_DIR]:
        d.mkdir(parents=True, exist_ok=True)
        for wav in d.glob("*.wav"):
            mp3 = wav.with_suffix(".mp3")
            if mp3.exists():
                continue
            rc, out = wav_to_mp3(wav, mp3)
            if rc == 0 and mp3.exists():
                converted += 1
            else:
                failed += 1
                
    return JSONResponse({"status": "success", "converted": converted, "failed": failed})

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
    """Returns jobs from state, augmented with file-based auto-discovery."""
    jobs_dict = {j.chapter_file: asdict(j) for j in get_jobs().values()}
    
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

@app.post("/queue/clear")
def clear_history():
    """Wipe job history and empty the in-memory queue."""
    clear_job_queue()
    clear_all_jobs()
    return RedirectResponse("/", status_code=303)


@app.get("/api/preview/{chapter_file}")
def api_preview(chapter_file: str):
    p = CHAPTER_DIR / chapter_file
    if not p.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse({"text": read_preview(p, max_chars=10000)})
