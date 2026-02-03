import queue, threading, time, traceback, os
from pathlib import Path
from typing import Dict

from .models import Job
from .state import get_jobs, put_job, update_job, get_settings, get_performance_metrics, update_performance_metrics
from .config import CHAPTER_DIR, XTTS_OUT_DIR, PIPER_OUT_DIR, AUDIOBOOK_DIR
from .engines import xtts_generate, piper_generate, wav_to_mp3, assemble_audiobook

job_queue: "queue.Queue[str]" = queue.Queue()
cancel_flags: Dict[str, threading.Event] = {}
pause_flag = threading.Event()

# These are default fallbacks; the system will auto-tune these over time in state.json
BASELINE_XTTS_CPS = 16.7
BASELINE_PIPER_CPS = 220.0


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
        mp3 = (PIPER_OUT_DIR / f"{stem}.mp3").exists()
        wav = (PIPER_OUT_DIR / f"{stem}.wav").exists()

    if make_mp3:
        return mp3
    return wav


def reconcile_jobs():
    """Checks all jobs marked as 'done' to ensure their files still exist on disk."""
    all_jobs = get_jobs()
    reset_ids = []
    for jid, j in all_jobs.items():
        if j.status == "done":
            if not _output_exists(j.engine, j.chapter_file, j.make_mp3):
                # File missing! Revert status
                update_job(jid, status="queued", output_mp3=None, output_wav=None)
                reset_ids.append(jid)
    return reset_ids


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
            # For audiobooks, if the m4b is gone, it's stale
            if not (AUDIOBOOK_DIR / f"{j.chapter_file}.m4b").exists():
                stale_ids.append(jid)
    
    if stale_ids:
        delete_jobs(stale_ids)
        # Refresh local map for the next step
        all_jobs = {jid: j for jid, j in all_jobs.items() if jid not in stale_ids}

    # 2. Reconcile missing audio
    reset_ids = []
    for jid, j in all_jobs.items():
        if j.status == "done":
            # Check if ANY output exists (WAV or MP3)
            # If make_mp3 is True, we only consider it truly 'done' if the MP3 exists.
            # However, if the WAV exists but MP3 is missing, we don't necessarily want to 
            # reset it to 'queued' YET if we are about to run backfill_mp3_queue.
            # But the 'reconcile' function is general purpose. 
            
            # Change: Only reset if BOTH are missing OR engine specific requirements aren't met.
            # Let's use a more granular check.
            has_mp3 = (XTTS_OUT_DIR if j.engine == "xtts" else PIPER_OUT_DIR) / f"{Path(j.chapter_file).stem}.mp3"
            has_wav = (XTTS_OUT_DIR if j.engine == "xtts" else PIPER_OUT_DIR) / f"{Path(j.chapter_file).stem}.wav"
            
            if j.make_mp3:
                if not has_mp3.exists() and not has_wav.exists():
                    # Both gone! Must re-run.
                    update_job(jid, status="queued", output_mp3=None, output_wav=None)
                    reset_ids.append(jid)
                elif not has_mp3.exists() and has_wav.exists():
                    # WAV exists, MP3 missing. 
                    # Clear output_mp3 so UI knows it's gone, but keep status=done/wav
                    # so backfill can catch it.
                    update_job(jid, output_mp3=None)
            else:
                if not has_wav.exists():
                    update_job(jid, status="queued", output_mp3=None, output_wav=None)
                    reset_ids.append(jid)
    
    return reset_ids


def worker_loop():
    while True:
        jid = job_queue.get()
        try:
            j = get_jobs().get(jid)
            if not j:
                continue

            # pause support
            while pause_flag.is_set():
                time.sleep(0.2)

            cancel_ev = cancel_flags.get(jid) or threading.Event()
            cancel_flags[jid] = cancel_ev

            update_job(jid, status="running", started_at=time.time(), progress=0.05, error=None)

            chapter_path = CHAPTER_DIR / j.chapter_file
            if j.engine != "audiobook" and not chapter_path.exists():
                update_job(jid, status="failed", finished_at=time.time(), progress=1.0, error="Chapter file not found.")
                continue

            # Skip if output already exists (safety)
            if _output_exists(j.engine, j.chapter_file):
                update_job(jid, status="done", finished_at=time.time(), progress=1.0, log="Skipped: output already exists.")
                continue

            if j.engine != "audiobook":
                perf = get_performance_metrics()
                text = chapter_path.read_text(encoding="utf-8", errors="replace")
                chars = len(text)
                
                # Use learned CPS if available
                cps = perf.get("xtts_cps" if j.engine == "xtts" else "piper_cps", 
                               BASELINE_XTTS_CPS if j.engine == "xtts" else BASELINE_PIPER_CPS)
                
                eta = _estimate_seconds(chars, cps)
                update_job(jid, eta_seconds=eta)
                
                # Formatted header for logs (explicit newlines)
                start_dt = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
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
                text = ""
                chars = 0
                
                # Check source folder to estimate ETA based on file count
                src_dir = XTTS_OUT_DIR
                if not any(src_dir.glob("*.wav")) and not any(src_dir.glob("*.mp3")):
                    src_dir = PIPER_OUT_DIR
                
                # Collect files and total size
                if j.chapter_list:
                    audio_files = [c['filename'] for c in j.chapter_list]
                else:
                    audio_files = [f for f in os.listdir(src_dir) if f.endswith(('.wav', '.mp3'))]
                
                num_files = len(audio_files)
                total_size_mb = sum((src_dir / f).stat().st_size for f in audio_files if (src_dir / f).exists()) / (1024 * 1024)
                
                # Use performance multiplier for auto-tuning
                perf = get_performance_metrics()
                mult = perf.get("audiobook_speed_multiplier", 1.0)
                
                # Base formula calibrated to user hardware: 0.02s per file + 1s per 10MB
                base_eta = (num_files * 0.02) + (total_size_mb / 10)
                eta = max(15, int(base_eta * mult))
                
                update_job(jid, eta_seconds=eta)
                start_dt = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
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

            logs = header.copy()
            start = time.time()

            def on_output(line: str):
                # Filter out noisy lines provided by XTTS/Piper
                s = line.strip()
                if not s: return
                
                # Filter out synthesis progress/text logs
                # Coqui XTTS typically prefixes synthesis text with ' > ' or wraps lists in []
                if s.startswith("> Text"): return
                if s.startswith("> Processing sentence:"): return
                
                # Raw Python list output (often occurs if the command output is verbose)
                if s.startswith("['") or s.startswith('["'): return
                if s.endswith("']") or s.endswith('"]'): return
                if s.startswith("'") and s.endswith("',"): return # Middle of a list
                if s.startswith('"') and s.endswith('",'): return # Middle of a list
                
                # Filter out noisy metadata/warnings we don't need
                if "pkg_resources is deprecated" in s: return
                if "Using model:" in s: return
                if "already downloaded" in s: return
                if "futurewarning" in s.lower(): return
                if "loading model" in s.lower(): return
                if "tensorboard" in s.lower(): return
                
                # Track long sentence warnings as job alerts
                if "exceeds the character limit of 250" in s:
                    # Update warning count in state
                    current_warnings = getattr(j, 'warning_count', 0) + 1
                    j.warning_count = current_warnings
                    update_job(jid, warning_count=current_warnings)

                # If the line is raw text from the chapter (heuristic)
                # Usually these lines don't have brackets or the specific log prefixes we want.
                # Important warnings start with [!] or [v]
                if not s.startswith("[") and not s.startswith(">"):
                    # If it's more than a few words, it's likely chapter text leaking from output
                    if len(s) > 20:
                        return

                logs.append(line)
                elapsed = time.time() - start
                prog = min(0.98, elapsed / max(1, eta))
                # Keep last 20k chars so the JSON doesn't balloon
                update_job(jid, progress=prog, log="".join(logs)[-20000:])

            def cancel_check():
                return cancel_ev.is_set()

            # --- Generate WAV or Audiobook ---
            if j.engine == "audiobook":
                # Audiobook creation uses the selected output dir (xtts or piper)
                # For now, let's assume we use whichever one has more files, or just piper_audio if not specified.
                # The user's request says "from the output of this app". 
                # Let's check both and use the one that exists. 
                # Actually, better to let the user specify. But for now, check xtts then piper.
                src_dir = XTTS_OUT_DIR
                if not any(src_dir.glob("*.wav")) and not any(src_dir.glob("*.mp3")):
                    src_dir = PIPER_OUT_DIR
                
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
                rc = xtts_generate(text=text, out_wav=out_wav, safe_mode=j.safe_mode, on_output=on_output, cancel_check=cancel_check)
            else:
                out_wav = PIPER_OUT_DIR / f"{Path(j.chapter_file).stem}.wav"
                out_mp3 = PIPER_OUT_DIR / f"{Path(j.chapter_file).stem}.mp3"
                voice = j.piper_voice or get_settings().get("default_piper_voice")
                if not voice:
                    update_job(jid, status="failed", finished_at=time.time(), progress=1.0, error="No Piper voice selected.", log="".join(logs))
                    continue
                rc = piper_generate(chapter_file=chapter_path, voice_name=voice, out_wav=out_wav, on_output=on_output, cancel_check=cancel_check)

            if cancel_ev.is_set():
                update_job(jid, status="cancelled", finished_at=time.time(), progress=1.0, error="Cancelled.", log="".join(logs))
                continue

            # --- Auto-tuning feedback (TTS) ---
            if rc == 0 and out_wav.exists() and chars > 0:
                actual_dur = time.time() - start
                if actual_dur > 0:
                    new_cps = chars / actual_dur
                    field = "xtts_cps" if j.engine == "xtts" else "piper_cps"
                    old_cps = perf.get(field, BASELINE_XTTS_CPS if j.engine == "xtts" else BASELINE_PIPER_CPS)
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