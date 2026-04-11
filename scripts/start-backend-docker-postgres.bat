@echo off
REM Optional: PostgreSQL in Docker (NOT the default demo path).
REM Default local demo uses SQLite: use start-windows.cmd in repo root or start-backend-windows.ps1
cd /d "%~dp0\.."

echo === 1. Starting PostgreSQL (Docker)...
docker compose up -d db

echo === 2. Waiting for DB (5 sec)...
timeout /t 5 /nobreak > nul

echo === 3. Backend venv and deps...
cd backend
if not exist "venv" (
  python -m venv venv
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo === 4. Create tables...
python -c "from app.main import app; from app.core.database import engine, Base; from app.models import *; Base.metadata.create_all(bind=engine); print('OK')"

echo === 5. Seed...
python seed_data.py

echo === 6. Server (set DATABASE_URL=postgresql://... in backend\.env to match docker-compose)...
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
