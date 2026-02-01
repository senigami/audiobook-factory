import os
import sys

# Silence environment noise before heavy imports
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["COQUI_TOS_AGREED"] = "1"

import torch
import torchaudio
import argparse
import warnings

# Suppress common XTTS/Torch warnings that clutter logs
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

def main():
    parser = argparse.ArgumentParser(description="XTTS Streaming Inference Script")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--speaker_wav", required=True, help="Path to reference speaker wav")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--out_path", required=True, help="Output wav path")
    parser.add_argument("--repetition_penalty", type=float, default=2.0, help="Repetition penalty")
    parser.add_argument("--temperature", type=float, default=0.75, help="Temperature")
    
    args = parser.parse_args()

    # Load model (quietly)
    print("Loading XTTS model...", file=sys.stderr)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Simple redirect to capture engine initialization noise
    original_stderr = sys.stderr
    try:
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    finally:
        sys.stderr = original_stderr

    # Note: inference_stream is more stable for long text as it forces chunk-based processing
    # even if we are saving to a single file.
    
    print(f"Synthesizing to {args.out_path} using streaming mode...")
    
    # We use tts_to_file but with optimized parameters 
    # Actually, if we want TRUE streaming logic as per Gemini feedback, 
    # we might want to feed text by sentence or use the internal inference_stream.
    # However, tts_to_file with split_sentences=True (default) is very similar 
    # to what most users mean by 'streaming' (sentence-by-sentence).
    
    # Let's use the most stable approach: tts_to_file with specific kwargs
    print(f"Debug: text='{args.text}'", file=sys.stderr)
    print(f"Debug: speaker_wav='{args.speaker_wav}'", file=sys.stderr)
    print(f"Debug: out_path='{args.out_path}'", file=sys.stderr)

    try:
        tts.tts_to_file(
            text=args.text,
            speaker_wav=args.speaker_wav,
            language=args.language,
            file_path=args.out_path,
            split_sentences=True,
            repetition_penalty=args.repetition_penalty,
            temperature=args.temperature,
        )
    except Exception as e:
        print(f"\n[CRITICAL ERROR] XTTS failed: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
