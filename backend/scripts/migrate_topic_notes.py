#!/usr/bin/env python3
"""Миграция: topic_notes для персональных заметок Premium пользователей к темам. Запустить: python3 migrate_topic_notes.py"""
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

# topic_notes
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_notes'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE topic_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            topic_id INTEGER NOT NULL REFERENCES course_topics(id) ON DELETE CASCADE,
            note_text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
        )
    """)
    cur.execute("CREATE INDEX ix_topic_notes_user_id ON topic_notes(user_id)")
    cur.execute("CREATE INDEX ix_topic_notes_topic_id ON topic_notes(topic_id)")
    # Уникальный индекс: один пользователь - одна заметка на тему
    cur.execute("CREATE UNIQUE INDEX ix_topic_notes_user_topic ON topic_notes(user_id, topic_id)")
    print("Created topic_notes table with indexes")

conn.commit()
conn.close()
print("Migration done.")
