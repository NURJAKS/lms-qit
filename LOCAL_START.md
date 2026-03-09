# 🚀 Локальный запуск проекта (без Docker и ngrok)

## Быстрый старт

### Вариант 1: Автоматический запуск (рекомендуется)

```bash
./start.sh
```

Этот скрипт автоматически запустит:
- ✅ Backend на `http://127.0.0.1:8000`
- ✅ Frontend на `http://localhost:3000`

---

### Вариант 2: Ручной запуск

#### 1. Запуск Backend

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

✅ Backend будет доступен на: `http://127.0.0.1:8000`

#### 2. Запуск Frontend (в новом терминале)

```bash
cd frontend-next
npm run dev
```

✅ Frontend будет доступен на: `http://localhost:3000`

---

## Проверка работы

### Backend:
```bash
curl http://127.0.0.1:8000/
# Ожидаемый ответ: {"message":"Education Platform API","docs":"/docs"}
```

### Frontend:
Откройте браузер: `http://localhost:3000`

### API через прокси:
```bash
curl http://localhost:3000/api/courses?is_active=true
```

---

## Остановка серверов

Нажмите `Ctrl+C` в каждом терминале

Или принудительно:
```bash
# Остановить backend
lsof -ti:8000 | xargs kill -9

# Остановить frontend  
lsof -ti:3000 | xargs kill -9
```

---

## Полезные ссылки

- **Frontend:** http://localhost:3000
- **Backend API:** http://127.0.0.1:8000
- **API Docs (Swagger):** http://127.0.0.1:8000/docs

---

## Примечания

- ✅ ngrok **отключен** - проект работает только локально
- ✅ Docker **не требуется** - используется локальный запуск
- ✅ Backend использует SQLite для разработки (файл `backend/education.db`)
- ✅ Все настройки уже сконфигурированы в `.env` файлах
