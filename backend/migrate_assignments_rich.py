#!/usr/bin/env python3
"""
Миграция: topic_id, max_points, attachment_urls, attachment_links в teacher_assignments;
file_urls в assignment_submissions; таблицы teacher_assignment_rubrics, assignment_submission_grades.
Запустить: python migrate_assignments_rich.py
"""
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "education.db"
if not db_path.exists():
    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./education.db")
    if "sqlite" in db_url:
        db_path = Path(db_url.replace("sqlite:///", "")).resolve()
    if not db_path.exists():
        print("DB not found. Tables will be created on first run.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

# teacher_assignments
cur.execute("PRAGMA table_info(teacher_assignments)")
cols = [r[1] for r in cur.fetchall()]
if "topic_id" not in cols:
    cur.execute("ALTER TABLE teacher_assignments ADD COLUMN topic_id INTEGER REFERENCES course_topics(id) ON DELETE SET NULL")
    print("Added teacher_assignments.topic_id")
if "max_points" not in cols:
    cur.execute("ALTER TABLE teacher_assignments ADD COLUMN max_points INTEGER DEFAULT 100")
    print("Added teacher_assignments.max_points")
if "attachment_urls" not in cols:
    cur.execute("ALTER TABLE teacher_assignments ADD COLUMN attachment_urls TEXT")
    print("Added teacher_assignments.attachment_urls")
if "attachment_links" not in cols:
    cur.execute("ALTER TABLE teacher_assignments ADD COLUMN attachment_links TEXT")
    print("Added teacher_assignments.attachment_links")

# assignment_submissions
cur.execute("PRAGMA table_info(assignment_submissions)")
cols = [r[1] for r in cur.fetchall()]
if "file_urls" not in cols:
    cur.execute("ALTER TABLE assignment_submissions ADD COLUMN file_urls TEXT")
    print("Added assignment_submissions.file_urls")

# teacher_assignment_rubrics
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_assignment_rubrics'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE teacher_assignment_rubrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            max_points NUMERIC(5,2) NOT NULL
        )
    """)
    print("Created teacher_assignment_rubrics table")

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_assignment_rubrics'")
if cur.fetchone():
    cur.execute("PRAGMA table_info(teacher_assignment_rubrics)")
    rubric_cols = [r[1] for r in cur.fetchall()]
    if "description" not in rubric_cols:
        cur.execute("ALTER TABLE teacher_assignment_rubrics ADD COLUMN description TEXT")
        print("Added teacher_assignment_rubrics.description")
    if "levels_json" not in rubric_cols:
        cur.execute("ALTER TABLE teacher_assignment_rubrics ADD COLUMN levels_json TEXT")
        print("Added teacher_assignment_rubrics.levels_json")

# assignment_submission_grades
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assignment_submission_grades'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE assignment_submission_grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id INTEGER NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
            criterion_id INTEGER NOT NULL REFERENCES teacher_assignment_rubrics(id) ON DELETE CASCADE,
            points NUMERIC(5,2) NOT NULL
        )
    """)
    print("Created assignment_submission_grades table")

conn.commit()
conn.close()
print("Migration done.")
