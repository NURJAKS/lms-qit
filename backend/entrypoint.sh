#!/bin/sh
set -e
# Create tables and seed demo data (each seed skips if data exists)
python init_db.py
python seed_data.py 2>/dev/null || true
python seed_shop.py 2>/dev/null || true
python seed_mock_progress.py 2>/dev/null || true
python seed_real_students_progress.py 2>/dev/null || true
# seed_leaderboard_students.py отключен - моковые студенты создаются только для ручного тестирования
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
