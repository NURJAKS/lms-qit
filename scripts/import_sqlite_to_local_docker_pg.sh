#!/usr/bin/env bash
# Повторный импорт backend/education.db в Postgres без полного перезапуска стека.
# Обычный рабочий цикл: просто `docker compose ... up -d --build` — import-sqlite в docker-compose.local-prod.yml
# уже выполняет migrate --force перед backend.
#
# Этот скрипт — если Postgres уже поднят и нужно только перезалить данные из SQLite.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${COMPOSE_PROJECT_NAME:-lms-local}"
ENV_FILE="${ENV_FILE:-.env.local-prod}"
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f docker-compose.vps.yml -f docker-compose.local-prod.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет $ENV_FILE — скопируйте: cp env.local-prod.example .env.local-prod"
  exit 1
fi
if [[ ! -f "$ROOT/backend/education.db" ]]; then
  echo "Нет файла backend/education.db"
  exit 1
fi

echo "Поднимаем db (если выключен)..."
"${COMPOSE[@]}" up -d db

echo "Ожидание Postgres..."
for i in $(seq 1 40); do
  if "${COMPOSE[@]}" exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' &>/dev/null; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 40 ]]; then
    echo "Postgres не готов."
    exit 1
  fi
done

echo "Импорт SQLite → Postgres (тот же шаг, что import-sqlite в compose)..."
"${COMPOSE[@]}" run --rm --no-deps import-sqlite

echo "Перезапуск backend (подхватить данные)..."
"${COMPOSE[@]}" up -d backend

echo "Готово. Полный стек с автоимпортом при каждом up:"
echo "  ${COMPOSE[*]} up -d --build"
