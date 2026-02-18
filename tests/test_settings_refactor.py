import pytest
from fastapi.testclient import TestClient
from pathlib import Path
from unittest.mock import patch
import json

# Import the app
from app.web import app
from app.state import get_settings

client = TestClient(app)

@pytest.fixture
def clean_state(tmp_path):
    test_state_file = tmp_path / "test_state.json"
    with patch("app.state.STATE_FILE", test_state_file):
        yield test_state_file

def test_default_settings_refactor(clean_state):
    # Verify defaults match the new requirement (MP3 False)
    settings = get_settings()
    assert settings["make_mp3"] is False
    assert settings["safe_mode"] is True
    # Ensure xtts_speed is no longer in the defaults
    assert "xtts_speed" not in settings

def test_save_settings_ignores_deprecated_speed(clean_state):
    # 1. Update settings with deprecated field
    response = client.post("/settings", data={
        "safe_mode": "false",
        "make_mp3": "true",
        "xtts_speed": "1.5"
    })
    assert response.status_code == 200
    data = response.json()["settings"]
    
    # 2. Check that valid fields updated
    assert data["safe_mode"] is False
    assert data["make_mp3"] is True
    
    # 3. Check that xtts_speed was ignored/not saved
    assert "xtts_speed" not in data

def test_get_speaker_settings_uses_hardcoded_fallback(clean_state):
    from app.jobs import get_speaker_settings
    
    # We don't need a real profile for this, it falls back to a dict
    # which we modified to have "speed": 1.0 regardless of global settings
    res = get_speaker_settings("NonExistentProfile")
    assert res["speed"] == 1.0

def test_api_home_reflects_new_state_structure(clean_state):
    response = client.get("/api/home")
    assert response.status_code == 200
    settings = response.json()["settings"]
    
    assert "make_mp3" in settings
    assert "safe_mode" in settings
    assert "xtts_speed" not in settings
