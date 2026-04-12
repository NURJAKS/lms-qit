#!/usr/bin/env bash
# Импорт backend/education.db (SQLite) в PostgreSQL локального стека «как VPS».
#
# Перед запуском: поднята БД (хотя бы сервис db).
#   cp env.local-prod.example .env.local-prod   # если ещё нет
#
# Запуск из корня репозитория:
#   ./scripts/import_sqlite_to_local_docker_pg.sh
#
# Переменные (опционально):
#   COMPOSE_PROJECT_NAME=lms-local  (по умолчанию lms-local)
#   ENV_FILE=.env.local-prod
#   SQLITE_PATH=/abs/path/to/education.db
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${COMPOSE_PROJECT_NAME:-lms-local}"
ENV_FILE="${ENV_FILE:-.env.local-prod}"
SQLITE="${SQLITE_PATH:-$ROOT/backend/education.db}"
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f docker-compose.vps.yml -f docker-compose.local-prod.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE — скопируйте: cp env.local-prod.example .env.local-prod"
  exit 1
fi
if [[ ! -f "$SQLITE" ]]; then
  echo "Нет файла SQLite: $SQLITE"
  exit 1
fi

echo "Поднимаем Postgres (если ещё не запущен)..."
"${COMPOSE[@]}" up -d db

echo "Ожидание готовности db..."
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' &>/dev/null; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 30 ]]; then
    echo "Postgres не поднялся за 30 с. Проверьте: ${COMPOSE[*]} ps"
    exit 1
  fi
done

echo "Сборка образа backend (если нужно)..."
"${COMPOSE[@]}" build backend

echo "Миграция SQLite → PostgreSQL (--force перезапишет данные в Postgres)..."
"${COMPOSE[@]}" run --rm --no-deps \
  -v "$SQLITE":/tmp/migrate_source.db:ro \
  backend python migrate_sqlite_to_pg.py \
  --sqlite-url sqlite:////tmp/migrate_source.db \
  --force

echo "Перезапуск backend и frontend (подхватить чистое состояние пула БД)..."
"${COMPOSE[@]}" up -d backend frontend

echo "Готово. Входите пользователями из SQLite (email/пароль как в той БД)."
echo "Проверка совпадения строк с SQLite: см. backend/scripts/compare_sqlite_pg_counts.py (в README внутри файла)."
echo "Приложение: http://localhost:3000"
