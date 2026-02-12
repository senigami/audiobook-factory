import os
import sys

# Silence environment noise before heavy imports
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["COQUI_TOS_AGREED"] = "1"

# CRITICAL: Force all cache directories to user home to avoid [Errno 30] /root access
home_dir = os.path.expanduser("~")
os.environ["HOME"] = home_dir
os.environ["XDG_CACHE_HOME"] = os.path.join(home_dir, ".cache")
os.environ["XDG_CONFIG_HOME"] = os.path.join(home_dir, ".config")
os.environ["XDG_DATA_HOME"] = os.path.join(home_dir, ".local", "share")
os.environ["HF_HOME"] = os.path.join(home_dir, ".cache", "huggingface")
os.environ["TORCH_HOME"] = os.path.join(home_dir, ".cache", "torch")
os.environ["TTS_HOME"] = os.path.join(home_dir, ".local", "share", "tts")
os.environ["TRANSFORMERS_CACHE"] = os.path.join(home_dir, ".cache", "huggingface", "transformers")
os.environ["NLTK_DATA"] = os.path.join(home_dir, "nltk_data")
# Some libraries check these specifically
os.environ["XDG_RUNTIME_DIR"] = os.path.join(home_dir, ".local", "run")

import nltk
# Ensure NLTK uses the user-space directory
nltk.data.path = [os.environ["NLTK_DATA"]] + nltk.data.path
try:
    # Pre-download punctuations to user space if needed, though they should be there
    nltk.download('punkt', download_dir=os.environ["NLTK_DATA"], quiet=True)
except:
    pass

import torch
import torchaudio
import argparse
import warnings

# Suppress common XTTS/Torch warnings that clutter logs
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

try:
    from TTS.tts.configs.bark_config import BarkConfig
    # Force CACHE_DIR to avoid [Errno 30] /root access
    # Evaluated at class-level at import time, so we must override it here.
    BarkConfig.CACHE_DIR = os.path.join(home_dir, ".local", "share", "tts", "bark_v0")
    # Fix HuggingFace URL - tree links return HTML, resolve links return raw files
    BarkConfig.REMOTE_BASE_URL = "https://huggingface.co/erogol/bark/resolve/main/"
    print(f"DEBUG: Overriding BarkConfig.CACHE_DIR to {BarkConfig.CACHE_DIR}", file=sys.stderr)
    print(f"DEBUG: Overriding BarkConfig.REMOTE_BASE_URL to {BarkConfig.REMOTE_BASE_URL}", file=sys.stderr)
    
    # Also patch load_model's _download to see what's happening
    import TTS.tts.layers.bark.load_model as bark_load_model
    original_download = bark_load_model._download
    def patched_download(from_s3_path, to_local_path, CACHE_DIR):
        # Update the download path if it's still using tree URL
        if "/tree/main/" in from_s3_path:
            from_s3_path = from_s3_path.replace("/tree/main/", "/resolve/main/")
            print(f"DEBUG: Corrected download URL to {from_s3_path}", file=sys.stderr)

        print(f"DEBUG: Bark _download called for {to_local_path}", file=sys.stderr)
        print(f"DEBUG: CACHE_DIR is {CACHE_DIR}", file=sys.stderr)
        # If CACHE_DIR is /root, override it here as a last resort
        if CACHE_DIR.startswith("/root"):
           CACHE_DIR = os.path.join(home_dir, ".local", "share", "tts", "bark_v0")
           os.makedirs(CACHE_DIR, exist_ok=True)
           print(f"DEBUG: Redirected /root cache to {CACHE_DIR}", file=sys.stderr)
        return original_download(from_s3_path, to_local_path, CACHE_DIR)
    bark_load_model._download = patched_download

except Exception as e:
    print(f"DEBUG: Failed to patch BarkConfig or load_model: {e}", file=sys.stderr)

def main():
    parser = argparse.ArgumentParser(description="Multi-Model TTS Inference Script")
    parser.add_argument("--model_name", required=True, help="Model identifier (e.g., tts_models/multilingual/multi-dataset/xtts_v2)")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--speaker_wav", help="Path to reference speaker wav (for XTTS)")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--out_path", required=True, help="Output wav path")
    parser.add_argument("--repetition_penalty", type=float, default=2.0, help="Repetition penalty")
    parser.add_argument("--temperature", type=float, default=0.75, help="Temperature")
    parser.add_argument("--speaker_id", help="Speaker identifier (for Bark/Tortoise)")
    parser.add_argument("--preset", default="fast", help="Preset for Tortoise (e.g., ultra_fast, fast, standard, high_quality)")
    
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    print(f"Loading model: {args.model_name}...", file=sys.stderr)
    
    original_stderr = sys.stderr
    try:
        from TTS.api import TTS
        tts = TTS(args.model_name, progress_bar=True).to(device)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Failed to load model {args.model_name}: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        sys.stderr = original_stderr

    print(f"Synthesizing to {args.out_path}...", file=sys.stderr)
    
    try:
        from tqdm import tqdm
        
        # Split text into sentences for granular progress
        if hasattr(tts, 'synthesizer') and hasattr(tts.synthesizer, 'split_into_sentences'):
            sentences = tts.synthesizer.split_into_sentences(args.text)
        elif hasattr(tts, 'tts_tokenizer'):
            sentences = tts.tts_tokenizer.split_sentences(args.text)
        else:
            sentences = [args.text]
            
        print(f"Total sentences to process: {len(sentences)}", file=sys.stderr)
        # Emit structured token for backend parsing
        print(f"SENTENCE_COUNT: {len(sentences)}")
        sys.stdout.flush()
        
        all_wav_chunks = []
        
        with tqdm(total=len(sentences), unit="sent", desc="Synthesizing", file=sys.stderr) as pbar:
            for i, sentence in enumerate(sentences):
                # Model-specific parameters
                tts_kwargs = {
                    "text": sentence,
                }
                
                # Only pass language if model is explicitly multilingual or XTTS
                # Bark and Tortoise in Coqui are sometimes picky about this
                if "xtts" in args.model_name.lower():
                    tts_kwargs["language"] = args.language
                    tts_kwargs.update({
                        "speaker_wav": args.speaker_wav,
                        "repetition_penalty": args.repetition_penalty,
                        "temperature": args.temperature,
                    })
                elif "tortoise" in args.model_name.lower():
                    tts_kwargs.update({
                        "preset": args.preset,
                        "speaker_id": args.speaker_id if args.speaker_id else "random"
                    })
                elif "bark" in args.model_name.lower():
                    # Bark handles language through tags or its propia way, usually no lang arg in TTS.tts
                    # Passing speaker_id helps maintain consistency
                    if args.speaker_id:
                        tts_kwargs["speaker_id"] = args.speaker_id
                else:
                    # Generic case, maybe it needs language
                    if hasattr(tts, 'is_multi_lingual') and tts.is_multi_lingual:
                        tts_kwargs["language"] = args.language

                wav_chunk = tts.tts(**tts_kwargs)
                all_wav_chunks.append(torch.FloatTensor(wav_chunk))
                pbar.update(1)
                
                # Emit progression token
                print(f"SENTENCE_COMPLETED: {i + 1}")
                sys.stdout.flush()
        
        if all_wav_chunks:
            final_wav = torch.cat(all_wav_chunks, dim=0)
            # Sample rate varies: XTTS v2 is 24kHz, Bark is 24kHz, Tortoise is 24kHz.
            # Coqui TTS wrapper usually handles this or returns a consistent rate.
            # For multilinguial/multi-dataset/xtts_v2 it is 24000.
            sample_rate = 24000
            if "xtts" in args.model_name.lower():
                sample_rate = 24000
            elif "bark" in args.model_name.lower():
                sample_rate = 24000
            elif "tortoise" in args.model_name.lower():
                sample_rate = 24000
                
            torchaudio.save(args.out_path, final_wav.unsqueeze(0), sample_rate)
            print(f"Effectively synthesized {len(sentences)} sentences.", file=sys.stderr)
        
    except Exception as e:
        print(f"\n[CRITICAL ERROR] TTS failed: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
