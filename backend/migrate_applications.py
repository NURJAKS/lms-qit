#!/usr/bin/env python3
"""
Миграция: таблица course_applications, колонка users.is_approved.
Запустить: cd backend && python migrate_applications.py
"""
import os
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.core.database import engine
from app.models.course_application import CourseApplication
from app.core.database import Base


def migrate():
    # Create course_applications table
    CourseApplication.__table__.create(engine, checkfirst=True)
    print("Created course_applications table (if not exists)")

    # Add is_approved to users if not exists
    with engine.connect() as conn:
        if "sqlite" in str(engine.url):
            result = conn.execute(text("PRAGMA table_info(users)"))
            cols = [r[1] for r in result.fetchall()]
        else:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND table_schema = 'public'
            """))
            cols = [r[0] for r in result.fetchall()]

        if "is_approved" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT TRUE NOT NULL"))
            conn.commit()
            print("Added users.is_approved")
        else:
            print("users.is_approved already exists")

    # Add parent_* columns to course_applications if not exist
    with engine.connect() as conn:
        if "sqlite" in str(engine.url):
            result = conn.execute(text("PRAGMA table_info(course_applications)"))
            app_cols = [r[1] for r in result.fetchall()]
        else:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'course_applications' AND table_schema = 'public'
            """))
            app_cols = [r[0] for r in result.fetchall()]

        for col, sql_type in [
            ("parent_email", "VARCHAR(255)"),
            ("parent_full_name", "VARCHAR(255)"),
            ("parent_phone", "VARCHAR(50)"),
        ]:
            if col not in app_cols:
                conn.execute(text(f"ALTER TABLE course_applications ADD COLUMN {col} {sql_type}"))
                conn.commit()
                print(f"Added course_applications.{col}")
            else:
                print(f"course_applications.{col} already exists")


if __name__ == "__main__":
    migrate()
    print("Migration done.")
