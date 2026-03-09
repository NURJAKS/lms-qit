"""Добавляет колонку is_premium_only в courses."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import engine

db_url = str(engine.url)
with engine.connect() as conn:
    has_column = False
    if "sqlite" in db_url:
        result = conn.execute(text("PRAGMA table_info(courses)"))
        for row in result:
            if row[1] == "is_premium_only":
                has_column = True
                break
    else:
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'courses' AND column_name = 'is_premium_only'
        """))
        has_column = result.fetchone() is not None
    if not has_column:
        conn.execute(text("ALTER TABLE courses ADD COLUMN is_premium_only INTEGER DEFAULT 0"))
        conn.commit()
        print("Колонка is_premium_only добавлена в courses.")
    else:
        print("Колонка is_premium_only уже существует.")
    print("Миграция premium_courses завершена.")
