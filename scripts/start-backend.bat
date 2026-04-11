@echo off
REM Default: SQLite + backend\.venv (same as README / start-windows.cmd).
REM For Docker + PostgreSQL use: scripts\start-backend-docker-postgres.bat
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\start-backend-windows.ps1"
pause
