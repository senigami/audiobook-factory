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

echo "Installing latest TTS from GitHub..."
# Install directly from the main branch of the Coqui TTS repository
# We also include typical dependencies to ensure compatibility
pip install "git+https://github.com/coqui-ai/TTS.git@dev" --no-cache-dir

echo "Verifying installation..."
pip show TTS

echo "XTTS update complete! You are now on the latest development version."
