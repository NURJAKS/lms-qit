#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "=== 1. Запуск PostgreSQL (Docker)..."
docker compose up -d db

echo "=== 2. Ожидание готовности БД (5 сек)..."
sleep 5

echo "=== 3. Backend: venv и зависимости..."
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

echo "=== 4. Создание таблиц (первый запуск приложения)..."
python3 -c "
from app.main import app
from app.core.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
print('Таблицы созданы.')
"

echo "=== 5. Начальные данные (seed)..."
python3 seed_data.py

echo "=== 6. Запуск сервера (uvicorn)..."
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
