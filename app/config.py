from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

CHAPTER_DIR = BASE_DIR / "chapters_out"
UPLOAD_DIR = BASE_DIR / "uploads"
REPORT_DIR = BASE_DIR / "reports"
XTTS_OUT_DIR = BASE_DIR / "xtts_audio"
PIPER_OUT_DIR = BASE_DIR / "piper_audio"
VOICES_DIR = BASE_DIR / "voices"
AUDIOBOOK_DIR = BASE_DIR / "audiobooks"

# Engine Model Identifiers
XTTS_V2_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
BARK_MODEL = "tts_models/multilingual/multi-dataset/bark"
TORTOISE_MODEL = "tts_models/en/multi-dataset/tortoise-v2"

# IMPORTANT: narrator file is in project root: ~/tts-dashboard/narrator_clean.wav
NARRATOR_WAV = BASE_DIR / "narrator_clean.wav"

# Your existing environments (adjust only if different)
XTTS_ENV_ACTIVATE = Path.home() / "xtts-env" / "bin" / "activate"
PIPER_ENV_ACTIVATE = Path.home() / "piper-env" / "bin" / "activate"

# XTTS warning threshold you saw
SENT_CHAR_LIMIT = 250
SAFE_SPLIT_TARGET = 200

PART_CHAR_LIMIT = 30000
MAKE_MP3_DEFAULT = True
MP3_QUALITY = "2"  # ffmpeg -q:a 2