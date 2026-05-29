#!/usr/bin/env python3
"""
Миграция: добавление game_type и ai_times_json в ai_challenges для режима «Карточки».
Запустить: python migrate_ai_challenge_flashcard.py
"""
import os
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.core.config import settings


def run():
    engine = create_engine(settings.DATABASE_URL)
    is_sqlite = "sqlite" in settings.DATABASE_URL

    with engine.connect() as conn:
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
            ("game_type", "ALTER TABLE ai_challenges ADD COLUMN game_type VARCHAR(20) DEFAULT 'quiz'",
             "ALTER TABLE ai_challenges ADD COLUMN game_type VARCHAR(20) DEFAULT 'quiz'"),
            ("ai_times_json", "ALTER TABLE ai_challenges ADD COLUMN ai_times_json TEXT",
             "ALTER TABLE ai_challenges ADD COLUMN ai_times_json TEXT"),
        ]:
            if col not in cols:
                sql = sql_sqlite if is_sqlite else sql_pg
                conn.execute(text(sql))
                conn.commit()
                print(f"Added ai_challenges.{col}")

    print("Migration done.")


if __name__ == "__main__":
    run()
