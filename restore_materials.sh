docker cp /root/projects/lms-qit/backups/lms_backup_2026-05-31_16-16-55.dump lms-qit-db-1:/tmp/lms_backup.dump
docker exec lms-qit-db-1 pg_restore -U lms -d education_platform -a -t teacher_materials /tmp/lms_backup.dump
docker exec lms-qit-db-1 psql -U lms -d education_platform -c "SELECT id, title, material_type, file_url FROM teacher_materials;"
