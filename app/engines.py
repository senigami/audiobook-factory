import shlex, subprocess, os, re, hashlib
from pathlib import Path
from typing import Tuple, List, Optional

from .config import XTTS_ENV_ACTIVATE, NARRATOR_WAV, MP3_QUALITY, BASE_DIR
from .textops import safe_split_long_sentences, sanitize_for_xtts, pack_text_to_limit

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

def xtts_generate(text: str, out_wav: Path, safe_mode: bool, on_output, cancel_check, speaker_wav: str = None, speed: float = 1.0) -> int:
    if not XTTS_ENV_ACTIVATE.exists():
        on_output(f"[error] XTTS activate not found: {XTTS_ENV_ACTIVATE}\n")
        return 1
    
    # Use provided speaker_wav or fallback to global NARRATOR_WAV
    sw = speaker_wav or str(NARRATOR_WAV)
    
    if not sw:
        on_output(f"[error] no narrator wav or speaker profile provided\n")
        return 1

    if safe_mode:
        text = sanitize_for_xtts(text)
        text = safe_split_long_sentences(text)
    else:
        # Raw mode: Absolute bare minimum to prevent speech engine crashes
        text = re.sub(r'[^\x00-\x7F]+', '', text) # ASCII only
        text = text.strip()
    
    text = pack_text_to_limit(text, pad=True)

    cmd = (
        f"export PYTHONUNBUFFERED=1 && source {shlex.quote(str(XTTS_ENV_ACTIVATE))} && "
        f"python3 {shlex.quote(str(BASE_DIR / 'app' / 'xtts_inference.py'))} "
        f"--text {shlex.quote(text)} "
        f"--speaker_wav {shlex.quote(sw)} "
        f"--language en "
        f"--repetition_penalty 2.0 "
        f"--speed {speed} "
        f"--out_path {shlex.quote(str(out_wav))}"
    )
    return run_cmd_stream(cmd, on_output, cancel_check)


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

def get_speaker_latent_path(speaker_wavs_str: str) -> Optional[Path]:
    """Computes the same latent path as xtts_inference.py."""
    if not speaker_wavs_str:
        return None
        
    if "," in speaker_wavs_str:
        wavs = [s.strip() for s in speaker_wavs_str.split(",") if s.strip()]
        combined_paths = "|".join(sorted([os.path.abspath(p) for p in wavs]))
    else:
        combined_paths = os.path.abspath(speaker_wavs_str)
        
    speaker_id = hashlib.md5(combined_paths.encode()).hexdigest()
    voice_dir = Path(os.path.expanduser("~/.cache/audiobook-factory/voices"))
    return voice_dir / f"{speaker_id}.pth"

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