from dataclasses import dataclass
from typing import Optional, Literal

Engine = Literal["xtts", "piper", "audiobook"]
Status = Literal["queued", "running", "done", "failed", "cancelled"]

@dataclass
class Job:
    id: str
    engine: Engine
    chapter_file: str
    status: Status
    created_at: float

    started_at: Optional[float] = None
    finished_at: Optional[float] = None

    safe_mode: bool = True
    make_mp3: bool = True

    piper_voice: Optional[str] = None

    output_wav: Optional[str] = None
    output_mp3: Optional[str] = None

    progress: float = 0.0  # 0..1
    eta_seconds: Optional[int] = None

    log: str = ""
    error: Optional[str] = None
    warning_count: int = 0
    custom_title: Optional[str] = None
    author_meta: Optional[str] = None
    narrator_meta: Optional[str] = None
    chapter_list: Optional[List[dict]] = None