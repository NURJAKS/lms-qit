# Развёртывание LMS на VPS (Docker + Nginx + HTTPS)

Пошаговая инструкция для разворачивания LMS платформы **Qazaq IT Academy** на VPS сервере.  
Проект: **Жандос Сахиев**.

---

## Требования

- **VPS**: Ubuntu 22.04+ (root или sudo)
- **Домен**: DNS A-запись → IP вашего сервера (например `qazaqitacademy-edu.pp.ua`)
- **Минимум**: 1 vCPU, 1 GB RAM, 10 GB SSD

---

## Шаг 1. Установка Docker

```bash
apt update && apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Проверка:
```bash
docker compose version
# Docker Compose version v2.x.x
```

---

## Шаг 2. Клонирование проекта

```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/NURJAKS/lms-platfrom-localversion.git
cd lms-platfrom-localversion
```

---

## Шаг 3. Настройка переменных окружения

```bash
cp env.deploy.example .env.deploy
nano .env.deploy
```

**Обязательно заполните:**

| Переменная | Что указать | Пример |
|------------|-------------|--------|
| `SECRET_KEY` | Случайная строка (32+ символов) | `openssl rand -hex 32` → вставить результат |
| `POSTGRES_PASSWORD` | Надёжный пароль БД (без `@`, `:`, `#`) | `MyStr0ngP@ss2026` |
| `ALLOWED_ORIGINS` | Ваш домен с https | `https://qazaqitacademy-edu.pp.ua,https://www.qazaqitacademy-edu.pp.ua` |
| `FRONTEND_PUBLIC_URL` | Ваш домен с https | `https://qazaqitacademy-edu.pp.ua` |

**Опционально:**

| Переменная | Описание |
|------------|----------|
| `OPENAI_API_KEY` | Ключ OpenAI для ИИ-чата и AI Challenge (без ключа — демо-режим) |
| `GEMINI_API_KEY` | Ключ Google Gemini (альтернатива OpenAI) |
| `LMS_SKIP_ENTRYPOINT_SEED` | `1` — пропустить демо-данные при старте (нужно после импорта SQLite) |
| `SMTP_HOST`, `SMTP_USER`, ... | Для отправки email-уведомлений |

> **⚠️ Файл `.env.deploy` НЕ коммитить в git** (уже в `.gitignore`).

---

## Шаг 4. Запуск контейнеров

### Вариант A: Быстрый старт (демо-данные)

Если вам **не нужны данные из SQLite** (будут созданы демо-пользователи):

```bash
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
```

Демо-аккаунты после первого запуска:
- **admin@edu.kz** / `admin123` (администратор)
- Другие пользователи из `seed_data.py`

### Вариант B: С переносом данных из SQLite (рекомендуется)

Если у вас есть файл `education.db` с реальными данными:

```bash
# 1. Скопируйте education.db на сервер (например через scp):
# scp education.db root@ваш-ip:~/projects/lms-platfrom-localversion/

# 2. Запустите миграцию (поднимет только PostgreSQL, перельёт данные):
chmod +x deploy/migrate-sqlite-to-pg.sh
./deploy/migrate-sqlite-to-pg.sh ~/projects/lms-platfrom-localversion/education.db

# 3. Установите пропуск демо-данных в .env.deploy:
#    LMS_SKIP_ENTRYPOINT_SEED=1

# 4. Запустите полный стек:
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
```

### Проверка

```bash
# Статус контейнеров (должны быть healthy/running):
docker compose --env-file .env.deploy -f docker-compose.vps.yml ps

# Проверка HTTP (должен вернуть 200):
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/

# Логи бэкенда:
docker compose --env-file .env.deploy -f docker-compose.vps.yml logs backend --tail=30
```

**Архитектура портов:**
- **Frontend** (Next.js) — `3000` на хосте (единственный публичный порт)
- **Backend** (FastAPI) — `8000` внутри Docker-сети (НЕ выставлен наружу)
- **PostgreSQL** — `5432` внутри Docker-сети (НЕ выставлен наружу)
- API для браузера: через тот же домен `/api/*` → Next.js проксирует к backend

---

## Шаг 5. Nginx (reverse proxy)

```bash
apt install -y nginx
cp deploy/nginx-qazaqitacademy.example.conf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua
ln -sf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua /etc/nginx/sites-enabled/
```

Если при `nginx -t` ошибка `could not build server_names_hash`, в `/etc/nginx/nginx.conf` добавьте внутри `http {`:
```nginx
server_names_hash_bucket_size 64;
```

Проверка и запуск:
```bash
nginx -t && systemctl reload nginx
```

Теперь сайт доступен по HTTP: `http://qazaqitacademy-edu.pp.ua`

---

## Шаг 6. HTTPS (Certbot)

Когда `http://ваш-домен` открывается (DNS дошёл):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d qazaqitacademy-edu.pp.ua -d www.qazaqitacademy-edu.pp.ua
```

Certbot автоматически настроит Nginx для HTTPS и автопродление сертификата.

---

## Шаг 7. Файрвол (рекомендуется)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## Обновление проекта

Когда вы обновили код и запушили в GitHub:

```bash
cd ~/projects/lms-platfrom-localversion
git pull
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
```

Данные сохраняются в Docker-томах (`lms_postgres_data`, `lms_uploads`).

---

## Основные команды

```bash
# Статус
docker compose --env-file .env.deploy -f docker-compose.vps.yml ps

# Логи (все / отдельный сервис)
docker compose --env-file .env.deploy -f docker-compose.vps.yml logs -f --tail=100
docker compose --env-file .env.deploy -f docker-compose.vps.yml logs -f backend

# Перезапуск
docker compose --env-file .env.deploy -f docker-compose.vps.yml restart

# Остановка
docker compose --env-file .env.deploy -f docker-compose.vps.yml down

# Полный сброс (удалит ВСЕ данные!)
docker compose --env-file .env.deploy -f docker-compose.vps.yml down -v
```

---

## Типичные проблемы

| Симптом | Решение |
|---------|---------|
| `backend is unhealthy` | `docker compose ... logs backend --tail=200` — часто нет `SECRET_KEY` или `POSTGRES_PASSWORD` |
| CORS ошибка в браузере | `ALLOWED_ORIGINS` должен точно совпадать с URL: `https://ваш-домен` |
| 502 Bad Gateway | Контейнер frontend не запустился: `docker compose ... ps` |
| 504 на `/api/...` (ИИ) | Nginx таймаут — проверьте `proxy_read_timeout 300s;` в конфиге Nginx |
| ИИ в демо-режиме | Нет API ключей — добавьте `OPENAI_API_KEY` или `GEMINI_API_KEY` в `.env.deploy` |
| Порт 3000 занят | В `docker-compose.vps.yml` замените `"3000:3000"` на `"3010:3000"` и в Nginx: `proxy_pass http://127.0.0.1:3010` |
| Данные пропали после обновления | Данные в Docker-томах. Если volumes удалили (`down -v`), нужна повторная миграция |

---

## Резервное копирование

```bash
# Бэкап PostgreSQL
docker compose --env-file .env.deploy -f docker-compose.vps.yml exec -T db \
  pg_dump -U lms education_platform > ~/lms-backup-$(date +%F).sql

# Бэкап uploads
docker run --rm -v lms-platfrom-localversion_lms_uploads:/data:ro -v ~:/backup alpine \
  tar czf /backup/lms-uploads-$(date +%F).tar.gz -C /data .

# Восстановление PostgreSQL (при необходимости)
cat ~/lms-backup-YYYY-MM-DD.sql | docker compose --env-file .env.deploy -f docker-compose.vps.yml \
  exec -T db psql -U lms education_platform
```

---

Учебный проект: **Жандос Сахиев** · Qazaq IT Academy LMS Platform
