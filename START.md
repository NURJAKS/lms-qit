# Инструкция по запуску проекта локально

## Предварительные требования

- Python 3.12+
- Node.js 20.9.0+
- npm или yarn

## Пошаговая инструкция

### 1. Запуск Backend сервера

Откройте первый терминал и выполните:

```bash
# Перейдите в директорию backend
cd backend

# Активируйте виртуальное окружение
source venv/bin/activate

# Запустите сервер
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend будет доступен по адресу: `http://127.0.0.1:8000`

**Проверка работы backend:**
```bash
curl http://127.0.0.1:8000/
# Должен вернуть: {"message":"Education Platform API","docs":"/docs"}
```

---

### 2. Запуск Frontend сервера

Откройте второй терминал и выполните:

```bash
# Перейдите в директорию frontend-next
cd frontend-next

# Установите зависимости (если еще не установлены)
npm install

# Запустите dev сервер
npm run dev
```

Frontend будет доступен по адресу: `http://localhost:3000`

**Проверка работы frontend:**
```bash
curl http://localhost:3000/
# Должен вернуть HTML страницу
```

---

### 3. Открытие приложения

Откройте браузер и перейдите по адресу:
```
http://localhost:3000
```

---

## Быстрый запуск (одной командой)

Если хотите запустить оба сервера одновременно, используйте:

### Вариант 1: Два отдельных терминала

**Терминал 1 (Backend):**
```bash
cd backend && source venv/bin/activate && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Терминал 2 (Frontend):**
```bash
cd frontend-next && npm run dev
```

### Вариант 2: Использование screen или tmux

**С screen:**
```bash
# Создайте сессию для backend
screen -S backend
cd backend && source venv/bin/activate && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# Нажмите Ctrl+A затем D для отсоединения

# Создайте сессию для frontend
screen -S frontend
cd frontend-next && npm run dev
# Нажмите Ctrl+A затем D для отсоединения

# Вернуться к сессии: screen -r backend или screen -r frontend
```

---

## Проверка статуса серверов

### Проверка портов
```bash
# Проверить, какие порты заняты
ss -tuln | grep -E "(8000|3000)"
```

### Проверка процессов
```bash
# Проверить запущенные процессы
ps aux | grep -E "(uvicorn|next)" | grep -v grep
```

### Тест API через прокси
```bash
# Проверить проксирование API через frontend
curl http://localhost:3000/api/courses?is_active=true
```

---

## Остановка серверов

### Остановка Backend
В терминале с backend нажмите `Ctrl+C`

### Остановка Frontend
В терминале с frontend нажмите `Ctrl+C`

### Принудительная остановка по портам
```bash
# Остановить процесс на порту 8000
lsof -ti:8000 | xargs kill -9

# Остановить процесс на порту 3000
lsof -ti:3000 | xargs kill -9
```

---

## Возможные проблемы

### Backend не запускается

1. **Проверьте виртуальное окружение:**
   ```bash
   cd backend
   source venv/bin/activate
   python --version  # Должно быть Python 3.12+
   ```

2. **Установите зависимости:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Проверьте .env файл:**
   ```bash
   cd backend
   cat .env  # Убедитесь, что файл существует
   ```

### Frontend не запускается

1. **Установите зависимости:**
   ```bash
   cd frontend-next
   npm install
   ```

2. **Проверьте версию Node.js:**
   ```bash
   node --version  # Должно быть >= 20.9.0
   ```

### Проблемы с проксированием API

1. **Проверьте next.config.ts:**
   - Убедитесь, что `BACKEND_URL` указывает на `http://localhost:8000`
   - Или установите переменную окружения: `export BACKEND_URL=http://localhost:8000`

2. **Перезапустите frontend** после изменения конфигурации

---

## Полезные команды

### Просмотр логов backend
Логи отображаются в терминале, где запущен backend

### Просмотр логов frontend
Логи отображаются в терминале, где запущен frontend

### API документация
После запуска backend, откройте в браузере:
```
http://127.0.0.1:8000/docs
```

---

## Структура проекта

```
LMS platform - order/
├── backend/              # FastAPI backend
│   ├── app/
│   ├── venv/            # Виртуальное окружение Python
│   ├── .env             # Конфигурация backend
│   └── requirements.txt # Зависимости Python
│
└── frontend-next/       # Next.js frontend
    ├── src/
    ├── node_modules/    # Зависимости Node.js
    └── package.json     # Конфигурация frontend
```
