#!/usr/bin/env python3
"""
Миграция: payment_method, application_id в payments.
Запустить: python migrate_payment_application.py
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
        print("DB not found.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

cur.execute("PRAGMA table_info(payments)")
cols = [r[1] for r in cur.fetchall()]
if "payment_method" not in cols:
    cur.execute("ALTER TABLE payments ADD COLUMN payment_method VARCHAR(20)")
    print("Added payments.payment_method")
if "application_id" not in cols:
    cur.execute("ALTER TABLE payments ADD COLUMN application_id INTEGER REFERENCES course_applications(id) ON DELETE SET NULL")
    print("Added payments.application_id")

conn.commit()
conn.close()
print("Migration done.")
