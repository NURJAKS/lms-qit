docker exec lms-qit-db-1 pg_restore -a -t teacher_materials /tmp/lms_backup.dump > /tmp/materials.sql
docker exec lms-qit-db-1 cat /tmp/materials.sql
