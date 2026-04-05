#!/usr/bin/env python3
"""
Миграция: student_private_comment в assignment_submissions.
Запустить: python migrate_assignment_student_private_comment.py
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

cur.execute("PRAGMA table_info(assignment_submissions)")
cols = [r[1] for r in cur.fetchall()]
if "student_private_comment" not in cols:
    cur.execute("ALTER TABLE assignment_submissions ADD COLUMN student_private_comment TEXT")
    conn.commit()
    print("Added assignment_submissions.student_private_comment")
else:
    print("assignment_submissions.student_private_comment already exists")

conn.close()
