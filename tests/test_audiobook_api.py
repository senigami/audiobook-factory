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

def test_create_audiobook_with_labels():
    response = client.post(
        "/create_audiobook",
        data={
            "title": "Labeled Book",
            "author": "Label Author",
            "narrator": "Label Narrator",
            "chapters": json.dumps([
                {"filename": "part_0001_Part_1.txt", "title": "Custom Chapter Title"}
            ])
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # Check if job was created with correct labels
    from app.state import get_jobs
    jobs = get_jobs()
    found = False
    for j in jobs.values():
        if j.engine == "audiobook" and j.chapter_file == "Labeled Book":
            found = True
            assert j.author_meta == "Label Author"
            assert j.narrator_meta == "Label Narrator"
            assert len(j.chapter_list) == 1
            assert j.chapter_list[0]["title"] == "Custom Chapter Title"
    assert found
