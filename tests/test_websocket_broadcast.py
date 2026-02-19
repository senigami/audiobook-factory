import pytest
from fastapi.testclient import TestClient
from app.web import app
from app.state import update_job

def test_websocket_broadcast():
    client = TestClient(app)
    with client.websocket_connect("/ws") as websocket:
        # Manually trigger a job update to test broadcast
        # Since state.py calls listeners, and web.py registers the bridge
        update_job("test_job", status="running", progress=0.1)

        # In a real environment, the bridge runs on the main loop.
        # In TestClient, it typically runs synchronously or we might need to wait.
        # But our bridge uses asyncio.run_coroutine_threadsafe.
        # TestClient handles this by running a separate loop sometimes.

        # Let's see if we can catch the message
        try:
            data = websocket.receive_json(timeout=5)
            assert data["type"] == "job_updated"
            assert data["job_id"] == "test_job"
            assert data["updates"]["status"] == "running"
        except Exception as e:
            pytest.fail(f"WebSocket broadcast failed: {e}")

def test_queue_start_not_redirect():
    client = TestClient(app)
    # This should return JSON now, not a redirect
    response = client.post("/queue/start_xtts")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
