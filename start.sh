#!/usr/bin/env bash
# Одна команда: backend (8000) + frontend (3000). Запускайте из корня репозитория:
#   ./start.sh        (Linux / macOS / Git Bash на Windows)
#   См. также start-windows.cmd для чистого PowerShell.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Запуск LMS Platform..."

if [ ! -d "backend" ] || [ ! -d "frontend-next" ]; then
  echo "❌ Запускайте скрипт из корня репозитория (рядом с backend и frontend-next)."
  exit 1
fi

# Python: python3 или python (Windows / Git Bash)
if command -v python3 >/dev/null 2>&1; then
  PYBIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYBIN="python"
else
  echo "❌ Не найден python3/python. Установите Python 3.12+."
  exit 1
fi

# venv: Linux/macOS — bin/python; Windows — Scripts/python.exe
VENV_PY="$SCRIPT_DIR/backend/.venv/bin/python"
VENV_PIP="$SCRIPT_DIR/backend/.venv/bin/pip"
if [ -f "$SCRIPT_DIR/backend/.venv/Scripts/python.exe" ]; then
  VENV_PY="$SCRIPT_DIR/backend/.venv/Scripts/python.exe"
  VENV_PIP="$SCRIPT_DIR/backend/.venv/Scripts/pip.exe"
fi

if [ ! -x "$VENV_PY" ] && [ ! -f "$VENV_PY" ]; then
  echo -e "${BLUE}📦 Создаю backend/.venv …${NC}"
  (cd "$SCRIPT_DIR/backend" && "$PYBIN" -m venv .venv)
  if [ -f "$SCRIPT_DIR/backend/.venv/Scripts/python.exe" ]; then
    VENV_PY="$SCRIPT_DIR/backend/.venv/Scripts/python.exe"
    VENV_PIP="$SCRIPT_DIR/backend/.venv/Scripts/pip.exe"
  else
    VENV_PY="$SCRIPT_DIR/backend/.venv/bin/python"
    VENV_PIP="$SCRIPT_DIR/backend/.venv/bin/pip"
  fi
fi

echo -e "${BLUE}📥 pip install (backend) …${NC}"
"$VENV_PY" -m pip install --upgrade pip -q
"$VENV_PY" -m pip install -r "$SCRIPT_DIR/backend/requirements.txt"

if ! "$VENV_PY" -c "import uvicorn" 2>/dev/null; then
  echo -e "${BLUE}📥 Установка зависимостей backend…${NC}"
  "$VENV_PY" -m pip install -r "$SCRIPT_DIR/backend/requirements.txt"
fi

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  if [ -f "$SCRIPT_DIR/backend/.env.example" ]; then
    echo -e "${YELLOW}Нет backend/.env — копирую из .env.example (секреты не в git).${NC}"
    cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
  else
    echo -e "${YELLOW}Нет backend/.env и .env.example — создайте backend/.env вручную.${NC}"
  fi
fi

echo -e "${GREEN}✅ Backend: http://127.0.0.1:8000${NC}"
(
  cd "$SCRIPT_DIR/backend"
  exec "$VENV_PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) &
BACKEND_PID=$!

cd "$SCRIPT_DIR/frontend-next"
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}📥 npm install (frontend) …${NC}"
  npm install
fi

echo -e "${GREEN}✅ Frontend: http://localhost:3000${NC}"
npm run dev &
FRONTEND_PID=$!

cd "$SCRIPT_DIR"

echo ""
echo -e "${GREEN}✨ Готово.${NC}"
echo "   Backend:  http://127.0.0.1:8000"
echo "   Frontend: http://localhost:3000"
echo "   API docs: http://127.0.0.1:8000/docs"
echo ""
echo "Остановка: Ctrl+C"
echo ""

cleanup() {
  echo ""
  echo "🛑 Остановка серверов…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
