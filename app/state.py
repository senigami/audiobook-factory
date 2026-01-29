import json
import os
import threading
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Any
from json import JSONDecodeError

from .models import Job
from .config import BASE_DIR

STATE_FILE = BASE_DIR / "state.json"

# IMPORTANT: RLock prevents deadlock when a function that holds the lock calls another that also locks.
_STATE_LOCK = threading.RLock()


def _default_state() -> Dict[str, Any]:
    return {
        "jobs": {},
        "settings": {
            "safe_mode": True,
            "make_mp3": True,
            "default_engine": "xtts",
            "default_piper_voice": None
        }
    }


def _atomic_write_text(path: Path, text: str) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(text, encoding="utf-8")
    os.replace(tmp_path, path)


def _load_state_no_lock() -> Dict[str, Any]:
    """
    Internal helper: assumes caller already holds _STATE_LOCK.
    """
    if not STATE_FILE.exists():
        state = _default_state()
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))
        return state

    raw = STATE_FILE.read_text(encoding="utf-8", errors="replace").strip()
    if not raw:
        state = _default_state()
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))
        return state

    try:
        return json.loads(raw)
    except JSONDecodeError:
        # Backup corrupt file and reset
        backup = STATE_FILE.with_name("state.json.corrupt")
        try:
            os.replace(STATE_FILE, backup)
        except Exception:
            pass
        state = _default_state()
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))
        return state


def load_state() -> Dict[str, Any]:
    with _STATE_LOCK:
        return _load_state_no_lock()


def save_state(state: Dict[str, Any]) -> None:
    with _STATE_LOCK:
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))


def get_settings() -> Dict[str, Any]:
    with _STATE_LOCK:
        state = _load_state_no_lock()
        return state.get("settings", {})


def update_settings(**updates) -> None:
    with _STATE_LOCK:
        state = _load_state_no_lock()
        state.setdefault("settings", {})
        state["settings"].update(updates)
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))


def get_jobs() -> Dict[str, Job]:
    with _STATE_LOCK:
        state = _load_state_no_lock()
        raw = state.get("jobs", {})
        return {jid: Job(**j) for jid, j in raw.items()}


def put_job(job: Job) -> None:
    with _STATE_LOCK:
        state = _load_state_no_lock()
        state.setdefault("jobs", {})
        state["jobs"][job.id] = asdict(job)
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))


def update_job(job_id: str, **updates) -> None:
    with _STATE_LOCK:
        state = _load_state_no_lock()
        jobs = state.setdefault("jobs", {})
        j = jobs.get(job_id)
        if not j:
            return
        j.update(updates)
        jobs[job_id] = j
        _atomic_write_text(STATE_FILE, json.dumps(state, indent=2))