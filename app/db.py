import sqlite3
import time
import uuid
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from threading import Lock

from .config import BASE_DIR

DB_PATH = BASE_DIR / "audiobook_factory.db"
_db_lock = Lock()

def get_connection() -> sqlite3.Connection:
    # Use check_same_thread=False because we use a global lock, and we might query from different threads
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()

            # Projects table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                series TEXT,
                author TEXT,
                cover_image_path TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
            """)

            # Chapters table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                text_content TEXT,
                sort_order INTEGER NOT NULL,
                audio_status TEXT NOT NULL DEFAULT 'unprocessed',
                audio_file_path TEXT,
                text_last_modified REAL,
                audio_generated_at REAL,
                char_count INTEGER DEFAULT 0,
                word_count INTEGER DEFAULT 0,
                predicted_audio_length REAL DEFAULT 0.0,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
            """)

            # Processing Queue table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS processing_queue (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                chapter_id TEXT NOT NULL,
                split_part INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'queued',
                created_at REAL NOT NULL,
                completed_at REAL,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
            )
            """)

            # Settings table (Key-Value)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """)

            conn.commit()

# Project Functions
def create_project(name: str, series: Optional[str] = None, author: Optional[str] = None, cover_image_path: Optional[str] = None) -> str:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            project_id = str(uuid.uuid4())
            now = time.time()
            cursor.execute("""
                INSERT INTO projects (id, name, series, author, cover_image_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (project_id, name, series, author, cover_image_path, now, now))
            conn.commit()
            return project_id

def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

def list_projects() -> List[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects ORDER BY updated_at DESC")
            return [dict(row) for row in cursor.fetchall()]

def update_project(project_id: str, **updates) -> bool:
    if not updates:
        return True

    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            updates['updated_at'] = time.time()
            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            values = list(updates.values())
            values.append(project_id)

            cursor.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return cursor.rowcount > 0

def delete_project(project_id: str) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = ON;")
            cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            return cursor.rowcount > 0

# --- Chapter Functions ---
def create_chapter(project_id: str, title: str, text_content: str = "", sort_order: int = 0) -> str:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            chapter_id = str(uuid.uuid4())
            now = time.time()

            # Calculate counts
            char_count = len(text_content)
            word_count = len(text_content.split())

            # Simple assumption: 16 chars per second for speech
            predicted_audio_length = char_count / 16.7

            cursor.execute("""
                INSERT INTO chapters (id, project_id, title, text_content, sort_order, text_last_modified, char_count, word_count, predicted_audio_length)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (chapter_id, project_id, title, text_content, sort_order, now, char_count, word_count, predicted_audio_length))
            conn.commit()
            return chapter_id

def get_chapter(chapter_id: str) -> Optional[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,))
            row = cursor.fetchone()
            if row: return dict(row)
            return None

def list_chapters(project_id: str) -> List[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM chapters WHERE project_id = ? ORDER BY sort_order ASC", (project_id,))
            return [dict(row) for row in cursor.fetchall()]

def update_chapter(chapter_id: str, **updates) -> bool:
    if not updates: return True

    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()

            if 'text_content' in updates:
                text = updates['text_content']
                updates['text_last_modified'] = time.time()
                updates['char_count'] = len(text)
                updates['word_count'] = len(text.split())
                updates['predicted_audio_length'] = len(text) / 16.7

            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            values = list(updates.values())
            values.append(chapter_id)

            cursor.execute(f"UPDATE chapters SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return cursor.rowcount > 0

def delete_chapter(chapter_id: str) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = ON;")
            cursor.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
            conn.commit()
            return cursor.rowcount > 0

def reorder_chapters(project_id: str, chapter_ids: List[str]) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("BEGIN TRANSACTION")
            try:
                for idx, cid in enumerate(chapter_ids):
                    cursor.execute("UPDATE chapters SET sort_order = ? WHERE id = ? AND project_id = ?", (idx, cid, project_id))
                conn.commit()
                return True
            except:
                conn.rollback()
                return False

# Init the DB structurally when module is loaded
init_db()

def migrate_state_json_to_db():
    state_file = BASE_DIR / "state.json"
    if not state_file.exists():
        return

    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            # Check if we already migrated
            cursor.execute("SELECT COUNT(*) FROM projects")
            count = cursor.fetchone()[0]
            if count > 0:
                return # Already data in DB, assume migrated

            try:
                raw = state_file.read_text(encoding="utf-8", errors="replace").strip()
                if not raw: return
                state_data = json.loads(raw)
            except Exception as e:
                print(f"Error loading state.json for migration: {e}")
                return

            jobs = state_data.get("jobs", {})
            if not jobs:
                return

            # Create a "Default Project"
            project_id = str(uuid.uuid4())
            now = time.time()
            cursor.execute("""
                INSERT INTO projects (id, name, series, author, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (project_id, "Imported Project", "Legacy Data", None, now, now))

            # Loop jobs and insert chapters
            for jid, jdata in jobs.items():
                chap_id = str(uuid.uuid4())
                audio_status = 'unprocessed'
                if jdata.get("status") == "done": audio_status = 'done'
                elif jdata.get("status") in ["queued", "running"]: audio_status = 'processing'

                cursor.execute("""
                    INSERT INTO chapters (id, project_id, title, sort_order, audio_status, audio_file_path, text_last_modified, predicted_audio_length)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    chap_id, 
                    project_id, 
                    jdata.get("custom_title") or jdata.get("chapter_file", "Unknown Chapter"), 
                    0, 
                    audio_status, 
                    jdata.get("output_mp3") or jdata.get("output_wav"),
                    now,
                    jdata.get("eta_seconds", 0)
                ))
            conn.commit()
            print("Successfully migrated legacy state.json jobs into the database.")

migrate_state_json_to_db()
