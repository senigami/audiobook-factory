import queue, threading, time, traceback, os, re
from pathlib import Path
from typing import Dict, Optional

from .models import Job
from .state import get_jobs, put_job, update_job, get_settings, get_performance_metrics, update_performance_metrics
from .config import CHAPTER_DIR, XTTS_OUT_DIR, AUDIOBOOK_DIR
from .engines import xtts_generate, wav_to_mp3, assemble_audiobook

job_queue: "queue.Queue[str]" = queue.Queue()
cancel_flags: Dict[str, threading.Event] = {}
pause_flag = threading.Event()

# These are default fallbacks; the system will auto-tune these over time in state.json
BASELINE_XTTS_CPS = 16.7


def enqueue(job: Job):
    put_job(job)
    cancel_flags[job.id] = threading.Event()
    job_queue.put(job.id)

def requeue(job_id: str):
    """Re-add an existing job id back into the worker queue."""
    job_queue.put(job_id)
    
def cancel(job_id: str):
    ev = cancel_flags.get(job_id)
    if ev:
        ev.set()


def clear_job_queue():
    """Empty the in-memory task queue."""
    while not job_queue.empty():
        try:
            job_queue.get_nowait()
            job_queue.task_done()
        except queue.Empty:
            break


def paused() -> bool:
    return pause_flag.is_set()


def toggle_pause():
    if pause_flag.is_set():
        pause_flag.clear()
    else:
        pause_flag.set()

def set_paused(value: bool):
    if value:
        pause_flag.set()
    else:
        pause_flag.clear()

def _estimate_seconds(text_chars: int, cps: float) -> int:
    return max(5, int(text_chars / max(1.0, cps)))


def _output_exists(engine: str, chapter_file: str, make_mp3: bool = True) -> bool:
    stem = Path(chapter_file).stem
    if engine == "audiobook":
        return (AUDIOBOOK_DIR / f"{chapter_file}.m4b").exists()
    
    if engine == "xtts":
        mp3 = (XTTS_OUT_DIR / f"{stem}.mp3").exists()
        wav = (XTTS_OUT_DIR / f"{stem}.wav").exists()
    else:
        # Fallback for unexpected engine names
        return False

    if make_mp3:
        return mp3
    return wav




def cleanup_and_reconcile():
    """
    Perform a complete scan. 
    1. Prune jobs where text file is gone.
    2. Reset 'done' jobs where audio is gone.
    3. Prune audiobook jobs where m4b is gone.
    Returns: List of jids that were reset/affected.
    """
    from .state import delete_jobs
    all_jobs = get_jobs()
    
    # 1. Prune missing text files & missing audiobooks
    chapters_disk = {p.name for p in (CHAPTER_DIR.glob("*.txt"))}
    stale_ids = []
    for jid, j in all_jobs.items():
        if j.engine != "audiobook":
            if j.chapter_file not in chapters_disk:
                stale_ids.append(jid)
        else:
            # For audiobooks, if the m4b is gone AND it's marked done, it's stale.
            # Do NOT prune queued or running jobs just because the file isn't there yet!
            if j.status == "done" and not (AUDIOBOOK_DIR / f"{j.chapter_file}.m4b").exists():
                stale_ids.append(jid)
    
    if stale_ids:
        delete_jobs(stale_ids)
        # Refresh local map for the next step
        all_jobs = {jid: j for jid, j in all_jobs.items() if jid not in stale_ids}

    # 2. Reconcile missing audio
    reset_ids = []
    for jid, j in all_jobs.items():
        if j.status == "done":
            if j.engine == "audiobook":
                continue # Audiobook pruning is handled in Part 1
            
            # Check if ANY output exists (WAV or MP3)
            # If make_mp3 is True, we only consider it truly 'done' if the MP3 exists.
            has_mp3 = XTTS_OUT_DIR / f"{Path(j.chapter_file).stem}.mp3"
            has_wav = XTTS_OUT_DIR / f"{Path(j.chapter_file).stem}.wav"
            
            if j.make_mp3:
                if not has_mp3.exists() and not has_wav.exists():
                    # Both gone! Must re-run.
                    update_job(jid, 
                               status="queued", 
                               output_mp3=None, 
                               output_wav=None,
                               progress=0.0,
                               started_at=None,
                               finished_at=None,
                               eta_seconds=None,
                               log="",
                               error=None,
                               warning_count=0)
                    reset_ids.append(jid)
                elif not has_mp3.exists() and has_wav.exists():
                    # WAV exists, MP3 missing. 
                    # Clear output_mp3 so UI knows it's gone, but keep status=done/wav
                    # so backfill can catch it.
                    update_job(jid, output_mp3=None)
            else:
                if not has_wav.exists():
                    update_job(jid, 
                               status="queued", 
                               output_mp3=None, 
                               output_wav=None,
                               progress=0.0,
                               started_at=None,
                               finished_at=None,
                               eta_seconds=None,
                               log="",
                               error=None,
                               warning_count=0)
                    reset_ids.append(jid)
    
    # 3. Requeue the reset jobs so the worker picks them up
    for rid in reset_ids:
        requeue(rid)
    
    return reset_ids


def get_speaker_wavs(profile_name: str) -> Optional[str]:
    """Returns a comma-separated string of absolute paths for the given profile."""
    from .config import VOICES_DIR, NARRATOR_WAV
    if not profile_name:
        return str(NARRATOR_WAV) if NARRATOR_WAV.exists() else None
    
    p = VOICES_DIR / profile_name
    if not p.exists() or not p.is_dir():
        return str(NARRATOR_WAV) if NARRATOR_WAV.exists() else None
    
    wavs = sorted(p.glob("*.wav"))
    if not wavs:
        return str(NARRATOR_WAV) if NARRATOR_WAV.exists() else None
        
    return ",".join([str(w.absolute()) for w in wavs])


def get_speaker_settings(profile_name: str) -> dict:
    """Returns metadata (like speed and test text) for a profile, falling back to global settings."""
    from .config import VOICES_DIR
    from .state import get_settings
    import json
    
    defaults = get_settings()
    default_test_text = (
        "The mysterious traveler, bathed in the soft glow of the azure twilight, "
        "whispered of ancient treasures buried beneath the jagged mountains. "
        "'Zephyr,' he exclaimed, his voice a mixture of awe and trepidation, "
        "'the path is treacherous, yet the reward is beyond measure.' "
        "Around them, the vibrant forest hummed with rhythmic sounds while a "
        "cold breeze carried the scent of wet earth and weathered stone."
    )
    
    res = {
        "speed": defaults.get("xtts_speed", 1.0),
        "test_text": default_test_text
    }
    
    if not profile_name:
        return res
        
    p = VOICES_DIR / profile_name
    meta_path = p / "profile.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
            if "speed" in meta:
                res["speed"] = meta["speed"]
            if "test_text" in meta:
                res["test_text"] = meta["test_text"]
        except: pass
        
    return res

def worker_loop():
    while True:
        jid = job_queue.get()
        try:
            j = get_jobs().get(jid)
            if not j:
                continue

            # pause support (unless bypassed by a single-chapter manual enqueue)
            while pause_flag.is_set() and not j.bypass_pause:
                time.sleep(0.2)

            cancel_ev = cancel_flags.get(jid) or threading.Event()
            cancel_flags[jid] = cancel_ev

            start_dt = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
            
            # Prepare initial identity and ETA for immediate UI sync
            chars = 0
            eta = 0
            header = []
            
            if j.engine != "audiobook":
                chapter_path = CHAPTER_DIR / j.chapter_file
                if chapter_path.exists():
                    text = chapter_path.read_text(encoding="utf-8", errors="replace")
                    chars = len(text)
                    perf = get_performance_metrics()
                    cps = perf.get("xtts_cps", BASELINE_XTTS_CPS)
                    eta = _estimate_seconds(chars, cps)
                
                header = [
                    f"Job Started: {j.chapter_file}\n",
                    f"Started At:  {start_dt}\n",
                    f"Engine: {j.engine.upper()}\n",
                    f"Character Count: {chars:,}\n",
                    f"Predicted Duration: {eta // 60}m {eta % 60}s\n",
                    "-" * 40 + "\n",
                    "\n"
                ]
            else:
                # Audiobook identity
                src_dir = XTTS_OUT_DIR
                
                if j.chapter_list:
                    audio_files = [c['filename'] for c in j.chapter_list]
                else:
                    audio_files = [f for f in os.listdir(src_dir) if f.endswith(('.wav', '.mp3'))] if src_dir.exists() else []
                
                num_files = len(audio_files)
                total_size_mb = sum((src_dir / f).stat().st_size for f in audio_files if (src_dir / f).exists()) / (1024 * 1024) if src_dir.exists() else 0
                
                perf = get_performance_metrics()
                mult = perf.get("audiobook_speed_multiplier", 1.0)
                base_eta = (num_files * 0.02) + (total_size_mb / 10)
                eta = max(15, int(base_eta * mult))
                
                header = [
                    f"Job Started: Audiobook {j.chapter_file}\n",
                    f"Started At:  {start_dt}\n",
                    f"Engine: AUDIOBOOK ASSEMBLY\n",
                    f"Chapter Files: {num_files}\n",
                    f"Total Source Size: {total_size_mb:.1f} MB\n",
                    f"Predicted Duration: {eta // 60}m {eta % 60}s\n",
                    "-" * 40 + "\n",
                    "\n"
                ]

            # Trigger immediate UI update with status, ETA, and Log Header
            update_job(jid, 
                       status="running", 
                       started_at=time.time(), 
                       finished_at=None,
                       progress=0.0, 
                       error=None,
                       eta_seconds=eta,
                       log="".join(header))
            
            # CRITICAL: Synchronize the local 'j' object properties so the on_output 
            # closure uses the fresh start state instead of stale data from a previous session.
            j.status = "running"
            j.progress = 0.0
            j.finished_at = None
            j.log = "".join(header)
            j.error = None
            j.eta_seconds = eta
            j.started_at = time.time()
            j._last_broadcast_p = 0.0 # Track what we just sent in update_job above

            # --- Safety Checks ---
            if j.engine != "audiobook" and not chapter_path.exists():
                update_job(jid, status="failed", finished_at=time.time(), progress=1.0, error="Chapter file not found.")
                continue

            if _output_exists(j.engine, j.chapter_file):
                update_job(jid, status="done", finished_at=time.time(), progress=1.0, log="Skipped: output already exists.")
                continue

            logs = header.copy()
            start = time.time()

            def on_output(line: str):
                s = line.strip()
                now = time.time()
                elapsed = now - start
                
                # We'll use these to track if we need to broadcast an update
                new_progress = None
                new_log = None
                
                if not s:
                    # Heartbeat: only update prediction if it's a meaningful change (>1% or >5s since last)
                    current_p = getattr(j, 'progress', 0.0)
                    prog = min(0.98, max(current_p, elapsed / max(1, eta)))
                    
                    last_b = getattr(j, '_last_broadcast_time', 0)
                    last_p = getattr(j, '_last_broadcast_p', 0.0)
                    
                    # Only broadcast heartbeat if it's a meaningful jump or enough time has passed
                    if (prog - last_p >= 0.01) or (now - last_b >= 30.0):
                        prog = round(prog, 2)
                        j.progress = prog
                        j._last_broadcast_time = now
                        j._last_broadcast_p = prog
                        update_job(jid, progress=prog)
                    return
                
                # 1. Filter out noisy lines provided by XTTS/Piper
                if s.startswith("> Text"): return
                if s.startswith("> Processing sentence:"): return
                if s.startswith("['") or s.startswith('["'): return
                if s.endswith("']") or s.endswith('"]'): return
                if s.startswith("'") and s.endswith("',"): return # Middle of a list
                if s.startswith('"') and s.endswith('",'): return # Middle of a list
                if "pkg_resources is deprecated" in s: return
                if "Using model:" in s: return
                if "already downloaded" in s: return
                if "futurewarning" in s.lower(): return
                if "loading model" in s.lower(): return
                if "tensorboard" in s.lower(): return
                if "processing time" in s.lower(): return
                if "real-time factor" in s.lower(): return
                
                # 2. Extract Progress from tqdm if present
                progress_match = re.search(r'(\d+)%', s)
                is_progress_line = progress_match and "|" in s
                if is_progress_line:
                    try:
                        p_val = round(int(progress_match.group(1)) / 100.0, 2)
                        current_p = getattr(j, 'progress', 0.0)
                        if p_val > current_p:
                            # Note: we don't update j.progress here, we let the consolidated broadcast handle it
                            new_progress = p_val
                    except:
                        pass
                
                # 3. Handle logs (only if not strictly progress, or if desired in logs)
                # If it's a progress line, we skip adding it to terminal logs to keep them clean
                # unless it contains other useful info (rare for tqdm).
                if not is_progress_line:
                    # Track long sentence warnings as job alerts
                    if "exceeds the character limit of 250" in s:
                        current_warnings = getattr(j, 'warning_count', 0) + 1
                        j.warning_count = current_warnings
                        update_job(jid, warning_count=current_warnings)

                    # Heuristic: only log meaningful lines
                    if not s.startswith("[") and not s.startswith(">"):
                        if len(s) > 20:
                            pass # likely chapter text leaking, skip
                        else:
                            logs.append(line)
                            new_log = "".join(logs)[-20000:]
                    else:
                        logs.append(line)
                        new_log = "".join(logs)[-20000:]

                # 4. Consolidated Broadcast
                # Decide if we SHOULD include progress in this update
                broadcast_p = getattr(j, '_last_broadcast_p', 0.0)
                
                # Update calculation for prediction (prediction floor)
                if new_progress is None:
                    current_p = getattr(j, 'progress', 0.0)
                    new_val = min(0.98, max(current_p, elapsed / max(1, eta)))
                    new_progress = round(new_val, 2)
                
                # Check threshold against last broadcast
                include_progress = (abs(new_progress - broadcast_p) >= 0.01) or (broadcast_p == 0 and new_progress > 0)

                if new_log is not None or include_progress:
                    j._last_broadcast_time = now
                    args = {}
                    if include_progress:
                        # Ensure internal state matches broadcasted value exactly
                        j.progress = new_progress 
                        j._last_broadcast_p = new_progress
                        args['progress'] = new_progress
                    if new_log is not None: 
                        args['log'] = new_log
                    update_job(jid, **args)

            def cancel_check():
                return cancel_ev.is_set()

            # --- Generate WAV or Audiobook ---
            if j.engine == "audiobook":
                src_dir = XTTS_OUT_DIR
                title = j.chapter_file # We'll repurpose chapter_file to store the book title for audiobook jobs
                out_file = AUDIOBOOK_DIR / f"{title}.m4b"
                
                # Collect custom titles from all jobs
                chapter_titles = {
                    val.chapter_file: val.custom_title 
                    for val in get_jobs().values() 
                    if val.custom_title
                }
                
                rc = assemble_audiobook(
                    src_dir, title, out_file, on_output, cancel_check, 
                    chapter_titles=chapter_titles,
                    author=j.author_meta,
                    narrator=j.narrator_meta,
                    chapters=j.chapter_list
                )
                
                if rc == 0 and out_file.exists():
                    # --- Auto-tuning feedback ---
                    actual_dur = time.time() - start
                    # Calculate multiplier relative to 'base' prediction (0.1s/file + 0.5s/MB)
                    # We use the same base_eta variables defined in the prediction section
                    learned_mult = actual_dur / max(1.0, base_eta)
                    
                    old_mult = perf.get("audiobook_speed_multiplier", 1.0)
                    # Weighted moving average (60% old, 40% new)
                    updated_mult = (old_mult * 0.6) + (learned_mult * 0.4)
                    update_performance_metrics(audiobook_speed_multiplier=updated_mult)
                    
                    on_output(f"\n[performance] Tuned Audiobook multiplier: {old_mult:.2f} -> {updated_mult:.2f}\n")
                    update_job(jid, status="done", finished_at=time.time(), progress=1.0, output_mp3=out_file.name, log="".join(logs))
                else:
                    update_job(jid, status="failed", finished_at=time.time(), progress=1.0, error=f"Audiobook assembly failed (rc={rc})", log="".join(logs))
                continue

            elif j.engine == "xtts":
                out_wav = XTTS_OUT_DIR / f"{Path(j.chapter_file).stem}.wav"
                out_mp3 = XTTS_OUT_DIR / f"{Path(j.chapter_file).stem}.mp3"
                
                # Resolve speaker WAVs and settings from profile
                sw = get_speaker_wavs(j.speaker_profile)
                spk_settings = get_speaker_settings(j.speaker_profile)
                speed = spk_settings["speed"]
                
                rc = xtts_generate(
                    text=text, 
                    out_wav=out_wav, 
                    safe_mode=j.safe_mode, 
                    on_output=on_output, 
                    cancel_check=cancel_check,
                    speaker_wav=sw,
                    speed=speed
                )
            else:
                update_job(jid, status="failed", finished_at=time.time(), progress=1.0, error=f"Unknown engine: {j.engine}", log="".join(logs))
                continue

            if cancel_ev.is_set():
                update_job(jid, status="cancelled", finished_at=time.time(), progress=1.0, error="Cancelled.", log="".join(logs))
                continue

            # --- Auto-tuning feedback (TTS) ---
            if rc == 0 and out_wav.exists() and chars > 0:
                actual_dur = time.time() - start
                if actual_dur > 0:
                    new_cps = chars / actual_dur
                    field = "xtts_cps"
                    old_cps = perf.get(field, BASELINE_XTTS_CPS)
                    # Smoothed update (80% old, 20% new to avoid outlier fluctuations)
                    updated_cps = (old_cps * 0.8) + (new_cps * 0.2)
                    update_performance_metrics(**{field: updated_cps})

            if rc != 0 or not out_wav.exists():
                update_job(
                    jid,
                    status="failed",
                    finished_at=time.time(),
                    progress=1.0,
                    log="".join(logs),
                    error=f"Generation failed (rc={rc})."
                )
                continue

            # --- Convert to MP3 if enabled ---
            if j.make_mp3:
                update_job(jid, progress=0.99, log="".join(logs)[-20000:])
                frc = wav_to_mp3(out_wav, out_mp3, on_output=on_output, cancel_check=cancel_check)
                logs.append(f"\n[ffmpeg] rc={frc}\n")
                if frc == 0 and out_mp3.exists():
                    update_job(
                        jid,
                        status="done",
                        finished_at=time.time(),
                        progress=1.0,
                        output_wav=out_wav.name,
                        output_mp3=out_mp3.name,
                        log="".join(logs)
                    )
                else:
                    update_job(
                        jid,
                        status="done",
                        finished_at=time.time(),
                        progress=1.0,
                        output_wav=out_wav.name,
                        log="".join(logs),
                        error="MP3 conversion failed. Check ffmpeg install and logs."
                    )
            else:
                update_job(
                    jid,
                    status="done",
                    finished_at=time.time(),
                    progress=1.0,
                    output_wav=out_wav.name,
                    log="".join(logs)
                )

        except Exception:
            # This is the critical part: don't let the worker die silently.
            tb = traceback.format_exc()
            try:
                update_job(
                    jid,
                    status="failed",
                    finished_at=time.time(),
                    progress=1.0,
                    error="Worker crashed (exception). See log for traceback.",
                    log=tb[-20000:]
                )
            except Exception:
                # If state writing fails too, at least print to console
                print("FATAL: could not update job state after exception")
                print(tb)
        finally:
            job_queue.task_done()


worker_thread = threading.Thread(target=worker_loop, daemon=True)
worker_thread.start()