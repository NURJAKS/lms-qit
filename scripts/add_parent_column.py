"""Add parent_id column to users if not exists. Run from project root: python scripts/add_parent_column.py"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import text
from app.core.database import engine

def main():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN parent_id INTEGER"))
            conn.commit()
            print("Added parent_id column")
        except Exception as e:
            err = str(e).lower()
            if "already exists" in err or "duplicate column" in err:
                print("Column parent_id already exists")
            else:
                raise

if __name__ == "__main__":
    main()
