import pytest
from fastapi.testclient import TestClient
import json
from unittest.mock import patch, MagicMock

# Import the app
from app.web import app

client = TestClient(app)

@pytest.fixture
def clean_voices(tmp_path):
    test_voices = tmp_path / "test_voices"
    test_voices.mkdir()
    test_state = tmp_path / "test_state.json"
    # Create empty state if needed, but app.state should handle it
    with patch("app.web.VOICES_DIR", test_voices), \
         patch("app.jobs.VOICES_DIR", test_voices), \
         patch("app.config.VOICES_DIR", test_voices), \
         patch("app.state.STATE_FILE", test_state), \
         patch("app.engines.Path", MagicMock(return_value=test_voices)): # Mocking for latent path if needed
        yield test_voices

def test_list_profiles_empty(clean_voices):
    response = client.get("/api/speaker-profiles")
    assert response.status_code == 200
    assert response.json() == []

def test_build_profile(clean_voices):
    # Mocking files
    files = [
        ("files", ("test1.wav", b"fake wav content 1", "audio/wav")),
        ("files", ("test2.wav", b"fake wav content 2", "audio/wav")),
    ]
    response = client.post(
        "/api/speaker-profiles/build",
        data={"name": "TestSpeaker"},
        files=files
    )
    assert response.status_code == 200

    profile_dir = clean_voices / "TestSpeaker"
    assert profile_dir.exists()
    assert (profile_dir / "test1.wav").exists()
    assert (profile_dir / "test2.wav").exists()

    # Check listing now
    response = client.get("/api/speaker-profiles")
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "TestSpeaker"
    assert response.json()[0]["wav_count"] == 2
    assert response.json()[0]["speed"] == 1.0

def test_update_speed(clean_voices):
    # Create a profile first
    profile_dir = clean_voices / "Speedy"
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / "sample.wav").write_text("audio")

    response = client.post(
        "/api/speaker-profiles/Speedy/speed",
        data={"speed": 1.45}
    )
    assert response.status_code == 200
    assert response.json()["speed"] == 1.45

    # Verify persistence
    meta_path = profile_dir / "profile.json"
    assert meta_path.exists()
    meta = json.loads(meta_path.read_text())
    assert meta["speed"] == 1.45

    # Check listing includes speed
    response = client.get("/api/speaker-profiles")
    assert response.json()[0]["speed"] == 1.45

@patch("app.web.xtts_generate")
def test_speaker_profile_test_endpoint(mock_xtts, clean_voices):
    # Create profile
    name = "Tester"
    profile_dir = clean_voices / name
    profile_dir.mkdir(parents=True, exist_ok=True)
    wav_path = profile_dir / "sample.wav"
    wav_path.write_text("audio")

    # Mock successful generation
    mock_xtts.return_value = 0

    # We need to make sure the expected output file exists or the endpoint will return 500
    test_out = clean_voices / name / "sample.wav"
    test_out.parent.mkdir(parents=True, exist_ok=True)
    test_out.write_text("output audio")

    response = client.post(
        "/api/speaker-profiles/test",
        data={"name": name}
    )

    assert response.status_code == 200
    assert response.json()["audio_url"] == f"/out/voices/{name}/sample.wav"

    # Cleanup test output
    if test_out.exists():
        test_out.unlink()

def test_delete_profile(clean_voices):
    name = "DeleteMe"
    profile_dir = clean_voices / name
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / "sample.wav").write_text("audio")

    response = client.delete(f"/api/speaker-profiles/{name}")
    assert response.status_code == 200
    assert not profile_dir.exists()

def test_rename_profile(clean_voices):
    from app.state import update_settings, get_settings
    name = "Original"
    new_name = "Renamed"
    profile_dir = clean_voices / name
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / "sample.wav").write_text("audio")

    # Set as default to test settings update
    update_settings(default_speaker_profile=name)

    response = client.post(f"/api/speaker-profiles/{name}/rename", data={"new_name": new_name})
    assert response.status_code == 200
    assert response.json()["new_name"] == new_name

    assert not (clean_voices / name).exists()
    assert (clean_voices / new_name).exists()
    assert (clean_voices / new_name / "sample.wav").exists()

    # Verify settings updated
    assert get_settings()["default_speaker_profile"] == new_name

def test_get_speaker_settings(clean_voices):
    from app.jobs import get_speaker_settings
    from app.state import update_settings

    # 1. Test global fallback
    update_settings(xtts_speed=1.23)
    settings = get_speaker_settings("NonExistent")
    assert settings["speed"] == 1.23

    # 2. Test per-narrator override
    name = "FastTalker"
    profile_dir = clean_voices / name
    profile_dir.mkdir(parents=True, exist_ok=True)
    meta_path = profile_dir / "profile.json"
    meta_path.write_text(json.dumps({"speed": 1.75}))

    settings = get_speaker_settings(name)
    assert settings["speed"] == 1.75

def test_latent_cache_path():
    from app.engines import get_speaker_latent_path

    # Single wav
    path = get_speaker_latent_path("/path/to/test.wav")
    assert str(path).endswith(".pth")
    assert ".cache/audiobook-factory/voices" in str(path)

    # Comma separated
    path2 = get_speaker_latent_path("/path/1.wav, /path/2.wav")
    assert path2 != path
    assert str(path2).endswith(".pth")
