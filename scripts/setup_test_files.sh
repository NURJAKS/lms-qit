#!/bin/bash
# Копирует тестовые файлы в uploads для проверки
set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$REPO_ROOT/backend"
mkdir -p "$BACKEND/uploads/videos/course1" "$BACKEND/uploads/certificates"
VIDEO_SRC="${HOME}/Downloads/Python in 100 Seconds.mp4"
if [ -f "$VIDEO_SRC" ]; then
  cp "$VIDEO_SRC" "$BACKEND/uploads/videos/course1/intro.mp4"
  echo "Video copied to uploads/videos/course1/intro.mp4"
fi
if [ -f "$REPO_ROOT/image.png" ]; then
  cp "$REPO_ROOT/image.png" "$BACKEND/uploads/certificates/image.png"
  echo "Certificate image copied to uploads/certificates/image.png"
fi
