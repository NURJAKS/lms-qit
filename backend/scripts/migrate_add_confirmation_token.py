#!/usr/bin/env python3
"""
Миграция: добавление колонок confirmation_token и confirmed_at
в таблицу course_applications для подтверждения покупки через email.
Запустить: python migrate_add_confirmation_token.py
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

cur.execute("PRAGMA table_info(course_applications)")
cols = [r[1] for r in cur.fetchall()]

if "confirmation_token" not in cols:
    cur.execute("ALTER TABLE course_applications ADD COLUMN confirmation_token VARCHAR(100)")
    print("Added course_applications.confirmation_token")

if "confirmed_at" not in cols:
    cur.execute("ALTER TABLE course_applications ADD COLUMN confirmed_at DATETIME")
    print("Added course_applications.confirmed_at")

conn.commit()
conn.close()
print("Migration done.")
