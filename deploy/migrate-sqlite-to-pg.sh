#!/usr/bin/env bash
# Перенос данных из файла SQLite (education.db) в PostgreSQL из docker-compose.vps.yml.
#
# Важно: выполните ДО первого полного запуска backend/frontend с пустым томом Postgres,
# либо после docker compose down и удаления тома postgres (см. deploy/VPS.md).
#
# Использование:
#   chmod +x deploy/migrate-sqlite-to-pg.sh
#   ./deploy/migrate-sqlite-to-pg.sh /abs/path/to/education.db
#
# Переменные: COMPOSE_ENV_FILE (по умолчанию .env.deploy в корне репозитория)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SQLITE_FILE="${1:-}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-$ROOT/.env.deploy}"

if [[ -z "$SQLITE_FILE" || ! -f "$SQLITE_FILE" ]]; then
  echo "Укажите путь к файлу SQLite (например копия с тома lms_sqlite_data):" >&2
  echo "  $0 /path/to/education.db" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_ENV_FILE" ]]; then
  echo "Нет $COMPOSE_ENV_FILE — скопируйте env.deploy.example и задайте POSTGRES_PASSWORD." >&2
  exit 1
fi

echo "Запускаю только сервис db..."
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.vps.yml up -d db

echo "Ожидаю готовность Postgres..."
for i in $(seq 1 60); do
  if docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.vps.yml exec -T db pg_isready -U lms -d education_platform &>/dev/null; then
    break
  fi
  sleep 1
done

ABS_SQLITE="$(cd "$(dirname "$SQLITE_FILE")" && pwd)/$(basename "$SQLITE_FILE")"

echo "Миграция SQLite → PostgreSQL (файл смонтирован только для чтения)..."
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.vps.yml run --rm --no-deps \
  --entrypoint python \
  -v "$ABS_SQLITE:/tmp/migrate_source.db:ro" \
  backend migrate_sqlite_to_pg.py \
  --sqlite-url sqlite:////tmp/migrate_source.db \
  --force

echo ""
echo "Готово. Запуск полного стека:"
echo "  docker compose --env-file $COMPOSE_ENV_FILE -f docker-compose.vps.yml up -d --build"
