# Как правильно запускать проект LMS Platform

Чтобы не запутаться с базой данных и окружением, следуйте этой инструкции.

---

## Структура проекта (наглядно)

```
LMS platform - order/
├── backend/                    # Python FastAPI
│   ├── .env                    # ⚠️ НЕ коммитить! Здесь DATABASE_URL и ключи
│   ├── .env.example            # Шаблон — скопировать в .env при первом запуске
│   ├── .venv/                  # ✅ Виртуальное окружение Python (используйте его)
│   ├── education.db            # 📁 SQLite база при локальном запуске (создаётся автоматически)
│   ├── data/                   # Папка для данных (альтернативное место для DB в некоторых сценариях)
│   ├── uploads/                # Загруженные файлы (видео, аватары и т.д.)
│   ├── app/
│   │   ├── main.py             # Точка входа FastAPI
│   │   ├── core/
│   │   │   ├── config.py       # Читает .env, DATABASE_URL
│   │   │   └── database.py
│   │   └── ...
│   ├── requirements.txt
│   ├── init_db.py              # Создание таблиц (запустить один раз)
│   ├── seed_data.py            # Наполнение тестовыми данными
│   └── run-backend.sh          # Скрипт запуска бэкенда (использует .venv + education.db)
│
├── frontend-next/              # Next.js 16
│   ├── .env.local              # NEXT_PUBLIC_BASE_URL
│   ├── src/
│   │   ├── app/                # Страницы и layout
│   │   └── api/client.ts       # API клиент (запросы идут на /api → прокси на бэкенд)
│   ├── next.config.ts          # Прокси: /api/* → BACKEND_URL (по умолчанию localhost:8000)
│   ├── package.json
│   └── run-frontend.sh         # Скрипт запуска фронтенда
│
├── docker-compose.yml          # Docker: backend (8000) + frontend (3000), своя SQLite в volume
├── run-backend.sh              # Запуск бэкенда из корня (рекомендуется)
├── run-frontend.sh             # Запуск фронтенда из корня
├── start.sh                    # Запуск обоих серверов одной командой (использует .venv)
└── HOW_TO_RUN.md               # Этот файл
```

---

## Порты и URL

| Сервис   | Порт | URL (локально)           | Назначение                    |
|----------|------|--------------------------|-------------------------------|
| Backend  | 8000 | http://127.0.0.1:8000   | API, Swagger docs, uploads    |
| Frontend | 3000 | http://localhost:3000   | Сайт; запросы /api → бэкенд   |
| API Docs | 8000 | http://127.0.0.1:8000/docs | Swagger UI                 |

Фронтенд обращается к бэкенду через **прокси**: браузер ходит на `http://localhost:3000/api/...`, Next.js перенаправляет на `http://localhost:8000/api/...` (значение из `BACKEND_URL` в next.config, по умолчанию localhost:8000).

---

## Какая база данных и где

От того, **как** вы запускаете проект, зависит **какая** БД используется. Запуск «не той» БД — частая причина, когда «ничего не работает».

### 1. Локальный запуск (без Docker) — рекомендуемый способ

- **База:** один файл **SQLite** — `backend/education.db`.
- **Откуда берётся путь:** переменная **`DATABASE_URL`** в файле **`backend/.env`**.

Для локальной разработки в `backend/.env` должно быть:

```env
DATABASE_URL=sqlite:///./education.db
```

Не должно быть:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/education_platform
```

Если указан PostgreSQL, но сервер PostgreSQL не запущен или это другая БД — бэкенд не подключится к БД и будет падать или отдавать ошибки. Поэтому для обычного локального запуска всегда используйте SQLite, как выше.

- Файл `education.db` создаётся в папке **`backend/`** (путь разрешается от корня backend в `config.py`).
- Один раз нужно создать таблицы и данные:
  - `python init_db.py`
  - `python seed_data.py`
  - при необходимости: `python seed_shop.py`, `python seed_mock_progress.py`, `python seed_real_students_progress.py`

### 2. Запуск через Docker

- **База:** тоже **SQLite**, но лежит **внутри Docker volume** `backend_db`, в контейнере по пути `/app/data/education.db`.
- В `docker-compose.yml` задано: `DATABASE_URL: sqlite:///./data/education.db` и `volumes: backend_db:/app/data`.
- Это **отдельная** база от вашей локальной `backend/education.db`. Данные в Docker не пересекаются с локальной разработкой.

Итого:

| Режим        | Где БД                          | Файл / том              |
|-------------|----------------------------------|--------------------------|
| Локально    | На хосте, в папке backend        | `backend/education.db`   |
| Docker      | В контейнере backend, volume     | volume `backend_db`      |

---

## Что внутри PostgreSQL и что внутри SQLite?

**Схема одна и та же** — приложение (SQLAlchemy) создаёт одни и те же таблицы и в PostgreSQL, и в SQLite. Меняется только то, *где* хранятся данные:

- **PostgreSQL** — когда в `backend/.env` указано `DATABASE_URL=postgresql://...`. Данные лежат на сервере PostgreSQL (например, `localhost:5432`, база `education_platform`). Удобно для продакшена, несколько процессов могут подключаться к одной БД.
- **SQLite** — когда указано `DATABASE_URL=sqlite:///./education.db`. Вся БД — один файл `backend/education.db`. Удобно для разработки, не нужен отдельный сервер.

**Содержимое (таблицы)** в обоих случаях одинаковое, например:

| Таблица | Назначение |
|---------|------------|
| `users` | Пользователи (админ, учителя, студенты, родители) |
| `courses`, `course_modules`, `course_topics` | Курсы и структура (модули, темы) |
| `course_enrollments` | Записи на курсы |
| `student_progress` | Прогресс по темам, видео |
| `tests`, `test_questions` | Тесты и вопросы |
| `certificates` | Сертификаты |
| `payments` | Платежи |
| `shop_items`, `user_purchases`, `cart_items` | Магазин, корзина, покупки |
| `notifications` | Уведомления |
| `ai_chat_history`, `ai_challenges` | AI-чат и челленджи |
| `course_reviews` | Отзывы о курсах |
| `study_schedule`, `student_goals` | Расписание и цели |
| `teacher_groups`, `group_students`, `teacher_assignments` | Группы, задания преподавателей |
| `course_applications` | Заявки на курсы |
| и др. | (всего ~30+ таблиц) |

Итого: **в PostgreSQL и в SQLite хранятся одни и те же сущности**; разница только в способе хранения (сервер БД vs один файл).

---

## Чек-лист перед запуском (чтобы не запустить «не ту» БД)

1. **Режим:** вы запускаете **локально** или через **Docker**?
2. **Локально:**
   - Откройте **`backend/.env`**.
   - Проверьте: `DATABASE_URL=sqlite:///./education.db` (без postgresql).
   - Убедитесь, что используете виртуальное окружение **`backend/.venv`** (см. ниже).
3. **Docker:**
   - Не трогайте `backend/.env` для БД — в Docker используется переменная из `docker-compose.yml`.
4. После смены `DATABASE_URL` или первого клонирования в backend выполните:
   - `python init_db.py`
   - при необходимости `python seed_data.py` (и остальные seed-скрипты по желанию).

---

## Как правильно запускать

### Вариант A: Два терминала (рекомендуется)

**Терминал 1 — бэкенд:**

```bash
./run-backend.sh
```

Либо вручную:

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
# Проверьте .env: DATABASE_URL=sqlite:///./education.db
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Терминал 2 — фронтенд:**

```bash
./run-frontend.sh
```

Либо вручную:

```bash
cd frontend-next
npm install   # если ещё не ставили
npm run dev
```

- Backend: http://127.0.0.1:8000 (документация: http://127.0.0.1:8000/docs)
- Frontend: http://localhost:3000

### Вариант B: Один скрипт (оба сервера)

Из корня проекта:

```bash
./start.sh
```

Скрипт запускает backend через **`backend/.venv`** и фронтенд через `npm run dev`. Остановка: Ctrl+C (скрипт остановит оба процесса).

### Вариант C: Docker

```bash
docker compose up -d --build
```

- Backend: http://localhost:8000  
- Frontend: http://localhost:3000  
- БД — своя, в volume (не `backend/education.db`).

---

## Важные файлы конфигурации

| Файл                 | Назначение                                                                 |
|----------------------|----------------------------------------------------------------------------|
| `backend/.env`       | DATABASE_URL, SECRET_KEY, API-ключи, CORS (ALLOWED_ORIGINS), SMTP и т.д.  |
| `backend/.env.example` | Шаблон; по умолчанию SQLite для демо. PostgreSQL — см. закомментированную строку в файле. |
| `frontend-next/.env.local` | NEXT_PUBLIC_BASE_URL (и при необходимости EMAIL_*) |
| `frontend-next/next.config.ts` | BACKEND_URL для прокси (по умолчанию http://localhost:8000)            |

---

## Если «ничего не работает»

1. **Проверьте `backend/.env`:**
   - Для локального запуска: `DATABASE_URL=sqlite:///./education.db`.
2. **Проверьте, что бэкенд видит нужную БД:**
   - В папке `backend/` после первого запуска должен появиться (или уже быть) файл `education.db`.
3. **Порты:**
   - 8000 — свободен для бэкенда, 3000 — для фронтенда.
   - Проверка: `curl http://127.0.0.1:8000/` → ответ с сообщением API.
4. **Окружение бэкенда:**
   - Используйте один venv: предпочтительно **`.venv`** (`source backend/.venv/bin/activate` или `./run-backend.sh`).
5. **Таблицы и данные:**
   - Выполните в `backend/`: `python init_db.py`, затем `python seed_data.py`.

После этого перезапустите бэкенд и откройте http://localhost:3000.
