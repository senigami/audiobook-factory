#!bash
cd ~/tts-dashboard
source venv/bin/activate
uvicorn run:app --reload --port 8123