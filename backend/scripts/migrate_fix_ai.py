#!/usr/bin/env python3
"""
Combined migration: 
1. Ensure ai_challenges has all required columns.
2. Create ai_challenge_cache table if it doesn't exist.
"""
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend root to path to import settings
sys.path.insert(0, str(Path(__file__).parent))
from app.core.config import settings

def run():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    is_sqlite = "sqlite" in settings.DATABASE_URL

    with engine.connect() as conn:
        # --- 1. Fix ai_challenges columns ---
        if is_sqlite:
            r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_challenges'"))
        else:
            r = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name = 'ai_challenges'"))
        
        if r.fetchone():
            if is_sqlite:
                r = conn.execute(text("PRAGMA table_info(ai_challenges)"))
                cols = {row[1] for row in r.fetchall()}
            else:
                r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_challenges'"))
                cols = {row[0] for row in r.fetchall()}

            new_cols = [
                ("ai_level", "VARCHAR(20) DEFAULT 'intermediate'"),
                ("round_time_limit_seconds", "INTEGER DEFAULT 90"),
                ("user_bonus_points", "INTEGER DEFAULT 0"),
                ("ai_bonus_points", "INTEGER DEFAULT 0"),
                ("coins_awarded", "INTEGER DEFAULT 0"),
                ("recommendations", "TEXT"),
                ("game_type", "VARCHAR(20) DEFAULT 'quiz'"),
                ("ai_times_json", "TEXT")
            ]

            for col, col_type in new_cols:
                if col not in cols:
                    print(f"Adding column {col} to ai_challenges...")
                    conn.execute(text(f"ALTER TABLE ai_challenges ADD COLUMN {col} {col_type}"))
                    conn.commit()
        else:
            print("Table ai_challenges not found. It will be created by app initialization.")

        # --- 2. Create ai_challenge_cache table ---
        if is_sqlite:
            r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_challenge_cache'"))
        else:
            r = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name = 'ai_challenge_cache'"))
        
        if not r.fetchone():
            print("Creating table ai_challenge_cache...")
            if is_sqlite:
                conn.execute(text("""
                    CREATE TABLE ai_challenge_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        questions_hash VARCHAR(500),
                        ai_level VARCHAR(20),
                        game_mode VARCHAR(20),
                        response_json TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("CREATE INDEX ix_ai_challenge_cache_questions_hash ON ai_challenge_cache (questions_hash)"))
            else:
                conn.execute(text("""
                    CREATE TABLE ai_challenge_cache (
                        id SERIAL PRIMARY KEY,
                        questions_hash VARCHAR(500),
                        ai_level VARCHAR(20),
                        game_mode VARCHAR(20),
                        response_json TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("CREATE INDEX ix_ai_challenge_cache_questions_hash ON ai_challenge_cache (questions_hash)"))
            conn.commit()
        else:
            print("Table ai_challenge_cache already exists.")

    print("Migration finished successfully.")

if __name__ == "__main__":
    run()
