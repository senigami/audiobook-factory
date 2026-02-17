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
    parser.add_argument("--speed", type=float, default=1.0, help="Speaking speed (1.0 = normal)")
    
    args = parser.parse_args()

    # Handle multiple speaker WAVs (Idiap fork feature)
    # We support comma-separated paths or a single path
    if "," in args.speaker_wav:
        speaker_wavs = [s.strip() for s in args.speaker_wav.split(",") if s.strip()]
    else:
        speaker_wavs = args.speaker_wav

    # Voice Caching setup
    import hashlib
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

    # Compute or load latents manually for the speaker_id
    latent_file = os.path.join(voice_dir, f"{speaker_id}.pth")
    try:
        if os.path.exists(latent_file):
            print(f"Loading cached latents for {speaker_id}...", file=sys.stderr)
            latents = torch.load(latent_file, map_location=device)
            gpt_cond_latent = latents["gpt_cond_latent"]
            speaker_embedding = latents["speaker_embedding"]
        else:
            print(f"Computing latents for {speaker_id}...", file=sys.stderr)
            # Access the model directly to compute latents
            # XTTS model has get_conditioning_latents
            xtts_model = tts.synthesizer.tts_model
            gpt_cond_latent, speaker_embedding = xtts_model.get_conditioning_latents(audio_path=speaker_wavs)
            torch.save({
                "gpt_cond_latent": gpt_cond_latent,
                "speaker_embedding": speaker_embedding
            }, latent_file)
        
        # Inject into the model's speaker manager to avoid KeyError in tts.tts()
        if not hasattr(tts.synthesizer.tts_model, 'speaker_manager'):
            # Some versions might have it nested or different
            pass
        else:
            tts.synthesizer.tts_model.speaker_manager.speakers[speaker_id] = {
                "gpt_cond_latent": gpt_cond_latent,
                "speaker_embedding": speaker_embedding
            }
    except Exception as e:
        print(f"Warning: Latent caching/injection failed: {e}. Falling back to standard processing.", file=sys.stderr)
        speaker_id = None # Fallback to using speaker_wav every time

    print(f"Synthesizing to {args.out_path} at {args.speed}x speed...", file=sys.stderr)
    
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
                if speaker_id:
                    # Call synthesizer directly because tts.tts() named 'speed' argument is not forwarded
                    wav_chunk = tts.synthesizer.tts(
                        text=sentence,
                        speaker_name=speaker_id,
                        language_name=args.language,
                        speed=args.speed,
                        repetition_penalty=args.repetition_penalty,
                        temperature=args.temperature
                    )
                else:
                    wav_chunk = tts.synthesizer.tts(
                        text=sentence,
                        speaker_wav=speaker_wavs,
                        language_name=args.language,
                        speed=args.speed,
                        repetition_penalty=args.repetition_penalty,
                        temperature=args.temperature
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
