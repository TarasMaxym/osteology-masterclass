#!/bin/zsh
cd "$(dirname "$0")"
PORT=8765

# Check if server is already responding healthy
if ! curl --max-time 1.5 -s "http://127.0.0.1:${PORT}/api/health" | grep -q '"ok":\s*true'; then
  # If port is held by an unresponsive process (e.g. after sleep or restart), clear it
  OLD_PID=$(lsof -ti :${PORT} 2>/dev/null)
  if [ -n "$OLD_PID" ]; then
    echo "Clearing unresponsive process on port ${PORT} (PID ${OLD_PID})..."
    kill -9 $OLD_PID 2>/dev/null
    sleep 0.4
  fi
  echo "Starting JUMC Osteology & Pins Masterclass on http://127.0.0.1:${PORT} ..."
  python3 server.py --port ${PORT} &
  SERVER_PID=$!
  sleep 0.8
  open "http://127.0.0.1:${PORT}"
  echo "Server running (PID ${SERVER_PID}). Press Ctrl+C in this window when finished studying."
  wait ${SERVER_PID}
else
  echo "Masterclass server already running — opening browser!"
  open "http://127.0.0.1:${PORT}"
fi
