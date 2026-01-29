import time, uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from .engines import wav_to_mp3
from dataclasses import asdict
from .jobs import set_paused
from .config import (
    BASE_DIR, CHAPTER_DIR, UPLOAD_DIR, REPORT_DIR,
    XTTS_OUT_DIR, PIPER_OUT_DIR, NARRATOR_WAV
)
from .state import get_jobs, get_settings, update_settings, load_state, save_state
from .models import Job
from .jobs import enqueue, cancel as cancel_job, toggle_pause, paused, requeue
from .voices import list_piper_voices
from .textops import split_by_chapter_markers, write_chapters_to_folder, find_long_sentences

app = FastAPI()
templates = Environment(
    loader=FileSystemLoader(str(BASE_DIR / "templates")),
    autoescape=select_autoescape(["html"])
)

app.mount("/out/xtts", StaticFiles(directory=str(XTTS_OUT_DIR)), name="out_xtts")
app.mount("/out/piper", StaticFiles(directory=str(PIPER_OUT_DIR)), name="out_piper")

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
    return HTMLResponse(tpl.render(file=file))

@app.post("/split")
def do_split(file: str = Form(...)):
    path = UPLOAD_DIR / file
    if not path.exists():
        return JSONResponse({"error": "upload not found"}, status_code=404)

    full_text = path.read_text(encoding="utf-8", errors="replace")
    chapters = split_by_chapter_markers(full_text)
    if not chapters:
        return PlainTextResponse("No chapter markers found. Expected: Chapter 1591: Years Later", status_code=400)

    written = write_chapters_to_folder(chapters, CHAPTER_DIR)
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
def analyze_long(chapter_file: str = Form("")):
    # If chapter_file blank, analyze selected chapter or all later; for now: selected only required.
    if not chapter_file:
        return PlainTextResponse("Pick a chapter from the list first.", status_code=400)

    p = CHAPTER_DIR / chapter_file
    if not p.exists():
        return PlainTextResponse("Chapter file not found.", status_code=404)

    text = p.read_text(encoding="utf-8", errors="replace")
    hits = find_long_sentences(text)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORT_DIR / f"long_sentences_{Path(chapter_file).stem}.txt"

    lines = [f"Long sentences in {chapter_file}", f"Hits: {len(hits)}", ""]
    for idx, clen, start, end, s in hits:
        lines.append(f"--- Sentence {idx} ({clen} chars) ---")
        lines.append(s)
        lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return RedirectResponse(f"/report/{report_path.name}", status_code=303)

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
        rc, out = wav_to_mp3(wav, mp3)
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
    jobs = list(get_jobs().values())
    jobs.sort(key=lambda j: j.created_at)  # keep consistent with UI
    return JSONResponse([asdict(j) for j in jobs[:400]])

@app.post("/queue/reset_stuck")
def reset_stuck_jobs():
    """
    Reset any jobs stuck in RUNNING back to QUEUED, clear stale fields,
    and requeue them so the worker will actually pick them up.
    """
    state = load_state()
    jobs = state.get("jobs", {})
    reset_count = 0

    for jid, j in jobs.items():
        if j.get("status") == "running":
            j["status"] = "queued"
            j["progress"] = 0.0
            j["eta_seconds"] = None
            j["started_at"] = None
            j["finished_at"] = None
            j["output_wav"] = None
            j["output_mp3"] = None
            j["log"] = ""
            j["error"] = "Reset from stuck running state."
            jobs[jid] = j
            reset_count += 1

            # IMPORTANT: actually put it back on the in-memory queue
            requeue(jid)

    state["jobs"] = jobs
    save_state(state)

    return PlainTextResponse(f"Reset and requeued {reset_count} job(s).\n")
    """
    Any job marked running gets reset back to queued.
    Also clears pause so worker can proceed.
    """
    state = load_state()
    jobs = state.get("jobs", {})
    reset_count = 0

    for jid, j in jobs.items():
        if j.get("status") == "running":
            j["status"] = "queued"
            j["progress"] = 0.0
            j["error"] = "Reset from stuck running state."
            reset_count += 1
            jobs[jid] = j

    state["jobs"] = jobs
    save_state(state)

    # make sure queue isn't paused
    set_paused(False)

    return PlainTextResponse(f"Reset {reset_count} running jobs back to queued.\n")

@app.post("/queue/reconcile")
def reconcile_jobs():
    """
    If output files exist on disk, mark matching jobs done and populate output_* fields.
    Optionally clears queued jobs whose outputs already exist.
    """
    state = load_state()
    jobs = state.get("jobs", {})
    fixed = 0

    for jid, j in jobs.items():
        engine = j.get("engine")
        chapter_file = j.get("chapter_file")
        if not engine or not chapter_file:
            continue

        if engine == "xtts":
            wav, mp3 = xtts_outputs_for(chapter_file)
        else:
            wav, mp3 = piper_outputs_for(chapter_file)

        wav_exists = wav.exists()
        mp3_exists = mp3.exists()

        # If files exist, force status to done and fill outputs.
        if wav_exists or mp3_exists:
            j["status"] = "done"
            j["progress"] = 1.0
            j["finished_at"] = j.get("finished_at") or time.time()
            j["started_at"] = j.get("started_at") or j.get("created_at")
            j["error"] = None  # clear old "Reset..." etc.

            j["output_wav"] = wav.name if wav_exists else None
            j["output_mp3"] = mp3.name if mp3_exists else None

            jobs[jid] = j
            fixed += 1

    state["jobs"] = jobs
    save_state(state)
    return PlainTextResponse(f"Reconciled {fixed} job(s) with existing output files.\n")
    
@app.post("/queue/clear_done")
def clear_done_jobs():
    state = load_state()
    jobs = state.get("jobs", {})
    before = len(jobs)

    jobs = {jid: j for jid, j in jobs.items() if j.get("status") != "done"}

    state["jobs"] = jobs
    save_state(state)
    return PlainTextResponse(f"Cleared {before - len(jobs)} done job(s).\n")
