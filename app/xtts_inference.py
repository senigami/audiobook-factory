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
    parser.add_argument("--speaker_wav", required=True, help="Path to reference speaker wav(s). Can be a single path or a comma-separated list.")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--out_path", required=True, help="Output wav path")
    parser.add_argument("--repetition_penalty", type=float, default=2.0, help="Repetition penalty")
    parser.add_argument("--temperature", type=float, default=0.75, help="Temperature")
    
    args = parser.parse_args()

    # Handle multiple speaker WAVs (Idiap fork feature)
    # We support comma-separated paths or a single path
    if "," in args.speaker_wav:
        speaker_wavs = [s.strip() for s in args.speaker_wav.split(",") if s.strip()]
    else:
        speaker_wavs = args.speaker_wav

    # Voice Caching setup
    import hashlib
    # We use a hash of the combined absolute paths to identify the speaker profile
    if isinstance(speaker_wavs, list):
        combined_paths = "|".join(sorted([os.path.abspath(p) for p in speaker_wavs]))
    else:
        combined_paths = os.path.abspath(speaker_wavs)
        
    speaker_id = hashlib.md5(combined_paths.encode()).hexdigest()
    voice_dir = os.path.expanduser("~/.cache/audiobook-factory/voices")
    os.makedirs(voice_dir, exist_ok=True)

    # Load model (quietly)
    print("Loading XTTS model...", file=sys.stderr)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Simple redirect to capture engine initialization noise
    original_stderr = sys.stderr
    try:
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True).to(device)
    finally:
        sys.stderr = original_stderr

    # Note: inference_stream is more stable for long text as it forces chunk-based processing
    # even if we are saving to a single file.
    
    print(f"Synthesizing to {args.out_path}...", file=sys.stderr)
    
    try:
        from tqdm import tqdm
        
        # Split text into sentences for granular progress
        if hasattr(tts, 'synthesizer') and hasattr(tts.synthesizer, 'split_into_sentences'):
            sentences = tts.synthesizer.split_into_sentences(args.text)
        elif hasattr(tts, 'tts_tokenizer'):
            sentences = tts.tts_tokenizer.split_sentences(args.text)
        else:
            # Fallback if tokenizer not exposed as expected
            sentences = [args.text]
            
        print(f"Total sentences to process: {len(sentences)}", file=sys.stderr)
        
        all_wav_chunks = []
        
        # tqdm progress bar that jobs.py can parse (it looks for "XX%|")
        with tqdm(total=len(sentences), unit="sent", desc="Synthesizing", file=sys.stderr) as pbar:
            for i, sentence in enumerate(sentences):
                # We use tts() which returns a list of floats
                # Passing speaker and voice_dir enables caching of voice latents
                wav_chunk = tts.tts(
                    text=sentence,
                    speaker_wav=speaker_wavs,
                    speaker=speaker_id,
                    voice_dir=voice_dir,
                    language=args.language,
                    repetition_penalty=args.repetition_penalty,
                    temperature=args.temperature,
                )
                all_wav_chunks.append(torch.FloatTensor(wav_chunk))
                pbar.update(1)
        
        if all_wav_chunks:
            # Concatenate all chunks
            final_wav = torch.cat(all_wav_chunks, dim=0)
            # XTTS v2 uses 24kHz sample rate
            torchaudio.save(args.out_path, final_wav.unsqueeze(0), 24000)
            print(f"Effectively synthesized {len(sentences)} sentences.", file=sys.stderr)
        
    except Exception as e:
        print(f"\n[CRITICAL ERROR] XTTS failed: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
