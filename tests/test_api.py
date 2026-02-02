import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import os
import json

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
    # Processed output should have a period
    assert response.json()["text"] == "Hello world."

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
