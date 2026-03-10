import sqlite3
import time
import uuid
import json
import os
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional

# Use a connection pool or a single connection with a lock
_db_lock = threading.Lock()
DB_PATH = Path(os.getenv("DB_PATH", "audiobook_studio.db"))

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    from .core import _db_lock, get_connection
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
                    created_at REAL,
                    updated_at REAL
                )
            """)

            # Chapters table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chapters (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    text_content TEXT,
                    sort_order INTEGER,
                    audio_status TEXT DEFAULT 'unprocessed',
                    audio_file_path TEXT,
                    audio_generated_at REAL,
                    audio_length_seconds REAL,
                    text_last_modified REAL,
                    predicted_audio_length REAL,
                    char_count INTEGER,
                    word_count INTEGER,
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            """)

            # Processing Queue table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS processing_queue (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    chapter_id TEXT,
                    split_part INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'queued',
                    created_at REAL,
                    started_at REAL,
                    completed_at REAL,
                    FOREIGN KEY (project_id) REFERENCES projects (id),
                    FOREIGN KEY (chapter_id) REFERENCES chapters (id)
                )
            """)

            # Characters table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS characters (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    speaker_profile_name TEXT,
                    default_emotion TEXT,
                    color TEXT DEFAULT '#8b5cf6',
                    FOREIGN KEY (project_id) REFERENCES projects (id)
                )
            """)

            # Chapter Segments table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chapter_segments (
                    id TEXT PRIMARY KEY,
                    chapter_id TEXT NOT NULL,
                    segment_order INTEGER NOT NULL,
                    text_content TEXT NOT NULL,
                    sanitized_text TEXT,
                    character_id TEXT,
                    speaker_profile_name TEXT,
                    audio_file_path TEXT,
                    audio_status TEXT DEFAULT 'unprocessed',
                    audio_generated_at REAL,
                    FOREIGN KEY (chapter_id) REFERENCES chapters (id),
                    FOREIGN KEY (character_id) REFERENCES characters (id)
                )
            """)

            # Speakers table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS speakers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    default_profile_name TEXT,
                    created_at REAL,
                    updated_at REAL
                )
            """)

            # Migrations
            try:
                cursor.execute("ALTER TABLE chapter_segments ADD COLUMN speaker_profile_name TEXT")
            except: pass
            try:
                cursor.execute("ALTER TABLE chapter_segments ADD COLUMN sanitized_text TEXT")
            except: pass
            try:
                cursor.execute("ALTER TABLE processing_queue ADD COLUMN started_at REAL")
            except: pass
            try:
                cursor.execute("ALTER TABLE processing_queue ADD COLUMN completed_at REAL")
            except: pass
            try:
                cursor.execute("ALTER TABLE processing_queue ADD COLUMN custom_title TEXT")
            except: pass
            try:
                cursor.execute("ALTER TABLE processing_queue ADD COLUMN engine TEXT")
            except: pass

            # Migration: Ensure project_id and chapter_id allow NULLs for system tasks
            try:
                cursor.execute("PRAGMA table_info(processing_queue)")
                columns = cursor.fetchall()
                needs_migration = False
                for col in columns:
                    if col[1] == 'project_id' and col[3] == 1: # NOT NULL flag
                        needs_migration = True
                        break

                if needs_migration:
                    print("Migrating processing_queue to remove NOT NULL constraints...")
                    cursor.execute("BEGIN TRANSACTION")
                    cursor.execute("ALTER TABLE processing_queue RENAME TO _processing_queue_old")
                    cursor.execute("""
                        CREATE TABLE processing_queue (
                            id TEXT PRIMARY KEY,
                            project_id TEXT,
                            chapter_id TEXT,
                            split_part INTEGER DEFAULT 0,
                            status TEXT DEFAULT 'queued',
                            created_at REAL,
                            started_at REAL,
                            completed_at REAL,
                            custom_title TEXT,
                            engine TEXT,
                            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
                            FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
                        )
                    """)
                    cursor.execute("""
                        INSERT INTO processing_queue (id, project_id, chapter_id, split_part, status, created_at, started_at, completed_at, custom_title, engine)
                        SELECT id, project_id, chapter_id, split_part, status, created_at, started_at, completed_at, custom_title, NULL
                        FROM _processing_queue_old
                    """)
                    cursor.execute("DROP TABLE _processing_queue_old")
            except Exception as e:
                print(f"Failed to migrate processing_queue NULL constraints: {e}")

            conn.commit()
