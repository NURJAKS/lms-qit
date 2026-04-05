#!/usr/bin/env bash
# Одна команда: backend (8000) + frontend (3000). Запускайте из любой папки:
#   ./start.sh
#   npm start
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

check_port() {
  lsof -Pi :"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

if check_port 8000; then
  echo -e "${YELLOW}⚠️  Порт 8000 занят (backend уже запущен?).${NC}"
fi
if check_port 3000; then
  echo -e "${YELLOW}⚠️  Порт 3000 занят (frontend уже запущен?).${NC}"
fi

VENV_PY="$SCRIPT_DIR/backend/.venv/bin/python"
VENV_PIP="$SCRIPT_DIR/backend/.venv/bin/pip"

if [ ! -x "$VENV_PY" ]; then
  echo -e "${BLUE}📦 Создаю backend/.venv …${NC}"
  (cd "$SCRIPT_DIR/backend" && python3 -m venv .venv)
  echo -e "${BLUE}📥 pip install (backend) …${NC}"
  "$VENV_PIP" install --upgrade pip
  "$VENV_PIP" install -r "$SCRIPT_DIR/backend/requirements.txt"
fi

if ! "$VENV_PY" -c "import uvicorn" 2>/dev/null; then
  echo -e "${BLUE}📥 Установка зависимостей backend…${NC}"
  "$VENV_PIP" install -r "$SCRIPT_DIR/backend/requirements.txt"
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
