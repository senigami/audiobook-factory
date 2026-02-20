from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

CHAPTER_DIR = BASE_DIR / "chapters_out"
UPLOAD_DIR = BASE_DIR / "uploads"
REPORT_DIR = BASE_DIR / "reports"
XTTS_OUT_DIR = BASE_DIR / "xtts_audio"
AUDIOBOOK_DIR = BASE_DIR / "audiobooks"
VOICES_DIR = BASE_DIR / "voices"
COVER_DIR = BASE_DIR / "uploads" / "covers"
SAMPLES_DIR = BASE_DIR / "samples"
ASSETS_DIR = BASE_DIR / "assets"
PROJECTS_DIR = BASE_DIR / "projects"

def get_project_dir(project_id: str) -> Path:
    d = PROJECTS_DIR / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_project_audio_dir(project_id: str) -> Path:
    d = get_project_dir(project_id) / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_project_text_dir(project_id: str) -> Path:
    d = get_project_dir(project_id) / "text"
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_project_m4b_dir(project_id: str) -> Path:
    d = get_project_dir(project_id) / "m4b"
    d.mkdir(parents=True, exist_ok=True)
    return d


# Your existing environments (adjust only if different)
XTTS_ENV_ACTIVATE = Path.home() / "xtts-env" / "bin" / "activate"

# XTTS warning threshold you saw
SENT_CHAR_LIMIT = 250
SAFE_SPLIT_TARGET = 200

PART_CHAR_LIMIT = 30000
MAKE_MP3_DEFAULT = False
MP3_QUALITY = "2"  # ffmpeg -q:a 2
AUDIOBOOK_BITRATE = "64k"
