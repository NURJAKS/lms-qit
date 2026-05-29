#!/bin/sh
set -e

wait_postgres() {
  echo "Waiting for Postgres..."
  python << 'END'
import os
import socket
from urllib.parse import urlparse

db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@db:5432/education_platform")
u = urlparse(db_url)
host = u.hostname
port = u.port or 5432

while True:
    try:
        with socket.create_connection((host, port), timeout=1):
            break
    except (OSError, ConnectionRefusedError):
        import time
        time.sleep(1)
END
  echo "Postgres is up!"
}

# Разовые команды (миграция SQLite→PG, утилиты): docker compose run backend python …
# Без init_db/seed/uvicorn — только ожидание Postgres при postgresql://
if [ "$#" -gt 0 ]; then
  if echo "${DATABASE_URL:-}" | grep -qi 'postgresql'; then
    wait_postgres
  fi
  exec "$@"
fi

# --- SQLite (демо-БД из образа, тома на VPS) ---
if echo "${DATABASE_URL:-}" | grep -qi 'sqlite'; then
  echo "SQLite mode: Postgres wait skipped."
  if [ -n "${LMS_DATA_DIR:-}" ]; then
    mkdir -p "$LMS_DATA_DIR" /app/uploads
    if [ ! -f "$LMS_DATA_DIR/education.db" ]; then
      if [ -f /opt/lms-bundled/education.db ]; then
        echo "Initializing $LMS_DATA_DIR/education.db from bundled demo database."
        cp /opt/lms-bundled/education.db "$LMS_DATA_DIR/education.db"
      else
        echo "No bundled education.db; creating schema and minimal seed."
        python init_db.py
        python seed_data.py 2>/dev/null || true
        python seed_shop.py 2>/dev/null || true
      fi
    fi
    if [ -z "$(ls -A /app/uploads 2>/dev/null)" ]; then
      if [ -d /opt/lms-bundled/uploads ]; then
        echo "Populating /app/uploads from bundle."
        cp -a /opt/lms-bundled/uploads/. /app/uploads/
      fi
    fi
  fi
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
fi

# --- PostgreSQL: полный старт приложения ---
wait_postgres

if [ -z "$(ls -A /app/uploads 2>/dev/null)" ]; then
  if [ -d /opt/lms-bundled/uploads ]; then
    echo "Populating /app/uploads from bundle (certificates template, etc.)."
    mkdir -p /app/uploads
    cp -a /opt/lms-bundled/uploads/. /app/uploads/
  fi
fi

python init_db.py

# После ручного импорта SQLite→Postgres поставьте LMS_SKIP_ENTRYPOINT_SEED=1 в .env.deploy / .env.local-prod,
# иначе seed_* снова накрутят демо (прогресс, группы, задания) поверх перенесённых данных.
if [ "${LMS_SKIP_ENTRYPOINT_SEED:-0}" = "1" ] || [ "${LMS_SKIP_ENTRYPOINT_SEED:-}" = "true" ]; then
  echo "LMS_SKIP_ENTRYPOINT_SEED: пропуск seed_data / seed_shop / mock progress."
else
  python seed_data.py 2>/dev/null || true
  python seed_shop.py 2>/dev/null || true
  python seed_mock_progress.py 2>/dev/null || true
  python seed_real_students_progress.py 2>/dev/null || true
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
