@echo off
cd /d "%~dp0\..\frontend-next"
echo === Frontend (Next.js): установка и запуск...
call npm install
call npm run dev
