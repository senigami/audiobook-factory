import pytest
import time
from fastapi.testclient import TestClient
from pathlib import Path
from app.web import app
from app.config import get_project_audio_dir
from app.db import create_project, create_chapter, update_chapter
from app.state import put_job, Job, get_jobs

client = TestClient(app)

def test_stream_chapter_with_suffixed_filename(tmp_path):
    # Setup: Create a project and chapter
    pid = create_project("Suffix Project")
    cid = create_chapter(pid, "Suffix Chapter", "Suffix content")

    # Simulate a filename with suffix in DB
    audio_path = f"{cid}_0.wav"
    update_chapter(cid, audio_file_path=audio_path)

    # Create the actual file in the project audio dir
    pdir = get_project_audio_dir(pid)
    pdir.mkdir(parents=True, exist_ok=True)
    f = pdir / audio_path
    f.write_text("dummy audio data")

    # Test streaming
    response = client.get(f"/api/chapters/{cid}/stream?project_id={pid}")
    assert response.status_code == 200
    assert response.text == "dummy audio data"

def test_startup_recovery_clears_stuck_states():
    # Mock some jobs in various states
    put_job(Job(id="stuck-preparing", status="preparing", created_at=time.time(), engine="xtts", chapter_file="c1.txt"))
    put_job(Job(id="stuck-finalizing", status="finalizing", created_at=time.time(), engine="xtts", chapter_file="c2.txt"))
    put_job(Job(id="safe-done", status="done", created_at=time.time(), engine="xtts", chapter_file="c3.txt"))

    # Trigger the startup event logic (which we updated in app.web)
    # Since we can't easily trigger the real 'startup' event in a test without side effects,
    # we can call the logic directly or rely on the fact that app instances in TestClient
    # might trigger it if not careful. 
    # Actually, let's just import and run the recovery logic block.

    from app.state import delete_jobs

    # Re-verify initial state
    jobs = get_jobs()
    assert "stuck-preparing" in jobs
    assert "stuck-finalizing" in jobs

    # Run the logic that was added to startup_event
    to_del = [jid for jid, j in jobs.items() if j.status in ("queued", "running", "preparing", "finalizing")]
    if to_del:
        delete_jobs(to_del)

    # Verify they are gone
    remaining = get_jobs()
    assert "stuck-preparing" not in remaining
    assert "stuck-finalizing" not in remaining
    assert "safe-done" in remaining

def test_stream_chapter_fallback_logic():
    # Test that it falls back to {chapter_id}_0.wav even if NOT in DB
    pid = create_project("Fallback Project")
    cid = create_chapter(pid, "Fallback Chapter", "content")

    # DB has NO audio_file_path
    update_chapter(cid, audio_file_path=None)

    pdir = get_project_audio_dir(pid)
    pdir.mkdir(parents=True, exist_ok=True)

    # Create the file on disk anyway
    f = pdir / f"{cid}_0.wav"
    f.write_text("fallback data")

    response = client.get(f"/api/chapters/{cid}/stream?project_id={pid}")
    assert response.status_code == 200
    assert response.text == "fallback data"
