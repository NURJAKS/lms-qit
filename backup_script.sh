#!/bin/bash
mkdir -p /root/projects/lms-qit/backups

cat << 'BSCRIPT' > /root/projects/lms-qit/backup_db.sh
#!/bin/bash
BACKUP_DIR="/root/projects/lms-qit/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
CONTAINER_NAME="lms-qit-db-1"
DB_USER="lms"
DB_NAME="education_platform"

echo "Creating backup for ${DATE}..."
docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -f /tmp/db_backup.dump
docker cp ${CONTAINER_NAME}:/tmp/db_backup.dump ${BACKUP_DIR}/lms_backup_${DATE}.dump

find ${BACKUP_DIR} -name "lms_backup_*.dump" -type f -mtime +7 -exec rm {} \;
echo "Backup ${DATE} completed."
BSCRIPT

chmod +x /root/projects/lms-qit/backup_db.sh
/root/projects/lms-qit/backup_db.sh
ls -la /root/projects/lms-qit/backups
