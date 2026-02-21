import pytest
from fastapi.testclient import TestClient
from app.web import app
from app.models import Job

client = TestClient(app)

def test_crud_projects():
    # create
    res = client.post("/api/projects", data={"name": "P1", "series": "S1", "author": "A1"})
    assert res.status_code == 200
    pid = res.json()["project_id"]

    # fetch list
    res = client.get("/api/projects")
    assert any(p["id"] == pid for p in res.json())

    # get one
    res = client.get(f"/api/projects/{pid}")
    assert res.status_code == 200
    assert res.json()["name"] == "P1"

    # update
    res = client.put(f"/api/projects/{pid}", data={"name": "P2"})
    assert res.status_code == 200
    assert client.get(f"/api/projects/{pid}").json()["name"] == "P2"

    # delete
    res = client.delete(f"/api/projects/{pid}")
    assert res.status_code == 200
    assert client.get(f"/api/projects/{pid}").status_code == 404

def test_chapter_endpoints():
    res = client.post("/api/projects", data={"name": "ChapProj"})
    pid = res.json()["project_id"]

    # create chapter
    res = client.post(f"/api/projects/{pid}/chapters", data={"title": "C1", "text_content": "hello world", "sort_order": 0})
    assert res.status_code == 200
    cid = res.json()["chapter"]["id"]

    # get list
    res = client.get(f"/api/projects/{pid}/chapters")
    assert len(res.json()) >= 1

    # updated chapter text
    res = client.put(f"/api/chapters/{cid}", data={"title": "C1", "text_content": "updated world"})
    assert res.status_code == 200

    # test analyze
    res = client.post("/api/analyze_text", data={"text_content": "A" * 500})
    assert res.status_code == 200

    res = client.delete(f"/api/chapters/{cid}")
    assert res.status_code == 200

def test_missing_entities():
    # missing project
    assert client.get("/api/projects/999").status_code == 404
    client.put("/api/projects/999", data={"name": "x"})
    client.delete("/api/projects/999")

    res = client.get("/api/projects/999/chapters")
    assert res.status_code == 200 # Returns empty list
    assert res.json() == []

    # missing chapter
    pid = client.post("/api/projects", data={"name": "x"}).json()["project_id"]
    assert client.delete("/api/chapters/999").status_code == 404

def test_reports():
    res = client.get("/report/missing_report.json")
    assert res.status_code == 404

def test_speaker_endpoints():
    res = client.get("/api/speaker-profiles")
    assert res.status_code == 200

    res = client.delete("/api/speaker-profiles/non_existent")
    assert res.status_code == 404

def test_queue_endpoints():
    res = client.get("/api/jobs")
    assert res.status_code == 200

    res = client.get("/api/processing_queue")
    assert res.status_code == 200

    res = client.post("/queue/pause")
    assert res.status_code in [200, 422, 405]

    res = client.post("/queue/resume")
    assert res.status_code in [200, 422, 405]

    res = client.post("/api/queue/cancel_pending")
    assert res.status_code in [200, 422, 405]

def test_audiobooks_endpoints():
    res = client.get("/api/audiobooks")
    assert res.status_code == 200
    res = client.delete("/api/audiobook/missing")
    assert res.status_code == 404
