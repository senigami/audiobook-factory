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
    parser.add_argument("--text", help="Text to synthesize (ignored if --script_json is provided)")
    parser.add_argument("--speaker_wav", help="Path to reference speaker wav(s). (ignored if --script_json is provided)")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--out_path", required=True, help="Output wav path")
    parser.add_argument("--repetition_penalty", type=float, default=2.0, help="Repetition penalty")
    parser.add_argument("--temperature", type=float, default=0.75, help="Temperature")
    parser.add_argument("--speed", type=float, default=1.0, help="Speaking speed (1.0 = normal)")
    parser.add_argument("--script_json", help="Path to a JSON file containing segments: list of {'text', 'speaker_wav'}")

    args = parser.parse_args()

    import json
    script = []
    if args.script_json:
        if not os.path.exists(args.script_json):
            print(f"[error] Script JSON not found: {args.script_json}", file=sys.stderr)
            sys.exit(1)
        with open(args.script_json, 'r') as f:
            script = json.load(f)
    else:
        if not args.text or not args.speaker_wav:
            print("[error] Either --text and --speaker_wav OR --script_json MUST be provided.", file=sys.stderr)
            sys.exit(1)
        script = [{"text": args.text, "speaker_wav": args.speaker_wav}]

    # Voice Caching setup helper
    import hashlib
    voice_dir = os.path.expanduser("~/.cache/audiobook-factory/voices")
    os.makedirs(voice_dir, exist_ok=True)

    def get_latents(speaker_wav_paths, device, tts_model):
        if isinstance(speaker_wav_paths, list):
            combined_paths = "|".join(sorted([os.path.abspath(p) for p in speaker_wav_paths]))
        else:
            combined_paths = os.path.abspath(speaker_wav_paths)

        speaker_id = hashlib.md5(combined_paths.encode()).hexdigest()
        latent_file = os.path.join(voice_dir, f"{speaker_id}.pth")

        if os.path.exists(latent_file):
            print(f"Loading cached latents for {speaker_id}...", file=sys.stderr)
            latents = torch.load(latent_file, map_location=device, weights_only=False)
            return latents["gpt_cond_latent"], latents["speaker_embedding"]
        else:
            print(f"Computing latents for {speaker_id}...", file=sys.stderr)
            # Handle comma-separated list if passed as string
            wav_input = speaker_wav_paths
            if isinstance(wav_input, str) and "," in wav_input:
                wav_input = [s.strip() for s in wav_input.split(",") if s.strip()]

            gpt_cond_latent, speaker_embedding = tts_model.get_conditioning_latents(audio_path=wav_input)
            torch.save({
                "gpt_cond_latent": gpt_cond_latent,
                "speaker_embedding": speaker_embedding
            }, latent_file)
            return gpt_cond_latent, speaker_embedding

    # Load model (quietly)
    print("Loading XTTS model...", file=sys.stderr)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    original_stderr = sys.stderr
    try:
        from TTS.api import TTS
        # We'll use tts() as a thin wrapper but access the internal xtts_model for speed/control
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True).to(device)
        xtts_model = tts.synthesizer.tts_model
    finally:
        sys.stderr = original_stderr

    # Pre-cache/Pre-load latents for all unique speakers in the script
    unique_speakers = list(set(s['speaker_wav'] for s in script))
    speaker_latents = {}
    for sw in unique_speakers:
        try:
            speaker_latents[sw] = get_latents(sw, device, xtts_model)
        except Exception as e:
            print(f"Warning: Failed to compute latents for {sw}: {e}", file=sys.stderr)
            speaker_latents[sw] = None

    print(f"Synthesizing script with {len(script)} segments to {args.out_path}...", file=sys.stderr)

    try:
        from tqdm import tqdm
        all_wav_chunks = []

        with tqdm(total=len(script), unit="seg", desc="Synthesizing", file=sys.stderr) as pbar:
            for i, segment in enumerate(script):
                text = segment['text']
                sw = segment['speaker_wav']
                latents = speaker_latents.get(sw)

                # Each segment might need internal sentence splitting if it's long
                # but for simplicity we'll let the user handle splits in chapter builder.
                # However, to be safe, we'll still split text into manageable bits.
                if hasattr(tts, 'synthesizer') and hasattr(tts.synthesizer, 'split_into_sentences'):
                    sentences = tts.synthesizer.split_into_sentences(text)
                elif hasattr(tts, 'tts_tokenizer'):
                    sentences = tts.tts_tokenizer.split_sentences(text)
                else:
                    sentences = [text]

                for sentence in sentences:
                    if latents:
                        gpt_cond_latent, speaker_embedding = latents
                        out_dict = xtts_model.inference(
                            text=sentence,
                            language=args.language,
                            gpt_cond_latent=gpt_cond_latent,
                            speaker_embedding=speaker_embedding,
                            temperature=args.temperature,
                            speed=args.speed,
                            repetition_penalty=args.repetition_penalty
                        )
                        wav_chunk = out_dict['wav']
                    else:
                        # Fallback
                        wav_chunk = tts.synthesizer.tts(
                            text=sentence,
                            speaker_wav=sw,
                            language_name=args.language,
                            speed=args.speed,
                            repetition_penalty=args.repetition_penalty,
                            temperature=args.temperature
                        )
                    all_wav_chunks.append(torch.FloatTensor(wav_chunk))

                pbar.update(1)

        if all_wav_chunks:
            final_wav = torch.cat(all_wav_chunks, dim=0)
            torchaudio.save(args.out_path, final_wav.unsqueeze(0), 24000)
            print(f"Successfully synthesized {len(script)} segments.", file=sys.stderr)

    except Exception as e:
        print(f"\n[CRITICAL ERROR] XTTS failed: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
