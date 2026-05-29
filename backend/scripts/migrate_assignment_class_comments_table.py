#!/usr/bin/env python3
"""
Создать таблицу assignment_class_comments (SQLite), если её ещё нет.
Запустить: python migrate_assignment_class_comments_table.py
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
        print("DB not found. Tables will be created on first API run.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS assignment_class_comments (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT,
        FOREIGN KEY(assignment_id) REFERENCES teacher_assignments (id) ON DELETE CASCADE,
        FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """
)
conn.commit()
cur.execute("CREATE INDEX IF NOT EXISTS ix_assignment_class_comments_assignment_id ON assignment_class_comments (assignment_id)")
cur.execute("CREATE INDEX IF NOT EXISTS ix_assignment_class_comments_author_id ON assignment_class_comments (author_id)")
conn.commit()
conn.close()
print("assignment_class_comments table ready")
