# 🎓 LMS Platform — образовательная платформа

MVP образовательной платформы с AI-помощником и геймификацией.

**Стек:** Backend — Python (FastAPI, SQLAlchemy, SQLite). Frontend — Next.js 16, React 19, TypeScript, Tailwind.

---

## 📋 Что нужно установить заранее

- **Python 3.12+** — [python.org](https://www.python.org/downloads/)
- **Node.js 20.9.0+** — [nodejs.org](https://nodejs.org/)
- **npm** (идёт вместе с Node.js)
- **Git** — чтобы клонировать репозиторий

Проверка в терминале:

```bash
python3 --version   # должно быть 3.12 или выше
node --version      # v20.9.0 или выше
npm --version
```

---

## 🚀 Запуск проекта локально (пошагово)

### Шаг 1. Клонировать репозиторий

```bash
git clone https://github.com/NURJAKS/LMS-Platform-client.git
cd LMS-Platform-client
```

### Шаг 2. Backend — виртуальное окружение и зависимости

```bash
cd backend
python3 -m venv venv
```

**Активация venv:**

- Linux / macOS:
  ```bash
  source venv/bin/activate
  ```
- Windows (cmd):
  ```cmd
  venv\Scripts\activate.bat
  ```
- Windows (PowerShell):
  ```powershell
  venv\Scripts\Activate.ps1
  ```

После активации в начале строки должно появиться `(venv)`.

Установка зависимостей:

```bash
pip install -r requirements.txt
```

### Шаг 3. Backend — база данных и тестовые данные

В той же папке `backend` (с активированным `venv`):

```bash
mkdir -p data
python init_db.py
python seed_data.py
python seed_shop.py
python seed_mock_progress.py
python seed_real_students_progress.py
```

Если появятся сообщения вроде «уже есть» или «skip» — это нормально.

### Шаг 4. Backend — переменные окружения (по желанию)

Скопировать пример и при необходимости отредактировать:

```bash
cp .env.example .env
```

Для локального запуска можно оставить значения по умолчанию. Для работы AI и почты позже нужно будет указать свои ключи в `.env`.

### Шаг 5. Запуск backend-сервера

В папке `backend` с активированным `venv`:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Оставьте этот терминал открытым. Backend будет доступен по адресу: **http://127.0.0.1:8000**  
Документация API: **http://127.0.0.1:8000/docs**

### Шаг 6. Frontend — в новом терминале

Откройте второй терминал и перейдите в папку проекта, затем во frontend:

```bash
cd LMS-Platform-client
cd frontend-next
npm install
npm run dev
```

Оставьте и этот терминал открытым. Frontend будет доступен по адресу: **http://localhost:3000**

### Шаг 7. Открыть приложение

В браузере откройте: **http://localhost:3000**

---

## 👤 Тестовые пользователи (после выполнения шага 3)

| Роль          | Email           | Пароль    |
|---------------|-----------------|-----------|
| Менеджер      | admin@edu.kz    | admin123  |
| Преподаватель | teacher1@edu.kz | teacher123 |
| Студент       | student1@edu.kz | student123 |

---

## 🛑 Остановка

- В каждом терминале, где запущены backend или frontend, нажмите **Ctrl+C**.

Или завершить процессы по портам:

```bash
# Linux/macOS
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

---

## ✅ Проверка, что всё работает

- Backend: в браузере откройте http://127.0.0.1:8000 — должна быть надпись про API; http://127.0.0.1:8000/docs — страница Swagger.
- Frontend: http://localhost:3000 — открывается главная страница платформы.
- Вход: используйте любой логин/пароль из таблицы выше на http://localhost:3000.

---

## 📁 Структура проекта

- `backend/` — API (FastAPI), модели, сервисы, скрипты БД.
- `frontend-next/` — Next.js: страницы, компоненты, store, api.

---

## 🐳 Запуск через Docker (альтернатива)

Если установлен Docker и Docker Compose:

```bash
docker compose up -d --build
```

Backend: http://localhost:8000  
Frontend: http://localhost:3000  

---

## 📌 Важно

- Файл **`.env`** в `backend/` не попадает в репозиторий (в нём могут быть секреты). Для примера используется **`.env.example`**.
- База SQLite хранится в `backend/data/education.db`. Её не коммитят в Git.
- При сбросе БД заново выполните команды из **Шага 3**.
