import pytest
from fastapi.testclient import TestClient
from app.web import app
from app.db import create_project, create_chapter, add_to_queue, update_queue_item, get_chapter, remove_from_queue
from app.state import clear_all_jobs

client = TestClient(app)

def test_finished_audio_preserved_after_job_removal():
    """
    Verifies that removing a 'done' job from the queue does NOT reset the chapter's audio status.
    """
    # 1. Setup
    clear_all_jobs()
    pid = create_project("Preserve Finished Audio Test")
    cid = create_chapter(project_id=pid, title="Test Chapter")

    # 2. Enqueue and mark as done
    qid = add_to_queue(pid, cid)
    update_queue_item(qid, "done", audio_length_seconds=10.0)

    # Verify initial state
    chap = get_chapter(cid)
    assert chap['audio_status'] == 'done'

    # 3. Remove the job from the queue
    remove_from_queue(qid)

    # 4. Verify chapter status remains 'done'
    chap_after = get_chapter(cid)
    assert chap_after['audio_status'] == 'done', "Chapter audio_status should still be 'done' after removing the finished job"

def test_queued_audio_reset_after_job_removal():
    """
    Verifies that removing a 'queued' job DOES reset the chapter's audio status.
    """
    # 1. Setup
    clear_all_jobs()
    pid = create_project("Reset Queued Audio Test")
    cid = create_chapter(project_id=pid, title="Queued Chapter")

    # 2. Enqueue
    qid = add_to_queue(pid, cid)

    # Verify initial state
    chap = get_chapter(cid)
    assert chap['audio_status'] == 'processing'

    # 3. Remove the job from the queue
    remove_from_queue(qid)

    # 4. Verify chapter status is reset to 'unprocessed'
    chap_after = get_chapter(cid)
    assert chap_after['audio_status'] == 'unprocessed', "Chapter audio_status should be 'unprocessed' after removing a queued job"
