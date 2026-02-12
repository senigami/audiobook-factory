import shlex, subprocess, os, re
from pathlib import Path
from typing import Tuple, List, Optional

from .config import (
    XTTS_ENV_ACTIVATE, PIPER_ENV_ACTIVATE, NARRATOR_WAV, MP3_QUALITY, BASE_DIR,
    XTTS_V2_MODEL, BARK_MODEL, TORTOISE_MODEL
)
from .textops import safe_split_long_sentences, sanitize_for_xtts, pack_text_to_limit
from .voices import piper_voice_paths

_active_processes = set()

def terminate_all_subprocesses():
    for proc in list(_active_processes):
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    _active_processes.clear()

def run_cmd_stream(cmd: str, on_output, cancel_check) -> int:
    import time, selectors
    proc = subprocess.Popen(
        cmd, shell=True, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        text=True,
        bufsize=0 # Unbuffered
    )
    _active_processes.add(proc)
    
    sel = selectors.DefaultSelector()
    sel.register(proc.stdout, selectors.EVENT_READ)
    
    buffer = ""
    last_heartbeat = time.time()
    
    try:
        while True:
            if cancel_check():
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                return 1

            # Check for output with a timeout to allow heartbeats
            events = sel.select(timeout=0.1)
            if events:
                char = proc.stdout.read(1)
                if char:
                    buffer += char
                    if char in ('\n', '\r'):
                        on_output(buffer)
                        buffer = ""
                        last_heartbeat = time.time() # Activity is a heartbeat
                else:
                    # EOF
                    if proc.poll() is not None:
                        break
            else:
                # No data: period check for heartbeat or process exit
                if time.time() - last_heartbeat >= 1.0:
                    on_output("") # Send empty tick to run_cmd_stream caller
                    last_heartbeat = time.time()
                
                if proc.poll() is not None:
                    break
        
        # Final flush
        if buffer:
            on_output(buffer)
        
        # Consume any remaining output
        rest = proc.stdout.read()
        if rest:
            on_output(rest)
            
        return proc.returncode or 0
    finally:
        sel.close()
        if proc in _active_processes:
            _active_processes.remove(proc)

def wav_to_mp3(in_wav: Path, out_mp3: Path, on_output=None, cancel_check=None) -> int:
    def noop(*args): pass
    if on_output is None: on_output = noop
    if cancel_check is None: cancel_check = lambda: False

    cmd = f'ffmpeg -y -i {shlex.quote(str(in_wav))} -codec:a libmp3lame -q:a {shlex.quote(MP3_QUALITY)} {shlex.quote(str(out_mp3))}'
    return run_cmd_stream(cmd, on_output, cancel_check)

def coqui_generate(text: str, model_name: str, out_wav: Path, safe_mode: bool, on_output, cancel_check, voice: str = None) -> int:
    if not XTTS_ENV_ACTIVATE.exists():
        on_output(f"[error] Coqui TTS environment activate not found: {XTTS_ENV_ACTIVATE}\n")
        return 1
    
    # Narrator wav is only strictly required for XTTS-style cloning, 
    # but the script handles it being optional/required based on model.

    if safe_mode:
        text = sanitize_for_xtts(text)
        text = safe_split_long_sentences(text)
    else:
        # Raw mode: Absolute bare minimum to prevent speech engine crashes
        text = re.sub(r'[^\x00-\x7F]+', '', text) # ASCII only
        text = text.strip()
    
    text = pack_text_to_limit(text, pad=True)

    # Handle default voices for consistency if not provided
    if not voice:
        if "bark" in model_name.lower():
            voice = "v2/en_speaker_6" # A known stable English male voice
        elif "tortoise" in model_name.lower():
            voice = "random"

    cmd_parts = [
        f"export PYTHONUNBUFFERED=1 && source {shlex.quote(str(XTTS_ENV_ACTIVATE))} && ",
        f"python3 {shlex.quote(str(BASE_DIR / 'app' / 'tts_inference.py'))} ",
        f"--model_name {shlex.quote(model_name)} ",
        f"--text {shlex.quote(text)} ",
        f"--speaker_wav {shlex.quote(str(NARRATOR_WAV))} ",
        f"--language en ",
        f"--repetition_penalty 2.0 ",
        f"--out_path {shlex.quote(str(out_wav))}"
    ]
    if voice:
        cmd_parts.append(f" --speaker_id {shlex.quote(voice)}")

    cmd = "".join(cmd_parts)
    return run_cmd_stream(cmd, on_output, cancel_check)

def xtts_generate(text: str, out_wav: Path, safe_mode: bool, on_output, cancel_check) -> int:
    """Legacy wrapper for XTTS v2 style generation."""
    return coqui_generate(text, XTTS_V2_MODEL, out_wav, safe_mode, on_output, cancel_check)

def piper_generate(chapter_file: Path, voice_name: str, out_wav: Path, safe_mode: bool, on_output, cancel_check) -> int:
    from .textops import clean_text_for_tts
    # For Piper, we read the file and clean it before writing to a temp location
    text = chapter_file.read_text(encoding="utf-8", errors="replace")
    if safe_mode:
        text = clean_text_for_tts(text)
    else:
        text = re.sub(r'[^\x00-\x7F]+', '', text).strip()
    
    tmp_path = chapter_file.with_suffix(".tmp.txt")
    tmp_path.write_text(text, encoding="utf-8")
    
    model, cfg = piper_voice_paths(voice_name)
    if not model.exists() or not cfg.exists():
        on_output(f"[error] Missing Piper voice files: {model} / {cfg}\n")
        return 1

    prefix = f"source {shlex.quote(str(PIPER_ENV_ACTIVATE))} && " if PIPER_ENV_ACTIVATE.exists() else ""
    cmd = (
        prefix +
        f"piper --model {shlex.quote(str(model))} --config {shlex.quote(str(cfg))} "
        f"--input_file {shlex.quote(str(tmp_path))} --output_file {shlex.quote(str(out_wav))}"
    )
    rc = run_cmd_stream(cmd, on_output, cancel_check)
    if tmp_path.exists():
        tmp_path.unlink()
    return rc

def get_audio_duration(file_path: Path) -> float:
    """Uses ffprobe to get the duration of an audio file in seconds."""
    cmd = [
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', str(file_path)
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        return float(result.stdout.strip())
    except Exception:
        return 0.0

def assemble_audiobook(
    input_folder: Path, 
    book_title: str, 
    output_m4b: Path, 
    on_output, 
    cancel_check, 
    chapter_titles: dict = None,
    author: str = None,
    narrator: str = None,
    chapters: List[dict] = None # List of {filename, title}
):
    # 1. Gather files
    if chapters:
        # Use provided list from interaction
        files = [c['filename'] for c in chapters]
        final_titles = {c['filename']: c['title'] for c in chapters}
    else:
        all_files = [f for f in os.listdir(input_folder) if f.endswith(('.wav', '.mp3'))]
        # Group by stem, prioritizing mp3
        chapters_found = {}
        for f in all_files:
            stem = Path(f).stem
            ext = Path(f).suffix.lower()
            if stem not in chapters_found or ext == '.mp3':
                chapters_found[stem] = f

        def extract_number(filename):
            match = re.search(r'(\d+)', filename)
            return int(match.group(1)) if match else 0

        sorted_stems = sorted(chapters_found.keys(), key=lambda x: extract_number(x))
        files = [chapters_found[s] for s in sorted_stems]
        final_titles = {} # will use chapter_titles logic below

    if not files:
        on_output("No audio files found to combine.\n")
        return 1

    # 2. Build Metadata and Concat List
    metadata_file = output_m4b.with_suffix(".metadata.txt")
    list_file = output_m4b.with_suffix(".list.txt")
    
    metadata = ";FFMETADATA1\n"
    metadata += f"title={shlex.quote(book_title)}\n"
    if author:
        metadata += f"artist={shlex.quote(author)}\n"
    if narrator:
        metadata += f"comment={shlex.quote(narrator)}\n"
    metadata += "\n"
    
    current_offset = 0.0
    
    try:
        with open(list_file, 'w') as lf:
            for f in files:
                file_path = input_folder / f
                duration = get_audio_duration(file_path)
                
                lf.write(f"file '{file_path}'\n")
                
                start_ms = int(current_offset * 1000)
                end_ms = int((current_offset + duration) * 1000)
                
                # Use custom title if provided, else use stem
                stem = Path(f).stem
                if f in final_titles:
                    display_name = final_titles[f]
                elif chapter_titles:
                    display_name = chapter_titles.get(stem + ".txt") or chapter_titles.get(stem) or stem
                else:
                    display_name = stem

                metadata += "[CHAPTER]\nTIMEBASE=1/1000\n"
                metadata += f"START={start_ms}\n"
                metadata += f"END={end_ms}\n"
                metadata += f"title={shlex.quote(display_name)}\n\n"
                
                current_offset += duration

        metadata_file.write_text(metadata, encoding="utf-8")

        # 3. Run FFmpeg
        on_output(f"Assembling audiobook: {book_title}\n")
        on_output(f"Combining {len(files)} files into {output_m4b.name}...\n")
        
        cmd = (
            f"ffmpeg -y -f concat -safe 0 -i {shlex.quote(str(list_file))} "
            f"-i {shlex.quote(str(metadata_file))} -map_metadata 1 "
            f"-c:a aac -b:a 32k -ac 1 -movflags +faststart {shlex.quote(str(output_m4b))}"
        )
        
        rc = run_cmd_stream(cmd, on_output, cancel_check)
        
        return rc
    finally:
        # Cleanup
        if list_file.exists(): list_file.unlink()
        if metadata_file.exists(): metadata_file.unlink()