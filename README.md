# LMS Platform

Образовательная платформа (MVP). **Автор учебного проекта:** Жандос Сахиев.

В репозитории уже есть демо-БД (`backend/education.db`) и `backend/uploads/`. Файл `backend/.env` в git не входит — при первом запуске копируется из `backend/.env.example`.

**Стек:** FastAPI, SQLite · Next.js, TypeScript, Tailwind.

---

## Запуск на Windows

### 1. Что установить

| Что | Зачем |
|-----|--------|
| **Python 3.12+** | бэкенд ([python.org/downloads](https://www.python.org/downloads/) — включите **Add python.exe to PATH**) |
| **Node.js 20.9+** | фронтенд ([nodejs.org](https://nodejs.org/) LTS) |
| **Git** (по желанию) | клонирование ([git-scm.com/download/win](https://git-scm.com/download/win)) |

В PowerShell: `python --version` и `node --version`. Если нет `python`, попробуйте `py -3 --version`.

Распакуйте или клонируйте проект в **короткий путь на латинице** (например `C:\dev\lms-platform`), в корне должны лежать папки **`backend`** и **`frontend-next`**.

Освободите порты **8000** и **3000**. Брандмауэр может запросить доступ для Python и Node — разрешите для частной сети.

### 2. Получить код

```powershell
cd C:\dev
git clone https://github.com/NURJAKS/lms-platfrom-localversion.git
cd lms-platfrom-localversion
```

Или скачайте ZIP с GitHub и распакуйте так же.

### 3. Запуск одной командой

1. PowerShell в **корне** проекта (рядом с `start-windows.ps1`, папками `backend` и `frontend-next`).

2. При ошибке политики скриптов (один раз):

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

3. Запуск:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
   ```

   Либо двойной щелчок по **`start-windows.cmd`**.

Скрипт создаст `backend\.venv`, установит зависимости, при необходимости скопирует **`backend\.env.example` → `backend\.env`**, затем **автоматически выполнит bootstrap БД** (`create_all + миграции + seed при пустой БД`) и запустит API + фронт.

4. В браузере: **http://localhost:3000** · Swagger: **http://127.0.0.1:8000/docs**

Остановка: **Ctrl+C** в том же окне.

### 4. Два окна (отдельный лог бэкенда)

**Окно 1 — API**

```powershell
powershell -ExecutionPolicy Bypass -File .\start-backend-windows.ps1
```

**Окно 2 — фронт**

```powershell
powershell -ExecutionPolicy Bypass -File .\start-frontend-windows.ps1
```

В `scripts\` есть **`start-backend.bat`** и **`start-frontend.bat`** (то же самое).

### 5. Секреты и база

- **`backend\.env`** — не коммитится; шаблон: **`backend\.env.example`**.
- **ИИ (чат):** при необходимости укажите **`OPENAI_API_KEY`** и/или **`GEMINI_API_KEY`**. Без ключей приложение работает в демо-режиме.
- **SQLite:** файл **`backend\education.db`**. Обычно руками делать ничего не нужно — `start-windows.ps1` сам выполняет bootstrap БД. Если хотите прогнать bootstrap отдельно:

  ```powershell
  cd backend
  .\.venv\Scripts\python.exe bootstrap_db.py
  ```

### 6. Тестовые входы

| Роль | Email | Пароль |
|------|--------|--------|
| Администратор | admin@edu.kz | admin123 |
| Директор | director@edu.kz | director123 |
| Куратор | curator@edu.kz | curator123 |
| Преподаватель | teacher1@edu.kz, teacher2@edu.kz | teacher123 |
| Родитель | parent@edu.kz | parent123 |
| Студент | student1@edu.kz … student5@edu.kz | student123 |

---

## Docker: локально как прод (PostgreSQL)

Полный стек **как на VPS**, но на вашем компьютере. SQLite `education.db` автоматически импортируется в PostgreSQL при каждом `up`.

```bash
# 1. Создать .env.local-prod (один раз):
cp env.local-prod.example .env.local-prod

# 2. Запуск (сборка + импорт SQLite → PG + backend + frontend):
docker compose -p lms-local --env-file .env.local-prod \
  -f docker-compose.vps.yml -f docker-compose.local-prod.yml up -d --build

# 3. Открыть:
#    http://localhost:3000      — сайт
#    http://localhost:8001/docs — Swagger API (DEBUG=true)
```

Логин: **email** + пароль (не username!). Пример: `zhandossahiev@gmail.com` / `zhandos123`.

Остановка и очистка:
```bash
docker compose -p lms-local --env-file .env.local-prod \
  -f docker-compose.vps.yml -f docker-compose.local-prod.yml down -v
```

---

## VPS (Linux-сервер, Docker)

Репозиторий для выкладки на сервер: **[NURJAKS/lms-platform-deployed](https://github.com/NURJAKS/lms-platform-deployed)** (тот же код, ориентир на Docker).

- Краткий чеклист: **[DEPLOY.md](DEPLOY.md)**
- Полная инструкция (Docker, Nginx, HTTPS, бэкапы): **[deploy/VPS.md](deploy/VPS.md)**

Кратко:
```bash
# На VPS:
git clone https://github.com/NURJAKS/lms-platform-deployed.git
cd lms-platform-deployed
cp env.deploy.example .env.deploy
nano .env.deploy           # SECRET_KEY, POSTGRES_PASSWORD, ALLOWED_ORIGINS, FRONTEND_PUBLIC_URL
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
```

Или автоматический bootstrap: `chmod +x deploy/bootstrap-vps.sh && ./deploy/bootstrap-vps.sh`

---

## Важно

- **`backend/.env`** и **`.env.deploy`** в репозиторий не добавляйте (в `.gitignore`).
- Логин в систему — по **email**, не по username.
- После **`git clone`** приходят те же **`education.db`** и **`uploads`**, что в коммите.
- **ИИ**: без ключей `OPENAI_API_KEY` / `GEMINI_API_KEY` чат и AI Challenge работают в демо-режиме.
