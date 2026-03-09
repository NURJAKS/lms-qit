#!/usr/bin/env python3
"""
Миграция: добавление колонок в ai_challenges для AI vs Student (ТЗ).
Запустить: python migrate_ai_challenge.py
"""
import os
from pathlib import Path

# Add parent to path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run():
    engine = create_engine(settings.DATABASE_URL)
    is_sqlite = "sqlite" in settings.DATABASE_URL

    with engine.connect() as conn:
        # Check if ai_challenges exists
        if is_sqlite:
            r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_challenges'"))
        else:
            r = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'ai_challenges'
            """))
        if not r.fetchone():
            print("Table ai_challenges not found. Will be created on first run.")
            return

        # Get existing columns
        if is_sqlite:
            r = conn.execute(text("PRAGMA table_info(ai_challenges)"))
            cols = {row[1] for row in r.fetchall()}
        else:
            r = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'ai_challenges'
            """))
            cols = {row[0] for row in r.fetchall()}

        for col, sql_sqlite, sql_pg in [
            ("ai_level", "ALTER TABLE ai_challenges ADD COLUMN ai_level VARCHAR(20) DEFAULT 'intermediate'",
             "ALTER TABLE ai_challenges ADD COLUMN ai_level VARCHAR(20) DEFAULT 'intermediate'"),
            ("round_time_limit_seconds", "ALTER TABLE ai_challenges ADD COLUMN round_time_limit_seconds INTEGER DEFAULT 90",
             "ALTER TABLE ai_challenges ADD COLUMN round_time_limit_seconds INTEGER DEFAULT 90"),
            ("user_bonus_points", "ALTER TABLE ai_challenges ADD COLUMN user_bonus_points INTEGER DEFAULT 0",
             "ALTER TABLE ai_challenges ADD COLUMN user_bonus_points INTEGER DEFAULT 0"),
            ("ai_bonus_points", "ALTER TABLE ai_challenges ADD COLUMN ai_bonus_points INTEGER DEFAULT 0",
             "ALTER TABLE ai_challenges ADD COLUMN ai_bonus_points INTEGER DEFAULT 0"),
            ("recommendations", "ALTER TABLE ai_challenges ADD COLUMN recommendations TEXT",
             "ALTER TABLE ai_challenges ADD COLUMN recommendations TEXT"),
        ]:
            if col not in cols:
                sql = sql_sqlite if is_sqlite else sql_pg
                conn.execute(text(sql))
                conn.commit()
                print(f"Added ai_challenges.{col}")

    print("Migration done.")

if __name__ == "__main__":
    run()
