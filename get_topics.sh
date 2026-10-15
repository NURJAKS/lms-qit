docker exec lms-qit-db-1 pg_restore -a -t course_topics -f /tmp/topics.sql /tmp/lms_backup.dump
docker exec lms-qit-db-1 cat /tmp/topics.sql
