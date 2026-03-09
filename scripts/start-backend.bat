@echo off
cd /d "%~dp0\.."

echo === 1. Запуск PostgreSQL (Docker)...
docker compose up -d db

echo === 2. Ожидание готовности БД (5 сек)...
timeout /t 5 /nobreak > nul

echo === 3. Backend: venv и зависимости...
cd backend
if not exist "venv" (
  python -m venv venv
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo === 4. Создание таблиц...
python -c "from app.main import app; from app.core.database import engine, Base; from app.models import *; Base.metadata.create_all(bind=engine); print('OK')"

echo === 5. Seed данные...
python seed_data.py

echo === 6. Запуск сервера...
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
