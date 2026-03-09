#!/bin/bash

# Скрипт для запуска проекта локально
# Использование: ./start.sh

set -e

echo "🚀 Запуск LMS Platform..."

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка директорий
if [ ! -d "backend" ]; then
    echo "❌ Директория backend не найдена!"
    exit 1
fi

if [ ! -d "frontend-next" ]; then
    echo "❌ Директория frontend-next не найдена!"
    exit 1
fi

# Функция для проверки порта
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Проверка портов
if check_port 8000; then
    echo -e "${YELLOW}⚠️  Порт 8000 уже занят. Backend может быть уже запущен.${NC}"
fi

if check_port 3000; then
    echo -e "${YELLOW}⚠️  Порт 3000 уже занят. Frontend может быть уже запущен.${NC}"
fi

echo ""
echo -e "${BLUE}📦 Запуск Backend сервера...${NC}"
echo ""

# Запуск backend в фоне
cd backend
if [ ! -d "venv" ]; then
    echo "❌ Виртуальное окружение не найдено!"
    echo "Создайте его командой: python3 -m venv venv"
    exit 1
fi

source venv/bin/activate

# Проверка зависимостей
if ! python -c "import uvicorn" 2>/dev/null; then
    echo "📥 Установка зависимостей backend..."
    pip install -r requirements.txt
fi

echo -e "${GREEN}✅ Backend запускается на http://127.0.0.1:8000${NC}"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

cd ..

echo ""
echo -e "${BLUE}📦 Запуск Frontend сервера...${NC}"
echo ""

# Запуск frontend в фоне
cd frontend-next

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📥 Установка зависимостей frontend..."
    npm install
fi

echo -e "${GREEN}✅ Frontend запускается на http://localhost:3000${NC}"
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo -e "${GREEN}✨ Оба сервера запущены!${NC}"
echo ""
echo "📍 Backend:  http://127.0.0.1:8000"
echo "📍 Frontend: http://localhost:3000"
echo "📍 API Docs: http://127.0.0.1:8000/docs"
echo ""
echo "Для остановки серверов нажмите Ctrl+C или выполните:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Ожидание сигнала для остановки
trap "echo ''; echo '🛑 Остановка серверов...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Ожидание завершения процессов
wait
