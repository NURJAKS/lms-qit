#!/bin/bash
docker exec lms-qit-db-1 psql -U lms -d education_platform -c "
DELETE FROM teacher_assignments;
DELETE FROM assignment_submissions;
DELETE FROM assignment_submission_grades;
DELETE FROM assignment_class_comments;
DELETE FROM assignment_private_comments;
DELETE FROM teacher_assignment_rubrics;
DELETE FROM teacher_materials;
DELETE FROM teacher_questions;
DELETE FROM teacher_question_answers;
DELETE FROM teacher_question_class_comments;
DELETE FROM topic_synopsis_submissions;
DELETE FROM material_private_comments;
VACUUM;
"
