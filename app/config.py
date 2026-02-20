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


# Your existing environments (adjust only if different)
XTTS_ENV_ACTIVATE = Path.home() / "xtts-env" / "bin" / "activate"

# XTTS warning threshold you saw
SENT_CHAR_LIMIT = 250
SAFE_SPLIT_TARGET = 200

PART_CHAR_LIMIT = 30000
MAKE_MP3_DEFAULT = False
MP3_QUALITY = "2"  # ffmpeg -q:a 2
AUDIOBOOK_BITRATE = "64k"
