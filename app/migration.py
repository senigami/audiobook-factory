import os
import uuid
import time
from pathlib import Path
from .config import CHAPTER_DIR, XTTS_OUT_DIR
from .db import get_connection, create_project

def import_legacy_filesystem_data():
    """
    Scans CHAPTER_DIR for .txt files and matches them with audio in XTTS_OUT_DIR.
    Creates a 'Legacy Import' project and populates it with chapters.
    """
    txt_files = [f for f in os.listdir(CHAPTER_DIR) if f.endswith('.txt')]
    if not txt_files:
        return {"status": "success", "message": "No legacy text files found."}

    # Create a new project for the import
    project_id = create_project(
        name=f"Legacy Import ({time.strftime('%Y-%m-%d %H:%M')})",
        series="Imported",
        author="System"
    )

    imported_count = 0
    with get_connection() as conn:
        cursor = conn.cursor()

        for txt_name in txt_files:
            stem = Path(txt_name).stem
            txt_path = CHAPTER_DIR / txt_name

            # Read content
            try:
                content = txt_path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            char_count = len(content)
            word_count = len(content.split())

            # Look for matching audio
            audio_file = None
            audio_status = 'unprocessed'

            # Priority .mp3 > .wav
            for ext in ['.mp3', '.wav']:
                potential_audio = XTTS_OUT_DIR / f"{stem}{ext}"
                if potential_audio.exists():
                    audio_file = potential_audio.name
                    audio_status = 'done'
                    break

            chap_id = str(uuid.uuid4())
            now = time.time()

            # Insert into chapters
            cursor.execute("""
                INSERT INTO chapters (
                    id, project_id, title, text_content, sort_order, 
                    audio_status, audio_file_path, text_last_modified, 
                    char_count, word_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                chap_id,
                project_id,
                stem,
                content,
                imported_count,
                audio_status,
                audio_file,
                now,
                char_count,
                word_count
            ))
            imported_count += 1

        conn.commit()

    return {
        "status": "success", 
        "message": f"Successfully imported {imported_count} chapters into Project {project_id}.",
        "project_id": project_id
    }
