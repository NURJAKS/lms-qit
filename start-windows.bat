@echo off
chcp 65001 >nul
title LMS Platform Runner
setlocal enabledelayedexpansion

echo ==========================================================
echo 🚀 LMS Platform Auto-Runner for Windows
echo ==========================================================
echo Этот скрипт подготовит окружение и запустит backend и frontend.
echo.

:: 1. Проверка Python
echo 🔍 Проверка Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [❌] Python не найден в системе.
    echo Попробуем установить Python через Windows Package Manager (winget)...
    where winget >nul 2>nul
    if !errorlevel! equ 0 (
        echo [📦] winget найден. Запускаю установку Python 3.12...
        winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 (
            echo [✅] Python успешно установлен! Пожалуйста, переоткройте этот файл еще раз.
            pause
            exit /b 0
        )
    )
    echo [🛑] Пожалуйста, скачайте и установите Python вручную: https://www.python.org/downloads/
    echo При установке ОБЯЗАТЕЛЬНО поставьте галочку "Add python.exe to PATH".
    pause
    exit /b 1
) else (
    echo [✅] Python найден.
)

:: 2. Проверка Node.js и npm
echo 🔍 Проверка Node.js и npm...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [❌] Node.js не найден в системе.
    echo Попробуем установить Node.js через Windows Package Manager (winget)...
    where winget >nul 2>nul
    if !errorlevel! equ 0 (
        echo [📦] winget найден. Запускаю установку Node.js LTS...
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 (
            echo [✅] Node.js успешно установлен! Пожалуйста, переоткройте этот файл еще раз.
            pause
            exit /b 0
        )
    )
    echo [🛑] Пожалуйста, скачайте и установите Node.js LTS вручную: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo [✅] Node.js найден.
)

:: 3. Подготовка конфигурации (Env)
echo 📂 Подготовка конфигурационных файлов .env...

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo [ℹ️] Создаю backend\.env из примера...
        copy "backend\.env.example" "backend\.env" >nul
    ) else (
        echo [⚠️] Внимание: файл backend\.env.example не найден. Создайте backend\.env вручную.
    )
)

if not exist "frontend-next\.env.local" (
    if exist "frontend-next\.env.example" (
        echo [ℹ️] Создаю frontend-next\.env.local из примера...
        copy "frontend-next\.env.example" "frontend-next\.env.local" >nul
    ) else (
        echo [⚠️] Внимание: файл frontend-next\.env.example не найден.
    )
)

:: 4. Настройка backend (.venv и pip)
echo 🐍 Настройка Backend (Python виртуальное окружение)...

if not exist "backend\.venv" (
    echo [📦] Создаю виртуальное окружение backend\.venv...
    python -m venv backend\.venv
    if !errorlevel! neq 0 (
        echo [❌] Ошибка при создании виртуального окружения.
        pause
        exit /b 1
    )
)

echo [📥] Установка Python зависимостей (pip)...
call backend\.venv\Scripts\activate.bat
python -m pip install --upgrade pip -q
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [❌] Не удалось установить backend зависимости.
    pause
    exit /b 1
)

:: 5. Накатка базы данных (bootstrap)
echo 🗄️ Инициализация базы данных SQLite...
cd backend
python bootstrap_db.py
if %errorlevel% neq 0 (
    echo [❌] Ошибка при инициализации базы данных.
    cd ..
    pause
    exit /b 1
)
cd ..

:: 6. Настройка frontend (npm install)
echo ⚛️ Настройка Frontend (React / Next.js)...
cd frontend-next
if not exist "node_modules" (
    echo [📥] Установка Node dependencies (npm install)...
    call npm install
    if !errorlevel! neq 0 (
        echo [❌] Не удалось установить frontend зависимости.
        cd ..
        pause
        exit /b 1
    )
)
cd ..

:: 7. Запуск сервисов
echo ==========================================================
echo 🎉 Все зависимости установлены и готовы к запуску!
echo ==========================================================
echo 🚀 Запускаю Backend и Frontend в отдельных окнах...
echo.

:: Запуск backend в новом окне
start "LMS Backend API (Port 8000)" cmd /k "cd backend && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Запуск frontend в новом окне
start "LMS Frontend Next.js (Port 3000)" cmd /k "cd frontend-next && npm run dev"

echo ✨ Проект успешно запущен!
echo ----------------------------------------------------------
echo 🌍 Доступ к сайту:   http://localhost:3000
echo 🔌 Доступ к API:     http://127.0.0.1:8000
echo 📖 Документация API: http://127.0.0.1:8000/docs
echo ----------------------------------------------------------
echo Для остановки серверов закройте открывшиеся терминалы.
echo.
pause
