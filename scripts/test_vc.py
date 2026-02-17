import os
import torch
import torchaudio
import sys
from TTS.api import TTS

def test_vc(model_name, source_wav, target_wav, output_name):
    print(f"\n--- Testing {model_name} ---")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    try:
        # Load the VC model
        tts = TTS(model_name).to(device)
        
        # Output path
        out_path = f"test_outputs/{output_name}.wav"
        os.makedirs("test_outputs", exist_ok=True)
        
        print(f"Converting {source_wav} using {target_wav} as reference...")
        tts.voice_conversion_to_file(
            source_wav=source_wav,
            target_wav=target_wav,
            file_path=out_path
        )
        print(f"Success! Saved to {out_path}")
    except Exception as e:
        print(f"Error testing {model_name}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/test_vc.py <source.wav> <target.wav>")
        sys.exit(1)
        
    source = sys.argv[1]
    target = sys.argv[2]
    
    # Test models
    test_vc("voice_conversion_models/multilingual/multi-dataset/knnvc", source, target, "knnvc_output")
    test_vc("voice_conversion_models/multilingual/multi-dataset/openvoice_v2", source, target, "openvoice_v2_output")
    test_vc("voice_conversion_models/multilingual/vctk/freevc24", source, target, "freevc_output")
