docker exec lms-qit-db-1 pg_restore -a -t teacher_materials -f /tmp/materials.sql /tmp/lms_backup.dump
docker exec lms-qit-db-1 cat /tmp/materials.sql
