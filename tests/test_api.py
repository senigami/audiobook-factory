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

def test_api_preview_not_found():
    response = client.get("/api/preview/non_existent_file.txt")
    assert response.status_code == 404
    assert response.json()["error"] == "not found"
