#Requires -Version 5.1
# Запуск только API (SQLite, backend\.venv). Из корня репозитория:
#   powershell -ExecutionPolicy Bypass -File .\start-backend-windows.ps1
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Test-Path (Join-Path $Root "backend\app\main.py"))) {
    Write-Error "Run this script from the repository root."
    exit 1
}

$venvPy = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Error "Missing backend\.venv. Run start-windows.ps1 once, or: python -m venv backend\.venv"
    exit 1
}

$envFile = Join-Path $Root "backend\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $Root "backend\.env.example") $envFile
    Write-Host "Copied backend\.env.example -> backend\.env"
}

Set-Location (Join-Path $Root "backend")
Write-Host "Backend: http://127.0.0.1:8000  (docs: http://127.0.0.1:8000/docs)"
& $venvPy -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
