#!/usr/bin/env python3
"""
Миграция: колонки city, parent_city в course_applications.
Запустить: cd backend && python migrate_course_application_city.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.core.database import engine


def migrate():
    with engine.connect() as conn:
        if "sqlite" in str(engine.url):
            result = conn.execute(text("PRAGMA table_info(course_applications)"))
            cols = [r[1] for r in result.fetchall()]
        else:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'course_applications' AND table_schema = 'public'
            """))
            cols = [r[0] for r in result.fetchall()]

        for col, sql_type in [
            ("city", "VARCHAR(100)"),
            ("parent_city", "VARCHAR(100)"),
        ]:
            if col not in cols:
                conn.execute(text(f"ALTER TABLE course_applications ADD COLUMN {col} {sql_type}"))
                conn.commit()
                print(f"Added course_applications.{col}")
            else:
                print(f"course_applications.{col} already exists")


if __name__ == "__main__":
    migrate()
    print("Migration done.")
