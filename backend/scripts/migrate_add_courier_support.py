#!/usr/bin/env python3
"""
Миграция: добавление поля courier_id в user_purchases для назначения курьеров на доставки.
Запустить: cd backend && python migrate_add_courier_support.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text, create_engine
from app.core.config import settings


def run():
    engine = create_engine(settings.DATABASE_URL)
    is_sqlite = "sqlite" in settings.DATABASE_URL

    with engine.connect() as conn:
        # Check if courier_id column exists
        if is_sqlite:
            r = conn.execute(text("PRAGMA table_info(user_purchases)"))
            cols = {row[1] for row in r.fetchall()}
        else:
            r = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'user_purchases' AND table_schema = 'public'
            """))
            cols = {row[0] for row in r.fetchall()}

        if "courier_id" not in cols:
            if is_sqlite:
                # SQLite doesn't support adding foreign keys directly, so we add the column first
                conn.execute(text("ALTER TABLE user_purchases ADD COLUMN courier_id INTEGER"))
                # Then create the foreign key constraint if possible (SQLite 3.6.19+)
                try:
                    conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS ix_user_purchases_courier_id 
                        ON user_purchases(courier_id)
                    """))
                except Exception as e:
                    print(f"Note: Could not create foreign key constraint: {e}")
                    print("Column added, but foreign key constraint may not be enforced in SQLite")
            else:
                # PostgreSQL/other databases
                conn.execute(text("""
                    ALTER TABLE user_purchases 
                    ADD COLUMN courier_id INTEGER 
                    REFERENCES users(id) ON DELETE SET NULL
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_user_purchases_courier_id 
                    ON user_purchases(courier_id)
                """))
            conn.commit()
            print("Added user_purchases.courier_id")
        else:
            print("user_purchases.courier_id already exists")

    print("Migration completed successfully!")


if __name__ == "__main__":
    run()
