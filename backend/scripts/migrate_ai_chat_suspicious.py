#!/usr/bin/env python3
"""
Миграция: добавление полей для отслеживания подозрительных запросов в ai_chat_history.
Поля: is_suspicious, test_id, assignment_id
Запустить: python migrate_ai_chat_suspicious.py
"""
import sqlite3
from pathlib import Path
import os

# Найти db файл
db_path = Path(__file__).parent / "education.db"
if not db_path.exists():
    db_url = os.getenv("DATABASE_URL", "sqlite:///./education.db")
    if "sqlite" in db_url:
        db_path = Path(db_url.replace("sqlite:///", "")).resolve()
    if not db_path.exists():
        print("DB not found. Tables will be created on first run.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

# Проверить и добавить колонки в ai_chat_history
cur.execute("PRAGMA table_info(ai_chat_history)")
cols = {r[1]: r for r in cur.fetchall()}

if "is_suspicious" not in cols:
    cur.execute("ALTER TABLE ai_chat_history ADD COLUMN is_suspicious BOOLEAN DEFAULT 0 NOT NULL")
    print("Added ai_chat_history.is_suspicious")

if "test_id" not in cols:
    cur.execute("ALTER TABLE ai_chat_history ADD COLUMN test_id INTEGER")
    print("Added ai_chat_history.test_id")
    # Добавляем внешний ключ, если таблица tests существует
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tests'")
        if cur.fetchone():
            # SQLite не поддерживает ADD CONSTRAINT, но мы можем создать индекс
            cur.execute("CREATE INDEX IF NOT EXISTS ix_ai_chat_history_test_id ON ai_chat_history(test_id)")
            print("Created index on ai_chat_history.test_id")
    except Exception as e:
        print(f"Note: Could not create index on test_id: {e}")

if "assignment_id" not in cols:
    cur.execute("ALTER TABLE ai_chat_history ADD COLUMN assignment_id INTEGER")
    print("Added ai_chat_history.assignment_id")
    # Добавляем индекс для assignment_id
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_assignments'")
        if cur.fetchone():
            cur.execute("CREATE INDEX IF NOT EXISTS ix_ai_chat_history_assignment_id ON ai_chat_history(assignment_id)")
            print("Created index on ai_chat_history.assignment_id")
    except Exception as e:
        print(f"Note: Could not create index on assignment_id: {e}")

conn.commit()
conn.close()
print("Migration done.")
