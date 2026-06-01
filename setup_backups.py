import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

script = """
mkdir -p /root/projects/lms-qit/backups
cat << 'BSCRIPT' > /root/projects/lms-qit/backup_db.sh
#!/bin/bash
# Автоматический бэкап базы данных LMS
BACKUP_DIR="/root/projects/lms-qit/backups"
DATE=\$(date +"%Y-%m-%d_%H-%M-%S")
CONTAINER_NAME="lms-qit-db-1"
DB_USER="lms_user"
DB_NAME="lms_db"

echo "Creating backup for \${DATE}..."
docker exec \${CONTAINER_NAME} pg_dump -U \${DB_USER} -d \${DB_NAME} -F c -f /tmp/db_backup.dump
docker cp \${CONTAINER_NAME}:/tmp/db_backup.dump \${BACKUP_DIR}/lms_backup_\${DATE}.dump

# Удаляем бэкапы старше 7 дней
find \${BACKUP_DIR} -name "lms_backup_*.dump" -type f -mtime +7 -exec rm {} \\;
echo "Backup \${DATE} completed."
BSCRIPT
chmod +x /root/projects/lms-qit/backup_db.sh

# Добавляем в cron (каждый день в 03:00 ночи)
(crontab -l 2>/dev/null | grep -v "backup_db.sh" ; echo "0 3 * * * /root/projects/lms-qit/backup_db.sh >> /root/projects/lms-qit/backups/backup.log 2>&1") | crontab -
crontab -l
"""

print("Setting up backups on VPS...")
child.sendline(script)
child.expect('# ')
print(child.before.decode('utf-8'))

# Выполним первый бэкап прямо сейчас для проверки
print("Running first backup...")
child.sendline('/root/projects/lms-qit/backup_db.sh')
child.expect('# ')
print(child.before.decode('utf-8'))

child.sendline('ls -la /root/projects/lms-qit/backups')
child.expect('# ')
print(child.before.decode('utf-8'))

