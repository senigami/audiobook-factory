from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

CHAPTER_DIR = BASE_DIR / "chapters_out"
UPLOAD_DIR = BASE_DIR / "uploads"
REPORT_DIR = BASE_DIR / "reports"
XTTS_OUT_DIR = BASE_DIR / "xtts_audio"
AUDIOBOOK_DIR = BASE_DIR / "audiobooks"
VOICES_DIR = BASE_DIR / "voices"

# IMPORTANT: narrator file is in project root: ~/tts-dashboard/narrator_clean.wav
NARRATOR_WAV = BASE_DIR / "narrator_clean.wav"

# Your existing environments (adjust only if different)
XTTS_ENV_ACTIVATE = Path.home() / "xtts-env" / "bin" / "activate"

# XTTS warning threshold you saw
SENT_CHAR_LIMIT = 250
SAFE_SPLIT_TARGET = 200

PART_CHAR_LIMIT = 30000
MAKE_MP3_DEFAULT = True
MP3_QUALITY = "2"  # ffmpeg -q:a 2