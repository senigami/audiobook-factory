import os
import tempfile
import pytest
from pathlib import Path

# 1. Create a session-wide temp directory for storage isolation
SESSION_TEMP = Path(tempfile.mkdtemp())
os.environ["AUDIOBOOK_BASE_DIR"] = str(SESSION_TEMP)
os.environ["DB_PATH"] = str(SESSION_TEMP / "test_audiobook_factory.db")
os.environ["STATE_FILE"] = str(SESSION_TEMP / "test_state.json")
os.environ["CHAPTER_DIR"] = str(SESSION_TEMP / "chapters_out")
os.environ["UPLOAD_DIR"] = str(SESSION_TEMP / "uploads")
os.environ["REPORT_DIR"] = str(SESSION_TEMP / "reports")
os.environ["XTTS_OUT_DIR"] = str(SESSION_TEMP / "xtts_audio")
os.environ["AUDIOBOOK_DIR"] = str(SESSION_TEMP / "audiobooks")
os.environ["VOICES_DIR"] = str(SESSION_TEMP / "voices")
os.environ["COVER_DIR"] = str(SESSION_TEMP / "uploads/covers")
os.environ["SAMPLES_DIR"] = str(SESSION_TEMP / "samples")
os.environ["ASSETS_DIR"] = str(SESSION_TEMP / "assets")
os.environ["PROJECTS_DIR"] = str(SESSION_TEMP / "projects")

# Ensure all directories exist
for d in ["chapters_out", "uploads", "reports", "xtts_audio", "audiobooks", "voices", "uploads/covers", "samples", "assets", "projects"]:
    (SESSION_TEMP / d).mkdir(parents=True, exist_ok=True)

# 2. NOW import modules that rely on these env vars
from app.db import init_db
from app.state import clear_all_jobs

@pytest.fixture(autouse=True)
def clean_storage():
    """
    Ensures that every test starts with a fresh database and cleared state.
    Storage directory isolation is handled by session-wide environment variables.
    """
    # Initialize/Reset the database
    init_db()

    # Clear in-memory state and state.json
    clear_all_jobs()

    yield
