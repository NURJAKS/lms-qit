# 🔗 Ссылки на запущенный проект

## ✅ Серверы запущены

### Frontend (Next.js)
- **Локальный доступ:** http://localhost:3000
- **Сетевой доступ:** http://192.168.32.244:3000

### Backend (FastAPI)
- **API:** http://127.0.0.1:8000
- **Документация API (Swagger):** http://127.0.0.1:8000/docs
- **Альтернативная документация (ReDoc):** http://127.0.0.1:8000/redoc

## 📋 Полезные ссылки

- **Главная страница:** http://localhost:3000
- **Каталог курсов:** http://localhost:3000/courses
- **Вход:** http://localhost:3000/login
- **Регистрация:** http://localhost:3000/register
- **Личный кабинет:** http://localhost:3000/app (требует авторизации)

## 🛑 Остановка серверов

```bash
# Остановить backend
kill $(cat /tmp/backend.pid)

# Остановить frontend
kill $(cat /tmp/frontend.pid)

# Или принудительно по портам
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```
