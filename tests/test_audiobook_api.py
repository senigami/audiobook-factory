import pytest
from fastapi.testclient import TestClient
from app.web import app
from pathlib import Path
import os
import json

client = TestClient(app)

def test_audiobook_prepare():
    response = client.get("/api/audiobook/prepare")
    assert response.status_code == 200
    data = response.json()
    assert "chapters" in data
    assert "total_duration" in data

def test_create_audiobook():
    response = client.post(
        "/create_audiobook",
        data={
            "title": "Test Book",
            "author": "Test Author",
            "narrator": "Test Narrator",
            "chapters": json.dumps([
                {"filename": "part_0001_Part_1.txt", "title": "Part 1"}
            ])
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # Check if job was created
    from app.state import get_jobs
    jobs = get_jobs()
    found = False
    for j in jobs.values():
        if j.engine == "audiobook" and j.chapter_file == "Test Book":
            found = True
            assert j.author_meta == "Test Author"
            assert j.narrator_meta == "Test Narrator"
            assert len(j.chapter_list) == 1
    assert found
