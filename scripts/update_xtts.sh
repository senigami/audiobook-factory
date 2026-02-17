#!/bin/bash
set -e

# Define paths
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$BASE_DIR/venv"

# Activate virtual environment
if [ -d "$VENV_DIR" ]; then
    echo "Activating virtual environment..."
    source "$VENV_DIR/bin/activate"
else
    echo "Virtual environment not found at $VENV_DIR"
    exit 1
fi

echo "Updating pip..."
pip install --upgrade pip

echo "Uninstalling existing TTS..."
# Uninstall twice to be safe against multiple installs or egg-links
pip uninstall -y TTS || true
pip uninstall -y TTS || true
# The new fork uses check for coqui-tts
pip uninstall -y coqui-tts || true

# Handle uv installation if available
PIP_CMD="pip"
if command -v uv &> /dev/null; then
    echo "Detected 'uv' - using it for faster installation."
    PIP_CMD="uv pip"
fi

echo "Uninstalling conflicting dependencies..."
$PIP_CMD uninstall -y coqpit || true

echo "Installing latest TTS and dependencies..."
$PIP_CMD install coqpit-config==0.2.4 "transformers<5.0.0" torchcodec --no-cache-dir
$PIP_CMD install "git+https://github.com/idiap/coqui-ai-TTS.git@main" --no-cache-dir

echo "Verifying installation..."
pip show coqui-tts

echo "XTTS update complete! You are now on the latest development version."
