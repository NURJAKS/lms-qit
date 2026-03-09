#!/bin/bash
# Копирует тестовые файлы в uploads для проверки
set -e
BACKEND="$(dirname "$0")/../backend"
mkdir -p "$BACKEND/uploads/videos/course1" "$BACKEND/uploads/certificates"
if [ -f "/home/nurjaks/Downloads/Python in 100 Seconds.mp4" ]; then
  cp "/home/nurjaks/Downloads/Python in 100 Seconds.mp4" "$BACKEND/uploads/videos/course1/intro.mp4"
  echo "Video copied to uploads/videos/course1/intro.mp4"
fi
if [ -f "/home/nurjaks/Development/LMS platform - order/image.png" ]; then
  cp "/home/nurjaks/Development/LMS platform - order/image.png" "$BACKEND/uploads/certificates/image.png"
  echo "Certificate image copied to uploads/certificates/image.png"
fi
