#!/usr/bin/env python3
"""
Миграция: description, levels_json в teacher_assignment_rubrics.
Запустить: python migrate_rubric_extended.py
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
        print("DB not found. Skip migration.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_assignment_rubrics'")
if not cur.fetchone():
    print("teacher_assignment_rubrics missing. Skip.")
    conn.close()
    exit(0)

cur.execute("PRAGMA table_info(teacher_assignment_rubrics)")
cols = [r[1] for r in cur.fetchall()]
if "description" not in cols:
    cur.execute("ALTER TABLE teacher_assignment_rubrics ADD COLUMN description TEXT")
    print("Added teacher_assignment_rubrics.description")
if "levels_json" not in cols:
    cur.execute("ALTER TABLE teacher_assignment_rubrics ADD COLUMN levels_json TEXT")
    print("Added teacher_assignment_rubrics.levels_json")

conn.commit()
conn.close()
print("Migration done.")
