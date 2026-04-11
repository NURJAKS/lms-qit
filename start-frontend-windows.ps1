#Requires -Version 5.1
# Запуск только Next.js. Бэкенд должен быть на :8000. Из корня репозитория:
#   powershell -ExecutionPolicy Bypass -File .\start-frontend-windows.ps1
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$fe = Join-Path $Root "frontend-next"

if (-not (Test-Path (Join-Path $fe "package.json"))) {
    Write-Error "frontend-next not found. Run from repository root."
    exit 1
}

Set-Location $fe
if (-not (Test-Path "node_modules")) {
    Write-Host "npm install..."
    npm install
}
Write-Host "Frontend: http://localhost:3000"
npm run dev
