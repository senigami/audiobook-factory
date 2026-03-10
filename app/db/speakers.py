import time
import uuid
from typing import List, Dict, Any, Optional
from .core import _db_lock, get_connection

def create_speaker(name: str, default_profile_name: Optional[str] = None) -> str:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            speaker_id = str(uuid.uuid4())
            now = time.time()
            cursor.execute("""
                INSERT INTO speakers (id, name, default_profile_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (speaker_id, name, default_profile_name, now, now))
            conn.commit()
            return speaker_id

def get_speaker(speaker_id: str) -> Optional[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM speakers WHERE id = ?", (speaker_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

def list_speakers() -> List[Dict[str, Any]]:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM speakers ORDER BY name ASC")
            return [dict(row) for row in cursor.fetchall()]

def update_speaker(speaker_id: str, **updates) -> bool:
    if not updates: return False
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            fields = []
            values = []
            for k, v in updates.items():
                fields.append(f"{k} = ?")
                values.append(v)
            fields.append("updated_at = ?")
            values.append(time.time())
            values.append(speaker_id)
            cursor.execute(f"UPDATE speakers SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()
            return cursor.rowcount > 0

def delete_speaker(speaker_id: str) -> bool:
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM speakers WHERE id = ?", (speaker_id,))
            conn.commit()
            return cursor.rowcount > 0

def update_voice_profile_references(old_name: str, new_name: str):
    """Updates all references to a voice profile name in the database."""
    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            # 1. Update characters table
            cursor.execute("UPDATE characters SET speaker_profile_name = ? WHERE speaker_profile_name = ?", (new_name, old_name))
            # 2. Update chapter_segments table
            cursor.execute("UPDATE chapter_segments SET speaker_profile_name = ? WHERE speaker_profile_name = ?", (new_name, old_name))
            conn.commit()
