import os
import subprocess
from pathlib import Path
from .core import _db_lock, get_connection

def reconcile_project_audio(project_id: str):
    """
    Scans the project's audio directory and updates the database if audio files exist 
    but the chapter status is not 'done'.
    """
    from ..config import get_project_audio_dir
    audio_dir = get_project_audio_dir(project_id)
    if not audio_dir.exists():
        return

    with _db_lock:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, audio_status, audio_length_seconds FROM chapters WHERE project_id = ?", (project_id,))
            chapters = cursor.fetchall()

            for chap in chapters:
                cid, status, length = chap
                stem = cid
                wav_file = audio_dir / f"{stem}.wav"
                mp3_file = audio_dir / f"{stem}.mp3"

                found_path = None
                if mp3_file.exists():
                    found_path = mp3_file.name
                elif wav_file.exists():
                    found_path = wav_file.name

                if found_path:
                    duration = length or 0.0
                    if duration == 0.0:
                        try:
                            result = subprocess.run(
                                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_dir / found_path)],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                text=True,
                                timeout=2
                            )
                            if result.returncode == 0:
                                duration = float(result.stdout.strip())
                        except: pass

                    cursor.execute(
                        "UPDATE chapters SET audio_status = 'done', audio_file_path = ?, audio_length_seconds = ? WHERE id = ?", 
                        (found_path, duration, cid)
                    )
                elif status == 'done':
                    if not wav_file.exists() and not mp3_file.exists():
                        cursor.execute(
                            "UPDATE chapters SET audio_status = 'unprocessed', audio_file_path = NULL, audio_length_seconds = NULL WHERE id = ?", 
                            (cid,)
                        )
            conn.commit()

            # Revised approach: Scan the directory and map files to chapters
            files = os.listdir(audio_dir)
            chapter_files = {} # cid -> list of files

            for f in files:
                if not f.endswith(('.mp3', '.wav', '.m4a')):
                    continue
                stem = Path(f).stem
                cid = stem.split('_')[0]
                if cid not in chapter_files:
                    chapter_files[cid] = []
                chapter_files[cid].append(f)

            for cid, f_list in chapter_files.items():
                best_file = f_list[0]
                for f in f_list:
                    if f.endswith('.mp3'):
                        best_file = f
                        break

                cursor.execute("SELECT audio_status, audio_file_path FROM chapters WHERE id = ?", (cid,))
                row = cursor.fetchone()
                if not row:
                    continue

                status, current_path = row
                if status != 'done' or current_path != best_file:
                    audio_path = audio_dir / best_file
                    duration = 0.0
                    try:
                        result = subprocess.run(
                            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True,
                            timeout=2
                        )
                        duration = float(result.stdout.strip())
                    except: pass

                    cursor.execute("""
                        UPDATE chapters 
                        SET audio_status = 'done', audio_file_path = ?, audio_length_seconds = ? 
                        WHERE id = ?
                    """, (best_file, duration, cid))

            conn.commit()
