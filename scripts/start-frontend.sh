#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../frontend-next"
echo "=== Установка зависимостей и запуск frontend (Next.js)..."
npm install
npm run dev
