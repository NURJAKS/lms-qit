#!/usr/bin/env python3
"""Миграция: добавление колонки points в users. Запустить: python migrate_points.py"""
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
cur.execute("PRAGMA table_info(users)")
cols = [r[1] for r in cur.fetchall()]
if "points" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0")
    print("Added users.points")
conn.commit()
conn.close()
print("Migration done.")
