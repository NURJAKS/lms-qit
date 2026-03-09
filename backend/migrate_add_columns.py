#!/usr/bin/env python3
"""
Миграция: добавление колонок published_at, is_moderated в courses,
создание таблицы payments, teacher_comment в assignment_submissions.
Запустить: python migrate_add_columns.py
"""
import sqlite3
from pathlib import Path

# Найти db файл
db_path = Path(__file__).parent / "education.db"
if not db_path.exists():
    # Попробовать из .env или по умолчанию
    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./education.db")
    if "sqlite" in db_url:
        db_path = Path(db_url.replace("sqlite:///", "")).resolve()
    if not db_path.exists():
        print("DB not found. Tables will be created on first run.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

# Проверить и добавить колонки в courses
cur.execute("PRAGMA table_info(courses)")
cols = [r[1] for r in cur.fetchall()]
if "published_at" not in cols:
    cur.execute("ALTER TABLE courses ADD COLUMN published_at DATETIME")
    print("Added courses.published_at")
if "is_moderated" not in cols:
    cur.execute("ALTER TABLE courses ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
    print("Added courses.is_moderated")

# Проверить assignment_submissions
cur.execute("PRAGMA table_info(assignment_submissions)")
cols = [r[1] for r in cur.fetchall()]
if "teacher_comment" not in cols:
    cur.execute("ALTER TABLE assignment_submissions ADD COLUMN teacher_comment TEXT")
    print("Added assignment_submissions.teacher_comment")

# Проверить users
cur.execute("PRAGMA table_info(users)")
cols = [r[1] for r in cur.fetchall()]
if "phone" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(50)")
    print("Added users.phone")
if "birth_date" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN birth_date DATE")
    print("Added users.birth_date")
if "address" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN address VARCHAR(500)")
    print("Added users.address")
if "city" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN city VARCHAR(100)")
    print("Added users.city")
if "points" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0")
    print("Added users.points")
if "is_premium" not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0")
    print("Added users.is_premium")

# Таблица payments - create_all создаст при первом запуске
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payments'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            amount NUMERIC(10,2) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            payment_method VARCHAR(20),
            application_id INTEGER REFERENCES course_applications(id) ON DELETE SET NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created payments table")
else:
    # Проверить дополнительные колонки в payments
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
