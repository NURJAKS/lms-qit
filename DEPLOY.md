# Развёртывание на VPS (Docker)

Этот репозиторий готов к продакшену через **Docker Compose**: PostgreSQL, FastAPI, Next.js. API снаружи не обязательно открывать — браузер ходит на **`/api/*` через Next.js** (см. `frontend-next/next.config.ts`).

## Быстрый старт на сервере

1. **Установите Docker** (см. пошагово в [deploy/VPS.md](deploy/VPS.md)).

2. **Клонируйте репозиторий** (этот же проект, ветка `main`):

   ```bash
   git clone https://github.com/NURJAKS/lms-platform-deployed.git
   cd lms-platform-deployed
   ```

3. **Создайте `.env.deploy`** из шаблона и заполните секреты:

   ```bash
   cp env.deploy.example .env.deploy
   nano .env.deploy
   ```

   Обязательно: `SECRET_KEY`, `POSTGRES_PASSWORD`, `ALLOWED_ORIGINS`, `FRONTEND_PUBLIC_URL`.

4. **Поднимите стек**:

   ```bash
   docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
   ```

5. **Проверка**:

   ```bash
   docker compose --env-file .env.deploy -f docker-compose.vps.yml ps
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
   ```

6. **Nginx + HTTPS** — см. [deploy/VPS.md](deploy/VPS.md) (шаги 5–6).

## Перенос данных из SQLite (`education.db`)

Если нужны данные из файла `education.db` (лежит в репозитории в `backend/education.db` или у вас своя копия):

```bash
scp backend/education.db user@сервер:~/projects/lms-platform-deployed/
# на сервере:
chmod +x deploy/migrate-sqlite-to-pg.sh
./deploy/migrate-sqlite-to-pg.sh ~/projects/lms-platform-deployed/education.db
```

В `.env.deploy` добавьте **`LMS_SKIP_ENTRYPOINT_SEED=1`**, затем снова:

```bash
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
```

Подробности и типичные ошибки — в [deploy/VPS.md](deploy/VPS.md).

## Локально «как на VPS» + автоимпорт SQLite

```bash
cp env.local-prod.example .env.local-prod
docker compose -p lms-local --env-file .env.local-prod \
  -f docker-compose.vps.yml -f docker-compose.local-prod.yml up -d --build
```

Сайт: http://localhost:3000 · Swagger: http://localhost:8001/docs

## Файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.vps.yml` | Прод: db + backend + frontend |
| `docker-compose.local-prod.yml` | Надстройка: импорт `backend/education.db` в Postgres |
| `docker-compose.yml` | Упрощённый вариант с Postgres (для разработки) |
| `env.deploy.example` | Шаблон `.env.deploy` (не коммитить `.env.deploy`) |
| `deploy/VPS.md` | Полная инструкция: Docker, Nginx, Certbot, бэкапы |
| `deploy/migrate-sqlite-to-pg.sh` | Скрипт миграции SQLite → PostgreSQL |
