@echo off
REM Frontend only; backend must run on :8000 (start-windows.cmd or start-backend-windows.ps1).
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\start-frontend-windows.ps1"
pause
