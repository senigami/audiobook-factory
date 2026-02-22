import pytest
from fastapi.testclient import TestClient
from pathlib import Path

# Import the app from app.web
from app.web import app
from app.config import CHAPTER_DIR

client = TestClient(app)

@pytest.fixture
def temp_chapter():
    # Setup: Create a temporary chapter file
    test_file = "test_unit_api.txt"
    test_path = CHAPTER_DIR / test_file
    CHAPTER_DIR.mkdir(parents=True, exist_ok=True)
    test_path.write_text("Hello world", encoding="utf-8")
    yield test_file
    # Teardown: Remove the temporary file
    if test_path.exists():
        test_path.unlink()

def test_api_preview_raw(temp_chapter):
    response = client.get(f"/api/preview/{temp_chapter}")
    assert response.status_code == 200
    assert response.json()["text"] == "Hello world"

def test_api_preview_processed(temp_chapter):
    # This should trigger sanitization (adding period)
    response = client.get(f"/api/preview/{temp_chapter}?processed=true")
    assert response.status_code == 200
    # Processed output should have a period and may be padded
    assert response.json()["text"].strip() == "Hello world."

def test_api_jobs_list():
    response = client.get("/api/jobs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_api_audiobook_prepare_empty():
    # If no audio files, should return chapters list
    response = client.get("/api/audiobook/prepare")
    assert response.status_code == 200
    data = response.json()
    assert "chapters" in data
    assert isinstance(data["chapters"], list)

def test_api_active_job():
    response = client.get("/api/active_job")
    assert response.status_code == 200

def test_backfill_surgical_logic(temp_chapter, monkeypatch):
    from app.config import XTTS_OUT_DIR
    from app.state import put_job, get_jobs, delete_jobs
    from app.models import Job
    import time

    def mock_wav_to_mp3(wav_path, mp3_path):
        mp3_path.write_text("fake mp3 content")
        return 0

    monkeypatch.setattr("app.engines.wav_to_mp3", mock_wav_to_mp3)

    # 1. Force a job into state for our temp chapter
    jid = "test_backfill_jid"
    # Cleanup any previous test run
    delete_jobs([jid])

    job = Job(
        id=jid,
        engine="xtts",
        chapter_file=temp_chapter,
        status="done",
        make_mp3=True,
        created_at=time.time()
    )
    put_job(job)

    # 2. Create only the WAV file
    stem = Path(temp_chapter).stem
    wav_path = XTTS_OUT_DIR / f"{stem}.wav"
    mp3_path = XTTS_OUT_DIR / f"{stem}.mp3"
    XTTS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    wav_path.write_text("fake wav content", encoding="utf-8")
    if mp3_path.exists(): mp3_path.unlink()

    # 3. Call backfill endpoint
    # Note: we might need to mock wav_to_mp3 if we don't want real ffmpeg in CI,
    # but for local dev it's better to test it really works if ffmpeg is there.
    response = client.post("/queue/backfill_mp3")
    assert response.status_code == 200
    data = response.json()

    # If ffmpeg is present, 'converted' should be 1.
    # If not, it might be 0 but we can check if it attempted.
    assert "converted" in data

    # 4. Check that the job status is 'done' and not 'queued'
    job = get_jobs().get(jid)
    assert job is not None
    # If it was Fixed surgically, it should be 'done'
    # If it failed surgical and went to reconciliation, it might be 'queued'
    # but the goal of the fix is to make it 'done'
    assert job.status == "done"

    # Cleanup files
    if mp3_path.exists(): mp3_path.unlink()
    delete_jobs([jid])

def test_queue_uniqueness():
    """
    Verifies that a chapter cannot be added to the queue more than once concurrently.
    """
    from app.db import create_project, create_chapter, get_queue
    from app.state import clear_all_jobs
    import uuid

    # 1. Setup clean environment
    clear_all_jobs()

    # 2. Create mock project and chapter
    pid = create_project("Queue Uniqueness Test")
    cid = create_chapter(project_id=pid, title="Unique Chapter")

    # 3. Add to queue first time
    res1 = client.post("/api/processing_queue", data={
        "project_id": pid,
        "chapter_id": cid,
        "split_part": 0,
        "speaker_profile": "test_profile"
    })
    assert res1.status_code == 200

    # 4. Attempt to add to queue second time
    res2 = client.post("/api/processing_queue", data={
        "project_id": pid,
        "chapter_id": cid,
        "split_part": 0,
        "speaker_profile": "test_profile"
    })

    # Should succeed, but return the exact same queue_id instead of a new one
    assert res2.status_code == 200
    assert res1.json()["queue_id"] == res2.json()["queue_id"]

    # 5. Verify the actual queue only has 1 physical row
    q = get_queue()
    chapter_entries = [i for i in q if i["chapter_id"] == cid]
    assert len(chapter_entries) == 1
