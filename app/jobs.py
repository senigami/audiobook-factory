import queue, threading, time, traceback
from pathlib import Path
from typing import Dict

from .models import Job
from .state import get_jobs, put_job, update_job, get_settings
from .config import CHAPTER_DIR, XTTS_OUT_DIR, PIPER_OUT_DIR, AUDIOBOOK_DIR
from .engines import xtts_generate, piper_generate, wav_to_mp3, assemble_audiobook

job_queue: "queue.Queue[str]" = queue.Queue()
cancel_flags: Dict[str, threading.Event] = {}
pause_flag = threading.Event()

# rough baseline chars/sec; tweak later if you want
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


def _output_exists(engine: str, chapter_file: str) -> bool:
    stem = Path(chapter_file).stem
    if engine == "xtts":
        return (XTTS_OUT_DIR / f"{stem}.mp3").exists() or (XTTS_OUT_DIR / f"{stem}.wav").exists()
    return (PIPER_OUT_DIR / f"{stem}.mp3").exists() or (PIPER_OUT_DIR / f"{stem}.wav").exists()


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

            update_job(jid, status="running", started_at=time.time(), progress=0.01, error=None)

            chapter_path = CHAPTER_DIR / j.chapter_file
            if not chapter_path.exists():
                update_job(jid, status="failed", finished_at=time.time(), progress=1.0, error="Chapter file not found.")
                continue

            # Skip if output already exists (safety)
            if _output_exists(j.engine, j.chapter_file):
                update_job(jid, status="done", finished_at=time.time(), progress=1.0, log="Skipped: output already exists.")
                continue

            text = chapter_path.read_text(encoding="utf-8", errors="replace")
            chars = len(text)
            eta = _estimate_seconds(chars, BASELINE_XTTS_CPS if j.engine == "xtts" else BASELINE_PIPER_CPS)
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
                rc = assemble_audiobook(src_dir, title, out_file, on_output, cancel_check)
                
                if rc == 0 and out_file.exists():
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