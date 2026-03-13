import queue
import threading
from typing import Dict
from ..state import get_settings
from ..config import BASELINE_XTTS_CPS

# Queues and Flags
job_queue: "queue.Queue[str]" = queue.Queue()
assembly_queue: "queue.Queue[str]" = queue.Queue()
cancel_flags: Dict[str, threading.Event] = {}
pause_flag = threading.Event()

# Default fallbacks
# BASELINE_XTTS_CPS moved to config.py

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

def format_seconds(seconds: int) -> str:
    """Formats seconds into readable string (e.g. 1h 2m or 2m 5s or 45s)."""
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m {seconds % 60}s"
    hours = minutes // 60
    return f"{hours}h {minutes % 60}m"

def calculate_predicted_progress(job, now: float, start_time: float, eta: int, limit: float = 0.85, prepare_limit: float = 0.05, prepare_step: float = 0.005) -> float:
    """Safely calculates the predicted progress floor for a job."""
    current_p = getattr(job, 'progress', 0.0)

    if getattr(job, 'status', None) == 'finalizing':
        return current_p

    # If synthesis hasn't started yet, cap progress (Preparing)
    synthesis_started = getattr(job, 'synthesis_started_at', None)

    if not synthesis_started and getattr(job, 'engine', None) != "audiobook":
        return min(prepare_limit, current_p + prepare_step)

    # Use synthesis_started if available (for XTTS), else fallback to worker start time (for audiobook)
    effective_start = synthesis_started or start_time
    actual_elapsed = now - effective_start
    return max(current_p, min(limit, actual_elapsed / max(1, eta)))
