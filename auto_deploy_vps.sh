#!/usr/bin/env bash
set -e

echo "======================================"
echo "Updating system and installing dependencies..."
echo "======================================"
apt update
apt install -y ca-certificates curl nginx certbot python3-certbot-nginx

# Install docker if not installed
if ! command -v docker &> /dev/null; then
    echo "======================================"
    echo "Installing Docker..."
    echo "======================================"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
else
    echo "Docker is already installed."
fi

echo "======================================"
echo "Setting up project..."
echo "======================================"
mkdir -p ~/projects
cd ~/projects
if [ -d "lms-qit" ]; then
    cd lms-qit
    git fetch
    git reset --hard origin/main
else
    git clone https://github.com/NURJAKS/lms-qit.git
    cd lms-qit
fi

echo "======================================"
echo "Creating .env.deploy..."
echo "======================================"
cat << 'ENVEOF' > .env.deploy
SECRET_KEY=dev-local-change-me-use-openssl-rand-hex-32

ALLOWED_ORIGINS=https://qazaqitacademy-edu.pp.ua,https://www.qazaqitacademy-edu.pp.ua,http://localhost:3000
FRONTEND_PUBLIC_URL=https://qazaqitacademy-edu.pp.ua

POSTGRES_USER=lms
POSTGRES_PASSWORD=your_production_secure_pass_here
POSTGRES_DB=education_platform

OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

LMS_SKIP_ENTRYPOINT_SEED=1

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM=your_email@gmail.com
SMTP_USE_TLS=true
ENVEOF

echo "======================================"
echo "Running DB Migration..."
echo "======================================"
if [ -f "/root/education.db" ]; then
    chmod +x deploy/migrate-sqlite-to-pg.sh
    ./deploy/migrate-sqlite-to-pg.sh /root/education.db
else
    echo "WARNING: /root/education.db not found. Skipping migration."
fi

echo "======================================"
echo "Starting Docker Compose..."
echo "======================================"
docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build

echo "======================================"
echo "Configuring Nginx..."
echo "======================================"
# Fix server names hash bucket size if needed
if ! grep -q "server_names_hash_bucket_size 64;" /etc/nginx/nginx.conf; then
    sed -i '/http {/a \    server_names_hash_bucket_size 64;' /etc/nginx/nginx.conf
fi

cp deploy/nginx-qazaqitacademy.example.conf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua
ln -sf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "======================================"
echo "Running Certbot (non-interactive)..."
echo "======================================"
certbot --nginx -d qazaqitacademy-edu.pp.ua -d www.qazaqitacademy-edu.pp.ua --non-interactive --agree-tos -m wennyqwerty4@gmail.com --redirect || echo "Certbot encountered an issue, but will continue."

echo "======================================"
echo "Deployment complete."
echo "======================================"
