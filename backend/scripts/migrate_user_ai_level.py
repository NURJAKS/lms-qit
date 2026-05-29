#!/usr/bin/env python3
"""
Migration: adding ai_level column to users table.
Запустить: python migrate_user_ai_level.py
"""
import os
from pathlib import Path
import sys

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run():
    engine = create_engine(settings.DATABASE_URL)
    is_sqlite = "sqlite" in settings.DATABASE_URL

    with engine.connect() as conn:
        # Check if users exists
        if is_sqlite:
            r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"))
        else:
            r = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            """))
        
        if not r.fetchone():
            print("Table users not found.")
            return

        # Get existing columns
        if is_sqlite:
            r = conn.execute(text("PRAGMA table_info(users)"))
            cols = {row[1] for row in r.fetchall()}
        else:
            r = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users'
            """))
            cols = {row[0] for row in r.fetchall()}

        if "ai_level" not in cols:
            sql = "ALTER TABLE users ADD COLUMN ai_level VARCHAR(20)"
            conn.execute(text(sql))
            conn.commit()
            print("Added users.ai_level")
        else:
            print("Column users.ai_level already exists.")

    print("Migration done.")

if __name__ == "__main__":
    run()
