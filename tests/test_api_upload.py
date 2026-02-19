from fastapi.testclient import TestClient
from app.web import app
from pathlib import Path

client = TestClient(app)

def test_upload_json_auto_split():
    # Setup: Create a dummy text file
    test_file = Path("test_upload.txt")
    test_file.write_text("Chapter 1: Header\nBody one.\nChapter 2: Footer\nBody two.")

    try:
        with open(test_file, "rb") as f:
            response = client.post(
                "/upload?json=1&mode=chapter",
                files={"file": ("test_upload.txt", f, "text/plain")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "test_upload.txt" in data["filename"]
        # It should have found 2 chapters
        assert len(data["chapters"]) == 2

        # Verify files exist in chapters_out
        from app.config import CHAPTER_DIR
        for c in data["chapters"]:
            assert (CHAPTER_DIR / c).exists()

    finally:
        if test_file.exists():
            test_file.unlink()
        # Cleanup uploads dir if needed, though Dest overrides if exists
