import shlex, subprocess
from pathlib import Path
from typing import Tuple

from .config import XTTS_ENV_ACTIVATE, PIPER_ENV_ACTIVATE, NARRATOR_WAV, MP3_QUALITY
from .textops import safe_split_long_sentences
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
    proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    _active_processes.add(proc)
    try:
        while True:
            if cancel_check():
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                return 1

            line = proc.stdout.readline() if proc.stdout else ""
            if line:
                on_output(line)

            if proc.poll() is not None:
                rest = proc.stdout.read() if proc.stdout else ""
                if rest:
                    on_output(rest)
                return proc.returncode or 0
    finally:
        if proc in _active_processes:
            _active_processes.remove(proc)

def wav_to_mp3(in_wav: Path, out_mp3: Path, on_output=None, cancel_check=None) -> int:
    def noop(*args): pass
    if on_output is None: on_output = noop
    if cancel_check is None: cancel_check = lambda: False

    cmd = f'ffmpeg -y -i {shlex.quote(str(in_wav))} -codec:a libmp3lame -q:a {shlex.quote(MP3_QUALITY)} {shlex.quote(str(out_mp3))}'
    return run_cmd_stream(cmd, on_output, cancel_check)

def xtts_generate(text: str, out_wav: Path, safe_mode: bool, on_output, cancel_check) -> int:
    from .textops import clean_text_for_tts
    text = clean_text_for_tts(text)
    if not XTTS_ENV_ACTIVATE.exists():
        on_output(f"[error] XTTS activate not found: {XTTS_ENV_ACTIVATE}\n")
        return 1
    if not NARRATOR_WAV.exists():
        on_output(f"[error] narrator wav missing: {NARRATOR_WAV}\n")
        return 1

    if safe_mode:
        text = safe_split_long_sentences(text)

    # Preserve double-newlines (paragraphs) but normalize single newlines/spaces
    # and escape double quotes for the shell command.
    safe_text = text.replace('"', '\\"')

    cmd = (
        f"export PYTHONUNBUFFERED=1 && source {shlex.quote(str(XTTS_ENV_ACTIVATE))} && "
        f"tts --model_name tts_models/multilingual/multi-dataset/xtts_v2 "
        f'--text "{safe_text}" '
        f"--speaker_wav {shlex.quote(str(NARRATOR_WAV))} "
        f"--language_idx en "
        f"--out_path {shlex.quote(str(out_wav))}"
    )
    return run_cmd_stream(cmd, on_output, cancel_check)

def piper_generate(chapter_file: Path, voice_name: str, out_wav: Path, on_output, cancel_check) -> int:
    from .textops import clean_text_for_tts
    # For Piper, we read the file and clean it before writing to a temp location if needed,
    # but since piper reads from file, let's just clean the text if we were reading it.
    # Actually, piper --input_file is convenient. Let's stick to cleaning in memory for XTTS
    # and maybe leave Piper alone unless it's a big issue, or clean it then write to a tmp file.
    # To keep it simple and consistent:
    text = chapter_file.read_text(encoding="utf-8", errors="replace")
    text = clean_text_for_tts(text)
    
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
        f"--input_file {shlex.quote(str(chapter_file))} --output_file {shlex.quote(str(out_wav))}"
    )
    return run_cmd_stream(cmd, on_output, cancel_check)