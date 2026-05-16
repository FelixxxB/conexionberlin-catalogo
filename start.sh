#!/bin/bash
# Start the Conexión Berlín catalog dashboard

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Check GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
  echo "⚠️  GEMINI_API_KEY not set — AI assistant will be disabled"
  echo "   Export it with: export GEMINI_API_KEY=AIzaSy..."
  echo ""
fi

echo "Starting backend on http://localhost:8000"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:3000"
cd "$ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo ""
echo "Dashboard ready at http://localhost:3000"
wait
