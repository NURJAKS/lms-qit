FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt
COPY . .
# Копия демо-БД и uploads для первого запуска с томом (см. docker-compose.vps.yml, LMS_DATA_DIR)
RUN mkdir -p /opt/lms-bundled /app/data && \
    (cp -a education.db /opt/lms-bundled/education.db 2>/dev/null || true) && \
    (mkdir -p /opt/lms-bundled/uploads && \
     (cp -a uploads/. /opt/lms-bundled/uploads/ 2>/dev/null || true))
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
