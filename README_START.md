# 🚀 Быстрый старт проекта

## Вариант 1: Автоматический запуск (рекомендуется)

Используйте готовый скрипт:

```bash
./start.sh
```

Этот скрипт автоматически:
- Проверит наличие зависимостей
- Запустит backend на порту 8000
- Запустит frontend на порту 3000
- Покажет ссылки для доступа

---

## Вариант 2: Ручной запуск

### Шаг 1: Запуск Backend

Откройте терминал и выполните:

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

✅ Backend будет доступен на: `http://127.0.0.1:8000`

---

### Шаг 2: Запуск Frontend

Откройте **новый терминал** и выполните:

```bash
cd frontend-next
npm run dev
```

✅ Frontend будет доступен на: `http://localhost:3000`

---

### Шаг 3: Откройте приложение

Откройте браузер и перейдите на:
```
http://localhost:3000
```

---

## Проверка работы

### Проверка Backend:
```bash
curl http://127.0.0.1:8000/
# Ожидаемый ответ: {"message":"Education Platform API","docs":"/docs"}
```

### Проверка Frontend:
```bash
curl http://localhost:3000/
# Должен вернуть HTML страницу
```

### Проверка API через прокси:
```bash
curl http://localhost:3000/api/courses?is_active=true
# Должен вернуть JSON с курсами
```

---

## Остановка серверов

В каждом терминале нажмите `Ctrl+C`

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
- **API Документация:** http://127.0.0.1:8000/docs

---

## Требования

- Python 3.12+
- Node.js 20.9.0+
- npm

---

Подробная инструкция: см. файл `START.md`
