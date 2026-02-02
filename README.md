# 🎧 Audiobook Factory

Audiobook Factory is a self-hosted web dashboard for turning
chapter-marked text files into full audiobook audio using:

-   **XTTS-v2 (voice cloning)**
-   **Piper (fast ONNX voices)**
-   **Auto-Tuning ETA (Learns your hardware speed)**
-   **Interactive Assembly (Rename/Skip chapters)**
-   **Audible Project Overview (Synthesized locally)**

![Audiobook Factory Dashboard](assets/home.png)

> [!TIP]
> **Listen to the Overview**:
> <audio src="assets/Overview.mp3" controls></audio>

It runs entirely locally and supports queued batch processing, live
progress tracking, WAV + MP3 generation, and browser audio preview.

No cloud required.

------------------------------------------------------------------------

# 🚀 Features

-   📖 Upload large `.txt` manuscripts
-   ✂ Automatically split into chapters
-   🎙 Voice cloning with XTTS (your narrator voice)
-   🔊 Piper ONNX voice support
-   🧠 One-click queued batch processing
-   📊 **Live Auto-Tuning ETA**: Progress bars that learn from your hardware performance.
-   🎧 **Interactive Assembly**: Resize, rename, or skip chapters before building the M4B.
-   🎧 Built-in audio player
-   🔁 Backfill MP3 from WAV
-   🔄 Reconcile job state with existing audio files
-   🧹 Clear completed jobs

![Interactive Audiobook Assembly](assets/export.png)

------------------------------------------------------------------------

# 🧰 Requirements

## System Requirements

-   macOS, Linux, or Windows
-   Python 3.11+ (recommended)
-   `ffmpeg` (required for MP3 generation)

------------------------------------------------------------------------

# 📦 Installation

## 1️⃣ Clone Repository

``` bash
git clone <your-repo-url>
cd audiobook-factory
```

------------------------------------------------------------------------

## 2️⃣ Install System Dependencies

### macOS (Homebrew)

``` bash
brew install python@3.11 ffmpeg
```

### Ubuntu / Debian

``` bash
sudo apt update
sudo apt install -y python3 python3-venv ffmpeg
```

------------------------------------------------------------------------

## 3️⃣ Create Dashboard Virtual Environment

``` bash
python3 -m venv venv
source venv/bin/activate
pip install -U pip
```

Install required packages:

``` bash
pip install -r requirements.txt
```

------------------------------------------------------------------------

# 🎙 XTTS Setup (Voice Cloning Engine)

Create a separate environment for XTTS:

``` bash
python3 -m venv ~/xtts-env
source ~/xtts-env/bin/activate
pip install -U pip
pip install TTS
```

Test XTTS:

``` bash
tts --model_name tts_models/multilingual/multi-dataset/xtts_v2   --text "Testing Audiobook Factory."   --out_path test.wav
```

------------------------------------------------------------------------

## 🎤 Narrator Voice Sample

Place your clean narrator recording in:

    audiobook-factory/
      narrator_clean.wav

Recommended: - 30--120 seconds - Quiet room - No background noise -
Consistent tone - WAV format (mono preferred)

------------------------------------------------------------------------

# 🔊 Piper Setup (Optional)

Place `.onnx` voice files in:

    voices/
      en_US-voice.onnx
      en_US-voice.onnx.json

Optional separate environment:

``` bash
python3 -m venv ~/piper-env
source ~/piper-env/bin/activate
pip install -U pip
pip install piper-tts
```

------------------------------------------------------------------------

# 🗂 Recommended Folder Structure

    ├── app/
    ├── assets/             <-- README screenshots & audio
    ├── templates/
    ├── chapters_out/
    ├── uploads/
    ├── reports/
    ├── xtts_audio/
    ├── piper_audio/
    ├── voices/
    ├── narrator_clean.wav
    ├── state.json
    └── README.md

------------------------------------------------------------------------

# ▶ Running Audiobook Factory

``` bash
cd audiobook-factory
source venv/bin/activate
python3 -m uvicorn run:app --port 8123
```

Open:

    http://127.0.0.1:8123

⚠ For long queues, do NOT use `--reload`.

------------------------------------------------------------------------

# 📖 Usage

1.  Upload `.txt` manuscript.

2.  Ensure chapters follow format:

    Chapter 1591: Years Later

3.  Split into chapters.

4.  Start queue.

5.  Monitor progress live.

6.  Download WAV or MP3 files.

------------------------------------------------------------------------

# 🔁 State Management

If jobs appear stuck:

-   Reset stuck RUNNING jobs
-   Reconcile jobs with existing files
-   Clear DONE jobs
-   Or delete `state.json`

------------------------------------------------------------------------

# 🧪 Testing

Audiobook Factory includes a comprehensive suite of automated tests covering text sanitization, API endpoints, and job logic.

``` bash
source venv/bin/activate
pytest -v
```

------------------------------------------------------------------------

# 📦 requirements.txt

# 🧹 Optional: .gitignore

    venv/
    __pycache__/
    *.pyc
    state.json
    uploads/
    reports/
    xtts_audio/
    piper_audio/
    chapters_out/
    narrator_clean.wav
    voices/

------------------------------------------------------------------------

# 🔐 Security

Designed for local use only. Do not expose directly to the public
internet.

------------------------------------------------------------------------

# 📜 License

MIT recommended.

------------------------------------------------------------------------

# 🎧 Why Audiobook Factory?

Because sometimes you just want to feed in a manuscript and let the
machinery hum until it becomes a voice.
