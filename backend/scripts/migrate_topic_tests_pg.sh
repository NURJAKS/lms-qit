#!/usr/bin/env bash
# Полная перезаливка тематических + финальных тестов (Python/Web по названию курса).
# Требуется DATABASE_URL на PostgreSQL (как в docker-compose.vps / .env.deploy).
#
# Примеры:
#   export DATABASE_URL='postgresql://lms:PASSWORD@127.0.0.1:5432/education_platform'
#   ./scripts/migrate_topic_tests_pg.sh
#
#   ./scripts/migrate_topic_tests_pg.sh 'postgresql://lms:PASSWORD@db-host:5432/education_platform'

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == postgresql://* ]] || [[ "${1:-}" == postgres://* ]] || [[ "${1:-}" == postgresql+psycopg2://* ]]; then
  export DATABASE_URL="$1"
  shift
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Укажите DATABASE_URL (переменная окружения или первый аргумент с postgresql://...)." >&2
  exit 1
fi

case "$DATABASE_URL" in
  postgresql://*|postgres://*|postgresql+psycopg2://*) ;;
  *)
    echo "Ожидается PostgreSQL URL. Сейчас: ${DATABASE_URL:0:48}..." >&2
    exit 1
    ;;
esac

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PY="$ROOT/.venv/bin/python"
else
  PY="${PYTHON:-python3}"
fi

exec "$PY" migrate_topic_tests.py
