# LMS Platform

Образовательная платформа (MVP) с AI-помощником и геймификацией.

**Стек:** Backend — Python (FastAPI, SQLAlchemy, SQLite). Frontend — Next.js 16, React 19, TypeScript, Tailwind CSS.

## Требования

- Python 3.12+
- Node.js 20.9.0+
- Git

## Установка и запуск

> **Подробная инструкция:** [HOW_TO_RUN.md](HOW_TO_RUN.md) — структура проекта, порты, какая БД где, чек-лист перед запуском (чтобы не запустить не ту БД).

### Демо-режим (быстрый показ, диплом, клиент)

1. **`backend/.env` в репозиторий не попадает** — только шаблон `backend/.env.example`. Один раз скопируйте и при необходимости впишите ключи (для демо без AI можно оставить пустыми `OPENAI_API_KEY` / `GEMINI_API_KEY`):

   ```bash
   cp backend/.env.example backend/.env
   ```

2. В репозитории может лежать **небольшая демо-БД** `backend/education.db` и папка **`backend/uploads/`** — чтобы проверяющий открыл проект без длинной цепочки `seed_*`. Если файла БД нет или нужен чистый срез — выполните шаг «Backend» ниже (init + seed).

3. Из корня: **`bash start.sh`** — поднимет backend и frontend (если нет `backend/.env`, скрипт скопирует его из `.env.example`).

### 1. Клонирование

```bash
git clone https://github.com/NURJAKS/LMS-Platform-client.git
cd LMS-Platform-client
```

### 2. Backend

**Важно:** Путь к SQLite задаётся в `backend/.env` (`DATABASE_URL`, по умолчанию в `.env.example` — `backend/education.db`). Запускать можно из корня проекта или из `backend/`.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # обязательно перед первым запуском; секреты не коммитить
python init_db.py
python seed_data.py
python seed_shop.py
python seed_mock_progress.py
python seed_real_students_progress.py
# Запуск (из папки backend):
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Если пользователи уже есть, но нет курсов: `python seed_data.py --courses-only`.

API: http://127.0.0.1:8000  
Документация: http://127.0.0.1:8000/docs

### 3. Frontend

В новом терминале:

```bash
cd frontend-next
npm install
npm run dev
```

Приложение: http://localhost:3000

### Быстрый запуск (из корня проекта)

```bash
./run-backend.sh    # в одном терминале
./run-frontend.sh   # в другом терминале
```

Бэкенд будет использовать `backend/.venv` и базу **`backend/education.db`** независимо от того, из какой папки запущен.

## Тестовые пользователи

Создаются скриптом `seed_data.py`. Если при логине «Неверный email или пароль» или в каталоге нет курсов — **перезапустите бэкенд** из папки `backend` (или через `./run-backend.sh`), чтобы он использовал базу `backend/education.db`. Убедитесь, что выполнены `python init_db.py` и `python seed_data.py`.

| Роль           | Email            | Пароль     |
|----------------|------------------|------------|
| Администратор  | admin@edu.kz     | admin123   |
| Директор       | director@edu.kz   | director123 |
| Куратор        | curator@edu.kz    | curator123  |
| Преподаватель  | teacher1@edu.kz  | teacher123 |
| Преподаватель  | teacher2@edu.kz  | teacher123 |
| Родитель       | parent@edu.kz    | parent123  |
| Студент        | student1@edu.kz … student5@edu.kz | student123 |

## Структура

- `backend/` — FastAPI, модели, API, скрипты БД
- `frontend-next/` — Next.js: страницы, компоненты, API-клиент

## Docker

```bash
docker compose up -d --build
```

Backend: http://localhost:8000  
Frontend: http://localhost:3000

## Важно

- **`backend/.env` не коммитится** — в git только `backend/.env.example`; реальные ключи и пароли только у себя локально.
- **`backend/education.db`** и **`backend/uploads/`** для демо можно держать в репозитории (маленький объём, только тестовые данные, без личных данных реальных людей).
- Для полного сброса БД повторите команды из шага 2 (init_db, seed_*).
- **Локальный запуск без Docker:** бэкенд и фронт запускаются отдельно (см. шаги 2 и 3). Docker не обязателен.
