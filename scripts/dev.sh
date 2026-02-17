#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p) 2>/dev/null
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT EXIT

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Start Backend
echo "Starting Backend (Uvicorn)..."
cd "$PROJECT_ROOT"
source venv/bin/activate
uvicorn run:app --port 8123 &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend (Vite)..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
