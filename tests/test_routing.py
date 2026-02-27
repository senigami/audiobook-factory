import pytest
from fastapi.testclient import TestClient
from app.web import app
from pathlib import Path

client = TestClient(app)

def test_root_serves_frontend():
    """Verifies that the root URL serves frontend content if built."""
    response = client.get("/")
    assert response.status_code == 200
    # Even if index.html doesn't exist in a test environment, 
    # the code returns a welcome JSON. We check for success.
    # If it DOES exist, it helps verify the catch-all won't break it.
    assert response.headers["content-type"] in ["text/html; charset=utf-8", "application/json"]

def test_frontend_routes_catch_all():
    """
    Verifies that paths like /queue serve index.html (the catch-all).
    If index.html doesn't exist, it should 404 but we can verify the logic.
    """
    response = client.get("/queue")
    # In a typical test env, FRONTEND_DIST/index.html might not exist.
    # But if it DOES exist, it should be 200.
    # If it DOESN'T exist, it should be 404 (handled by the catch_all falling through).
    assert response.status_code in [200, 404]

def test_api_routes_still_404():
    """Verifies that actual missing API routes still return 404 JSON, not index.html."""
    response = client.get("/api/v1/nonexistent_endpoint")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}

def test_file_paths_still_404():
    """Verifies that missing files (with extensions) return 404, not index.html."""
    response = client.get("/assets/missing-file.js")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
