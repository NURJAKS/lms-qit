#Requires -Version 5.1
# Один запуск: backend (8000) + frontend (3000). Только Windows. Из корня репозитория:
#   powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
# Или двойной клик: start-windows.cmd
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Test-Path (Join-Path $Root "backend")) -or -not (Test-Path (Join-Path $Root "frontend-next"))) {
    Write-Error "Run from repository root (folders backend and frontend-next required)."
    exit 1
}

function Get-PythonLauncher {
    $candidates = @(
        (Get-Command "py" -ErrorAction SilentlyContinue),
        (Get-Command "python" -ErrorAction SilentlyContinue),
        (Get-Command "python3" -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ }
    if (-not $candidates) {
        throw "Python not found. Install 3.12+ from python.org and enable 'Add to PATH'."
    }
    return $candidates[0].Source
}

$venvDir = Join-Path $Root "backend\.venv"
$venvPy = Join-Path $venvDir "Scripts\python.exe"
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPy)) {
    Write-Host "Creating backend\.venv ..."
    $launcher = Get-PythonLauncher
    & $launcher -m venv $venvDir
    if (-not (Test-Path $venvPy)) {
        throw "Failed to create venv at $venvDir"
    }
}

$req = Join-Path $Root "backend\requirements.txt"
& $venvPy -m pip install --upgrade pip -q
& $venvPy -m pip install -r $req
if (-not (& $venvPy -c "import uvicorn" 2>$null)) {
    & $venvPy -m pip install -r $req
}

$envDest = Join-Path $Root "backend\.env"
if (-not (Test-Path $envDest)) {
    $envEx = Join-Path $Root "backend\.env.example"
    if (Test-Path $envEx) {
        Copy-Item $envEx $envDest
        Write-Host "Copied backend\.env.example -> backend\.env"
    }
}

$backendDir = Join-Path $Root "backend"
$feDir = Join-Path $Root "frontend-next"

Write-Host "Starting backend (uvicorn)..."
$beArgs = @(
    "-m", "uvicorn", "app.main:app",
    "--host", "127.0.0.1", "--port", "8000", "--reload"
)
$beProc = Start-Process -FilePath $venvPy -ArgumentList $beArgs -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 2

Set-Location $feDir
if (-not (Test-Path "node_modules")) {
    Write-Host "npm install (frontend)..."
    npm install
}

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Frontend: http://localhost:3000"
Write-Host "API docs: http://127.0.0.1:8000/docs"
Write-Host "Stop: close this window or press Ctrl+C (stops frontend; backend process will be closed)."
Write-Host ""

try {
    npm run dev
} finally {
    if ($beProc -and -not $beProc.HasExited) {
        Stop-Process -Id $beProc.Id -Force -ErrorAction SilentlyContinue
    }
}
