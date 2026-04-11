# LMS Platform

Образовательная платформа (MVP) с AI-помощником и геймификацией.

**Автор учебного проекта:** Жандос Сахиев.

**Готовая коробка для проверки:** в репозитории уже есть демо-БД (`backend/education.db`) и `backend/uploads/`; секретный `backend/.env` не в git — при первом запуске копируется из `backend/.env.example`. Достаточно установить Python и Node, затем запустить проект (см. ниже) — отдельно поднимать БД и долгий `seed_*` не обязательно.

**Стек:** Backend — Python (FastAPI, SQLAlchemy, SQLite). Frontend — Next.js 16, React 19, TypeScript, Tailwind CSS.

---

## Запуск на Windows с нуля

### 1. Что подготовить на компьютере

| Что | Зачем | Где взять |
|-----|--------|-----------|
| **Python 3.12+** | бэкенд, виртуальное окружение | [python.org/downloads](https://www.python.org/downloads/) — при установке включите **Add python.exe to PATH** |
| **Node.js 20.9+** | фронтенд (npm) | [nodejs.org](https://nodejs.org/) (LTS) |
| **Git** (по желанию) | клонирование репозитория | [git-scm.com/download/win](https://git-scm.com/download/win) |

Проверка в **PowerShell** (`Win + X` → Терминал / PowerShell):

```powershell
python --version
node --version
```

Если команды `python` нет, попробуйте `py -3 --version` (стандартный launcher Windows).

**Папка проекта:** распакуйте или клонируйте в **короткий путь на латинице**, например `C:\dev\lms-platform`. Избегайте очень длинных путей и «архива внутри архива» — в корне должны лежать папки **`backend`** и **`frontend-next`** рядом с файлами `start-windows.cmd`, `start-windows.ps1`.

**Порты:** освободите **8000** (API) и **3000** (сайт). При первом запуске брандмауэр Windows может спросить доступ для Python/Node — разрешите для частной сети.

---

### 2. Получить код

**Вариант A — Git**

```powershell
cd C:\dev
git clone https://github.com/NURJAKS/lms-platfrom-done.git
cd lms-platfrom-done
```

**Вариант B — ZIP**  
Скачайте архив с GitHub, распакуйте так же, чтобы внутри был корень проекта с `backend` и `frontend-next`.

---

### 3. Запуск одной командой (рекомендуется)

1. Откройте **PowerShell** в **корне** проекта (там, где лежат `start-windows.cmd` и папки `backend`, `frontend-next`).

2. Если PowerShell ругается на политику скриптов (один раз на пользователя):

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

3. Запустите:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
   ```

   Или **двойной щелчок** по файлу **`start-windows.cmd`**.

Скрипт сам: создаст `backend\.venv`, установит зависимости Python и npm, при отсутствии файла скопирует **`backend\.env.example` → `backend\.env`**, поднимет API и фронт.

4. Откройте в браузере:

   - приложение: **http://localhost:3000**
   - Swagger API: **http://127.0.0.1:8000/docs**

Остановка: в окне терминала **Ctrl+C** (скрипт также завершит процесс бэкенда).

---

### 4. Запуск в двух окнах (если нужен отдельный лог бэкенда)

**Окно 1 — только API**

```powershell
powershell -ExecutionPolicy Bypass -File .\start-backend-windows.ps1
```

**Окно 2 — только фронт**

```powershell
powershell -ExecutionPolicy Bypass -File .\start-frontend-windows.ps1
```

Из папки `scripts` можно вызывать **`start-backend.bat`** и **`start-frontend.bat`** (то же самое).

---

### 5. Секреты, ИИ и база

- **`backend\.env`** в git **не входит**; при первом запуске он создаётся из **`backend\.env.example`**.
- **ИИ (чат):** в `backend\.env` при необходимости укажите **`OPENAI_API_KEY`** и/или **`GEMINI_API_KEY`**. Без ключей приложение **не падает** — показывается демо-сообщение.
- **База SQLite:** один файл **`backend\education.db`**. В репозитории он уже может быть — тогда отдельно ничего не запускайте. Если файл удалён или повреждён:

  ```powershell
  cd backend
  .\.venv\Scripts\python.exe init_db.py
  .\.venv\Scripts\python.exe seed_data.py
  ```

  Дополнительные скрипты при необходимости: `seed_shop.py`, `seed_mock_progress.py`, `seed_real_students_progress.py` (из папки `backend`, тот же Python из `.venv`).

Подробнее: [docs/WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md).

---

### 6. Тестовые входы (после `seed_data.py`)

| Роль | Email | Пароль |
|------|--------|--------|
| Администратор | admin@edu.kz | admin123 |
| Преподаватель | teacher1@edu.kz | teacher123 |
| Студент | student1@edu.kz | student123 |

(полный список см. ниже в разделе «Тестовые пользователи»)

---

## Linux / macOS

Из корня репозитория:

```bash
cp backend/.env.example backend/.env   # при необходимости
bash start.sh
```

Или два терминала: `./run-backend.sh` и `./run-frontend.sh`.

---

## Установка вручную (все ОС)

**Backend** (из папки `backend`):

```bash
python3 -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python init_db.py
python seed_data.py
python seed_shop.py
python seed_mock_progress.py
python seed_real_students_progress.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend** (второй терминал, папка `frontend-next`):

```bash
npm install
npm run dev
```

API: http://127.0.0.1:8000 — документация: http://127.0.0.1:8000/docs  
Приложение: http://localhost:3000

Если курсов нет: `python seed_data.py --courses-only`.

---

## Тестовые пользователи

Создаются `seed_data.py`. Если логин не проходит — убедитесь, что бэкенд запущен и использует `backend/education.db`.

| Роль | Email | Пароль |
|------|--------|--------|
| Администратор | admin@edu.kz | admin123 |
| Директор | director@edu.kz | director123 |
| Куратор | curator@edu.kz | curator123 |
| Преподаватель | teacher1@edu.kz, teacher2@edu.kz | teacher123 |
| Родитель | parent@edu.kz | parent123 |
| Студент | student1@edu.kz … student5@edu.kz | student123 |

---

## Структура репозитория

- `backend/` — FastAPI, модели, API, SQLite, скрипты БД  
- `frontend-next/` — Next.js: страницы, компоненты, прокси `/api` на бэкенд  
- `start-windows.cmd` / `start-windows.ps1` — быстрый старт на Windows  
- `docs/WINDOWS_SETUP.md` — доп. детали (zip, порты, ошибки)  
- [HOW_TO_RUN.md](HOW_TO_RUN.md) — порты, Docker, где какая БД

---

## Docker (необязательно)

```bash
docker compose up -d --build
```

Backend: http://localhost:8000 — Frontend: http://localhost:3000  

Для обычного демо на Windows Docker **не нужен**.

---

## Важно

- **`backend/.env` не коммитится** — только шаблон `backend/.env.example`.
- После **`git clone`** у вас те же **`education.db`** и **`uploads`**, что в последнем коммите (если они в репозитории); ваши личные ключи в git не попадают.
- Полный сброс БД: снова выполните `init_db.py` и `seed_*.py` из раздела «вручную».
