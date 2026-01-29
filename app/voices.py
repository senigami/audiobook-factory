from pathlib import Path
from typing import List, Tuple
from .config import VOICES_DIR

def list_piper_voices() -> List[str]:
    voices = []
    for onnx in sorted(VOICES_DIR.glob("*.onnx")):
        cfg = onnx.with_suffix(".onnx.json")
        if cfg.exists():
            voices.append(onnx.stem)
    return voices

def piper_voice_paths(voice_name: str) -> Tuple[Path, Path]:
    model = VOICES_DIR / f"{voice_name}.onnx"
    cfg = VOICES_DIR / f"{voice_name}.onnx.json"
    return model, cfg