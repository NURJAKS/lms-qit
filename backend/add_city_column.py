"""One-time migration: add city column to users table."""
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "education.db"
conn = sqlite3.connect(db_path)
try:
    conn.execute("ALTER TABLE users ADD COLUMN city VARCHAR(100)")
    conn.commit()
    print("Added city column to users table.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column city already exists.")
    else:
        raise
finally:
    conn.close()
