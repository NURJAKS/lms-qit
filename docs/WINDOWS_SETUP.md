# Запуск на Windows (git или zip)

Краткая инструкция для проверяющего или коллеги: SQLite-демо, без обязательного Docker.

## Что установить

1. **Python 3.12+** — [python.org](https://www.python.org/downloads/), при установке включите **Add python.exe to PATH**.
2. **Node.js 20.9+** — [nodejs.org](https://nodejs.org/) (LTS).
3. **Git** (если клонируете репозиторий) — [Git for Windows](https://git-scm.com/download/win) (опционально даёт Git Bash).

Проверка в PowerShell:

```powershell
python --version
node --version
```

Если `python` не находится, попробуйте `py -3 --version` (launcher Windows).

## Куда распаковать проект

- Лучше **короткий путь на латинице**, например `C:\dev\lms-platform`.
- Избегайте **очень длинных путей** и вложенных архивов «zip внутри zip» — распакуйте так, чтобы рядом в корне лежали папки `backend` и `frontend-next`.

## Быстрый старт (рекомендуется)

1. Откройте **PowerShell** в корне проекта (папка, где лежат `backend`, `frontend-next`, `start-windows.ps1`).
2. При первой ошибке политики выполнения:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

3. Запуск **одной командой** (поднимет API на :8000 и Next.js на :3000):

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
   ```

   Или двойной клик по **`start-windows.cmd`**.

Скрипт сам: создаст `backend\.venv`, установит зависимости, при отсутствии файла скопирует `backend\.env.example` → `backend\.env`, затем запустит серверы.

Откройте в браузере: **http://localhost:3000** (фронт), **http://127.0.0.1:8000/docs** (Swagger).

Остановка: в окне PowerShell **Ctrl+C** (фронт остановится, процесс бэкенда скрипт завершит).

## Два окна (удобно отлаживать)

- Окно 1 — только бэкенд:

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start-backend-windows.ps1
  ```

- Окно 2 — только фронт:

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start-frontend-windows.ps1
  ```

Из папки `scripts` также можно вызвать **`start-backend.bat`** и **`start-frontend.bat`** — они вызывают те же сценарии (SQLite + `.venv`).

**Не путать:** сценарий с PostgreSQL в Docker — `scripts\start-backend-docker-postgres.bat` (нужен Docker и настройка `DATABASE_URL` под Postgres).

## Файл окружения и ИИ

- Секреты не в git. Первый запуск создаёт **`backend\.env`** из **`backend\.env.example`**.
- **ИИ (чат):** в `backend\.env` задайте **`OPENAI_API_KEY`** и/или **`GEMINI_API_KEY`**.  
  Если оба пустые, приложение **не падает** — в чате будет демо-сообщение о том, что ключ не настроен.
- Приоритет в коде: если задан OpenAI-ключ, используется OpenAI; иначе при наличии ключа — Gemini.

## База данных (SQLite)

- Вся демо-БД — один файл **`backend\education.db`** (путь задаётся в `DATABASE_URL` в `backend\.env`, по умолчанию `sqlite:///./education.db`).
- В репозитории файл может уже лежать — тогда отдельно ничего инициализировать не нужно.
- Если файл удалён или повреждён, в PowerShell из **корня** репозитория:

  ```powershell
  cd backend
  .\.venv\Scripts\python.exe init_db.py
  .\.venv\Scripts\python.exe seed_data.py
  ```

  При необходимости — остальные скрипты из README (`seed_shop.py` и т.д.), тоже из папки `backend`.

## Порты и брандмауэр

- **8000** — backend, **3000** — Next.js. Они должны быть свободны.
- Windows Firewall может спросить доступ для Python/Node при первом запуске — разрешите для локальной сети.

## Zip вместо git

Распакуйте архив полностью, сохраняя структуру. Убедитесь, что не потерялись **`backend\education.db`** и папка **`backend\uploads`** (если они были в архиве). Запуск — те же `start-windows.cmd` или шаги выше.

Если антивирус блокирует `.db` или файлы в `.venv`, добавьте папку проекта в исключения или восстановите БД через `init_db.py` + `seed_data.py`.

## Проблемы

- **Порт занят** — закройте другой процесс на 8000/3000 или смените порт фронта в `package.json` / бэкенда в аргументах uvicorn (и при необходимости `BACKEND_URL` / прокси в Next).
- **`execution of scripts is disabled`** — `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` или запуск через `powershell -ExecutionPolicy Bypass -File ...`.

Подробности по структуре проекта и Docker — [HOW_TO_RUN.md](../HOW_TO_RUN.md).
