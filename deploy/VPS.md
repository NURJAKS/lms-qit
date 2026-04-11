# Развёртывание LMS на VPS (Docker + Nginx + HTTPS)

Домен и DNS должны указывать на IP сервера (записи **A** для `@` и `www`). Дальше — команды для **Ubuntu 22.04+** (root или `sudo`).

---

## 1. Docker Engine

```bash
apt update && apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker compose version
```

---

## 2. Клонирование и переменные окружения

```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/NURJAKS/lms-platfrom-localversion.git
cd lms-platfrom-localversion

cp env.deploy.example .env.deploy
nano .env.deploy
```

Обязательно:

| Переменная | Значение |
|------------|----------|
| `SECRET_KEY` | `openssl rand -hex 32` — вставьте вывод |
| `ALLOWED_ORIGINS` | `https://qazaqitacademy-edu.pp.ua,https://www.qazaqitacademy-edu.pp.ua` (при отладке можно добавить `,http://localhost:3000`) |
| `FRONTEND_PUBLIC_URL` | `https://qazaqitacademy-edu.pp.ua` |

Ключи `OPENAI_API_KEY` / `GEMINI_API_KEY` — по желанию.

Файл `.env.deploy` **не коммитьте** (уже в `.gitignore`).

---

## 3. Запуск контейнеров

Из **корня** репозитория (где лежат `docker-compose.vps.yml` и `.env.deploy`):

```bash
chmod +x deploy/bootstrap-vps.sh
./deploy/bootstrap-vps.sh
```

Скрипт при отсутствии `.env.deploy` создаст его из примера и подставит случайный `SECRET_KEY`.

Или вручную:

```bash
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
docker compose --env-file .env.deploy -f docker-compose.vps.yml ps
```

Проверка локально на сервере:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/
```

Должен вернуться код **200** (или 307/302).

- **Фронт** слушает **3000** на хосте (Next.js).
- **Бэкенд** (:8000) **не** пробрасывается наружу — нет конфликта с другим проектом на порту 8000. API для браузера — через тот же домен (`/api` проксирует Next).

Если порт **3000** занят — в `docker-compose.vps.yml` замените у `frontend` строку портов на `"3010:3000"` и в Nginx (шаг 4) укажите `proxy_pass http://127.0.0.1:3010`.

---

## 4. Nginx (reverse proxy)

```bash
apt install -y nginx
cp deploy/nginx-qazaqitacademy.example.conf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua
ln -sf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Убедитесь, что в конфиге `proxy_pass` совпадает с портом фронта (3000 или 3010).

---

## 5. HTTPS (Certbot)

Когда по **HTTP** сайт открывается по домену (DNS уже «дошёл»):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d qazaqitacademy-edu.pp.ua -d www.qazaqitacademy-edu.pp.ua
```

После выпуска сертификата в `.env.deploy` должны быть **https://** в `ALLOWED_ORIGINS` (как в примере). Затем:

```bash
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d
```

---

## 6. Файрвол (по желанию)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Прямой доступ к порту 3000 с интернета не обязателен — достаточно 80/443 через Nginx.

---

## 7. Обновление версии

```bash
cd ~/projects/lms-platfrom-localversion
git pull
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build
```

Данные БД и `uploads` хранятся в Docker-томах (`lms_sqlite_data`, `lms_uploads`).

---

## 8. Логи и отладка

```bash
docker compose --env-file .env.deploy -f docker-compose.vps.yml logs -f --tail=100
```

Отдельно бэкенд / фронт:

```bash
docker compose --env-file .env.deploy -f docker-compose.vps.yml logs -f backend
docker compose --env-file .env.deploy -f docker-compose.vps.yml logs -f frontend
```

---

## Типичные проблемы

| Симптом | Что проверить |
|---------|----------------|
| `dependency failed to start: container … backend … is unhealthy` | Логи бэкенда: `docker compose --env-file .env.deploy -f docker-compose.vps.yml logs backend --tail=200`. Часто — пустой/битый `.env.deploy`, нет `SECRET_KEY`, или ошибка SQLite. После правок: `docker compose … up -d --force-recreate backend`. |
| CORS / «blocked by CORS» | `ALLOWED_ORIGINS` содержит **точный** origin из адресной строки (с `https://` и при необходимости `www`). |
| 502 Bad Gateway | Контейнер фронта не слушает: `docker compose ps`, `curl 127.0.0.1:3000`. Порт в Nginx = порт в compose. |
| Другой проект на :8000 | Нормально: бэкенд LMS не публикует 8000 на хост. |
| Swagger | Откройте `https://ваш-домен/docs` — запрос идёт через фронт/прокси к API. |
| `buildx isn't installed` | Предупреждение можно игнорировать или: `apt install -y docker-buildx-plugin`. |

---

Учебный проект: **Жандос Сахиев**.
