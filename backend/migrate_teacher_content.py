#!/usr/bin/env python3
"""
Миграция: video_urls, test_id в teacher_assignments;
таблицы teacher_materials, teacher_questions, teacher_question_answers.
"""
import sqlite3
import json
from pathlib import Path

db_path = Path(__file__).parent / "education.db"
if not db_path.exists():
    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./education.db")
    if "sqlite" in db_url:
        db_path = Path(db_url.replace("sqlite:///", "")).resolve()
    if not db_path.exists():
        print("DB not found.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

# teacher_assignments
cur.execute("PRAGMA table_info(teacher_assignments)")
cols = [r[1] for r in cur.fetchall()]
if "video_urls" not in cols:
    cur.execute("ALTER TABLE teacher_assignments ADD COLUMN video_urls TEXT")
    print("Added teacher_assignments.video_urls")
if "test_id" not in cols:
    cur.execute("ALTER TABLE teacher_assignments ADD COLUMN test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL")
    print("Added teacher_assignments.test_id")

# teacher_materials
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_materials'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE teacher_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            group_id INTEGER NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            topic_id INTEGER REFERENCES course_topics(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            video_urls TEXT,
            image_urls TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created teacher_materials table")

# teacher_questions
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_questions'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE teacher_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            group_id INTEGER NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            question_type VARCHAR(20) NOT NULL DEFAULT 'single_choice',
            options TEXT,
            correct_option VARCHAR(10),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created teacher_questions table")

# teacher_question_answers
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_question_answers'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE teacher_question_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL REFERENCES teacher_questions(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            answer_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created teacher_question_answers table")

conn.commit()
conn.close()
print("Migration done.")
