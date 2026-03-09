#!/usr/bin/env python3
"""Add image_url column to courses. Run: python3 migrate_course_images.py"""
import sqlite3
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
cur.execute("PRAGMA table_info(courses)")
cols = [r[1] for r in cur.fetchall()]
if "image_url" not in cols:
    cur.execute("ALTER TABLE courses ADD COLUMN image_url VARCHAR(500)")
    print("Added courses.image_url")
conn.commit()
conn.close()
print("Migration done.")
