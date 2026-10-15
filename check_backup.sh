docker exec lms-qit-db-1 pg_restore -U lms -d education_platform -a -t course_topics /tmp/lms_backup.dump > /tmp/topics.sql 2>&1
