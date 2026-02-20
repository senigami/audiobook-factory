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
                    sort_order INTEGER DEFAULT 0,
                    audio_status TEXT DEFAULT 'unprocessed',
                    audio_file_path TEXT,
                    text_last_modified REAL,
                    audio_generated_at REAL,
                    char_count INTEGER DEFAULT 0,
                    word_count INTEGER DEFAULT 0,
                    sent_count INTEGER DEFAULT 0,
                    predicted_audio_length REAL DEFAULT 0.0,
                    audio_length_seconds REAL DEFAULT 0.0,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            """)

            # Migrations
            cursor.execute("PRAGMA table_info(chapters)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'audio_length_seconds' not in columns:
                cursor.execute("ALTER TABLE chapters ADD COLUMN audio_length_seconds REAL DEFAULT 0.0")
            if 'sent_count' not in columns:
                cursor.execute("ALTER TABLE chapters ADD COLUMN sent_count INTEGER DEFAULT 0")

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
            sent_count = text_content.count('.') + text_content.count('?') + text_content.count('!')

            # Simple assumption: 16 chars per second for speech
            predicted_audio_length = char_count / 16.7

            cursor.execute("""
                INSERT INTO chapters (id, project_id, title, text_content, sort_order, text_last_modified, char_count, word_count, sent_count, predicted_audio_length)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (chapter_id, project_id, title, text_content, sort_order, now, char_count, word_count, sent_count, predicted_audio_length))
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
                updates['sent_count'] = text.count('.') + text.count('?') + text.count('!')
                updates['predicted_audio_length'] = len(text) / 16.7

            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            values = list(updates.values())
            values.append(chapter_id)

            cursor.execute(f"UPDATE chapters SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return cursor.rowcount > 0

def delete_chapter(chapter_id: str) -> bool:
    print(f"[DB] Attempting to delete chapter: {chapter_id}")
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            # 1. Get info before deletion
            cursor.execute("SELECT title, project_id, audio_file_path FROM chapters WHERE id = ?", (chapter_id,))
            item = cursor.fetchone()
            if not item:
                print(f"[DB] Chapter {chapter_id} not found for deletion")
                return False

            # 2. Perform deletion (with FK cascade enabled)
            cursor.execute("PRAGMA foreign_keys = ON;")
            cursor.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
            conn.commit()
            success = cursor.rowcount > 0

            if success:
                print(f"[DB] Successfully deleted chapter '{item['title']}' from DB")
                # 3. Physical file cleanup
                if item['audio_file_path']:
                    from .config import get_project_audio_dir, XTTS_OUT_DIR
                    try:
                        pdir = get_project_audio_dir(item['project_id'])
                        base_pth = pdir / item['audio_file_path']
                        base_pth.unlink(missing_ok=True)
                        if base_pth.suffix == '.mp3':
                            base_pth.with_suffix('.wav').unlink(missing_ok=True)
                        else:
                            base_pth.with_suffix('.mp3').unlink(missing_ok=True)
                        print(f"[DB] Cleaned up physical audio files in {pdir}")
                    except Exception as e:
                        print(f"[DB] Error cleaning up audio files: {e}")
            # 4. Verify deletion
            cursor.execute("SELECT 1 FROM chapters WHERE id = ?", (chapter_id,))
            if cursor.fetchone():
                print(f"[DB] CRITICAL: Chapter {chapter_id} still exists after DELETE and COMMIT!")
                return False

            print(f"[DB] Verified chapter {chapter_id} is gone.")
            return True

def reset_chapter_audio(chapter_id: str) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT project_id, audio_file_path FROM chapters WHERE id = ?", (chapter_id,))
            item = cursor.fetchone()
            if item and item['audio_file_path']:
                from .config import get_project_audio_dir
                try:
                    pdir = get_project_audio_dir(item['project_id'])
                    (pdir / item['audio_file_path']).unlink(missing_ok=True)
                    (pdir / item['audio_file_path'].replace(".mp3", ".wav")).unlink(missing_ok=True)
                except: pass

            cursor.execute("""
                UPDATE chapters 
                SET audio_status = 'unprocessed', 
                    audio_file_path = NULL, 
                    audio_length_seconds = 0.0,
                    audio_generated_at = NULL
                WHERE id = ?
            """, (chapter_id,))
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

# --- Processing Queue Functions ---
def add_to_queue(project_id: str, chapter_id: str, split_part: int = 0) -> str:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            queue_id = str(uuid.uuid4())
            now = time.time()
            cursor.execute("""
                INSERT INTO processing_queue (id, project_id, chapter_id, split_part, status, created_at)
                VALUES (?, ?, ?, ?, 'queued', ?)
            """, (queue_id, project_id, chapter_id, split_part, now))

            # Also update chapter status to queued if it's unprocessed or done
            cursor.execute("UPDATE chapters SET audio_status = 'processing' WHERE id = ?", (chapter_id,))
            conn.commit()
            return queue_id

def get_queue() -> List[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT q.*, c.title AS chapter_title, p.name AS project_name 
                FROM processing_queue q
                JOIN chapters c ON q.chapter_id = c.id
                JOIN projects p ON q.project_id = p.id
                ORDER BY 
                    CASE WHEN q.status = 'running' THEN 0 ELSE 1 END,
                    q.created_at ASC
            """)
            return [dict(row) for row in cursor.fetchall()]

def update_queue_item(queue_id: str, status: str, audio_length_seconds: float = 0.0) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            now = time.time()
            if status in ['done', 'failed', 'cancelled']:
                cursor.execute("UPDATE processing_queue SET status = ?, completed_at = ? WHERE id = ?", (status, now, queue_id))
            else:
                cursor.execute("UPDATE processing_queue SET status = ? WHERE id = ?", (status, queue_id))

            # Sync Chapter status and audio path
            cursor.execute("SELECT chapter_id, split_part FROM processing_queue WHERE id = ?", (queue_id,))
            row = cursor.fetchone()
            if row:
                chapter_id, split_part = row
                if status == 'done':
                    # Assuming standard naming output by jobs.py
                    audio_path = f"{chapter_id}_{split_part}.mp3"
                    cursor.execute(
                        "UPDATE chapters SET audio_status = 'done', audio_file_path = ?, audio_generated_at = ?, audio_length_seconds = ? WHERE id = ?", 
                        (audio_path, now, audio_length_seconds, chapter_id)
                    )
                elif status in ['failed', 'error']:
                    cursor.execute("UPDATE chapters SET audio_status = 'error' WHERE id = ?", (chapter_id,))
                elif status == 'running':
                    cursor.execute("UPDATE chapters SET audio_status = 'processing' WHERE id = ?", (chapter_id,))

            conn.commit()
            return cursor.rowcount > 0

def remove_from_queue(queue_id: str) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM processing_queue WHERE id = ?", (queue_id,))
            conn.commit()
            return cursor.rowcount > 0

def reorder_queue(queue_ids: List[str]) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("BEGIN TRANSACTION")
            try:
                # To reorder by created_at, we just space out the created_at times
                # Or we can add a sort_order column to processing_queue.
                # Since we don't have sort_order, we can update created_at to be sequential
                now = time.time()
                for idx, qid in enumerate(queue_ids):
                    cursor.execute("UPDATE processing_queue SET created_at = ? WHERE id = ?", (now + idx, qid))
                conn.commit()
                return True
            except:
                conn.rollback()
                return False

def clear_queue() -> int:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM processing_queue WHERE status = 'queued'")
            conn.commit()
            return cursor.rowcount

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
