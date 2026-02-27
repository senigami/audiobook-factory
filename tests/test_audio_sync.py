import pytest
import os
from pathlib import Path
from fastapi.testclient import TestClient
from app.web import app
from app.db import create_project, create_chapter, get_chapter
from app.config import get_project_audio_dir

client = TestClient(app)

def test_audio_synchronization_discovers_existing_files():
    """
    Verifies that loading the chapter list triggers a sync that discovers 
    audio files on disk even if the DB says they are 'unprocessed'.
    """
    # 1. Setup project and chapter
    pid = create_project("Sync Discovery Test")
    cid = create_chapter(project_id=pid, title="Sync Chapter")

    # Ensure it starts as unprocessed
    chap = get_chapter(cid)
    assert chap['audio_status'] == 'unprocessed'

    # 2. Manually place a mock audio file on disk
    audio_dir = get_project_audio_dir(pid)
    audio_dir.mkdir(parents=True, exist_ok=True)
    mock_file = audio_dir / f"{cid}.wav"
    mock_file.write_text("fake audio") # Not a real wav but enough for discovery

    try:
        # 3. Request the chapters list via API (this should trigger sync)
        response = client.get(f"/api/projects/{pid}/chapters")
        assert response.status_code == 200

        # 4. Verify chapter status is now 'done'
        chap_after = get_chapter(cid)
        assert chap_after['audio_status'] == 'done', "Chapter should have been synced to 'done'"

    finally:
        if mock_file.exists():
            mock_file.unlink()
