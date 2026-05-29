#!/usr/bin/env bash
# Первичный запуск LMS на VPS из корня репозитория.
# Использование: chmod +x deploy/bootstrap-vps.sh && ./deploy/bootstrap-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Установите Docker и docker compose (см. deploy/VPS.md раздел 1)." >&2
  exit 1
fi

if [[ ! -f .env.deploy ]]; then
  cp env.deploy.example .env.deploy
  if command -v openssl >/dev/null 2>&1; then
    KEY="$(openssl rand -hex 32)"
    sed -i.bak "s/^SECRET_KEY=.*/SECRET_KEY=${KEY}/" .env.deploy && rm -f .env.deploy.bak 2>/dev/null || true
  fi
  echo "Создан .env.deploy — задайте POSTGRES_PASSWORD, проверьте ALLOWED_ORIGINS и FRONTEND_PUBLIC_URL."
fi

echo "Сборка и запуск docker compose..."
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
docker compose --env-file .env.deploy -f docker-compose.vps.yml ps
echo ""
echo "Проверка: curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/ || true
echo ""
echo "Дальше: Nginx и Certbot — см. deploy/VPS.md"
