# 🎧 Audiobook Factory

Audiobook Factory is a modern, self-hosted web dashboard for turning chapter-marked text files into high-quality audiobook audio using **local AI speech synthesis**.

- **XTTS-v2 (Native Voice Cloning)**: Clone any voice from just 60 seconds of audio.
- **Modern Glassmorphism UI**: High-performance dashboard with deep customization.
- **Per-Chapter Preview**: Preview and analyze text segments before synthesis.
- **Auto-Tuning ETA**: Progress tracking that learns from your hardware's speed.
- **Interactive Assembly**: Smart interface for renaming, reordering, and building final M4B files.

![Audiobook Factory Dashboard](docs/assets/home.jpg)

> [!TIP]
> **View Live Project Overview**: 🎙️ [Audiobook Factory Live Showcase](https://senigami.github.io/audiobook-factory/)
> _(Includes an embedded audio player and interactive feature tour)_

It runs entirely locally and supports queued batch processing, live progress tracking, and browser-based audio preview.

No cloud required. No subscriptions. Total privacy.

---

# 🚀 Features

- 🎙 **Voice Cloning**: Use XTTS-v2 to narrate with your own cloned voice profiles.
- 📝 **Per-Chapter Analysis**: Dedicated modal for previewing raw text vs. engine-processed text.
- 🖥 **System Console**: Integrated terminal for real-time logs, togglable from the global header.
- 📊 **Live Auto-Tuning ETA**: Progress bars that adapt to your hardware performance in real-time.
- 🎧 **Interactive Assembly**: Rename, skip, or reorder chapters before final assembly into M4B.
- 🔊 **MP3/WAV Support**: High-fidelity WAV generation with automatic MP3 backfilling.
- 🧹 **Job Management**: One-click clearing of completed jobs and reconciliation of existing files.

![Interactive Audiobook Assembly](docs/assets/export.png)

---

# 🧰 Requirements

## System Requirements

- macOS, Linux, or Windows
- Python 3.11+ (Required for XTTS)
- `ffmpeg` (Required for MP3 and M4B generation)

---

# 📦 Installation

## 1️⃣ Clone Repository

```bash
git clone https://github.com/senigami/audiobook-factory.git
cd audiobook-factory
```

---

## 2️⃣ Install System Dependencies

### macOS (Homebrew)

```bash
brew install python@3.11 ffmpeg
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y python3 python3-venv ffmpeg
```

---

## 3️⃣ Create Dashboard Virtual Environment

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

---

# 🎙 XTTS Setup (Voice Cloning Engine)

Create a separate environment for XTTS (Python 3.11 is required):

```bash
python3.11 -m venv ~/xtts-env
source ~/xtts-env/bin/activate
pip install -U pip
pip install -r requirements-xtts.txt
```

### 🎤 Voice Profiles

Place your voice samples in the `voices/` directory:

```text
    voices/
      Default/
        profile.json
        speaker.wav
      MyVoice/
        speaker.wav
```

The system will automatically detect these profiles in the Dashboard.

---

# ▶ Running Audiobook Factory

1. **Start the backend**:

```bash
cd audiobook-factory
source venv/bin/activate
uvicorn run:app --port 8123
```

2. **Access the Dashboard**:
   Open `http://127.0.0.1:8123` in your browser.

---

# 📖 Usage

1.  **Upload**: Upload your `.txt` manuscript.
2.  **Split**: Automatically split the file into chapters.
3.  **Preview**: Use the **Preview & Analyze** modal from the chapter card's menu to check text processing.
4.  **Synthesize**: Select a Voice Profile and click **Start Batch**.
5.  **Assemble**: Once finished, go to the **Library** tab to assemble your chapters into a final M4B audiobook.

---

# 🧪 Testing

Audiobook Factory includes a comprehensive suite of automated tests covering text sanitization, API endpoints, and job logic.

```bash
source venv/bin/activate
pytest -v
```

### 🛠️ Quality Control & CI

We use **GitHub Actions** to ensure every push and pull request meets our quality standards. The following checks are performed:

1.  **Backend Linting:** Uses `ruff` to enforce Python code style.
2.  **Backend Tests:** Uses `pytest` for unit and integration tests.
3.  **Frontend Linting:** Uses `eslint` for React/TypeScript best practices.
4.  **Frontend Tests:** Uses `vitest` for component testing.
5.  **Build Check:** Ensures the React frontend builds successfully.

#### Local Pre-push Hook

You can install a local git hook to run these checks before every push:

```bash
./scripts/install_hooks.sh
```

This prevents pushing broken code to the repository.

---

# 🔐 Security

Designed for **local use only**. Do not expose directly to the public internet without proper authentication and reverse proxy setup.

---

# 📜 License

MIT License.

---

# 🎧 Why Audiobook Factory?

Because turning a manuscript into a high-quality audiobook shouldn't require a cloud subscription or technical wizardry—just a local machine and the right machinery.
