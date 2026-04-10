
import sqlite3
import os

db_path = "../backend/education.db"
if os.path.exists(db_path):
    print(f"Checking {db_path}...")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(teacher_assignments);")
    columns = [row[1] for row in cur.fetchall()]
    print(f"Columns in teacher_assignments: {columns}")
    
    # Check for topic_synopsis_submissions table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_synopsis_submissions';")
    print(f"Table topic_synopsis_submissions exists: {cur.fetchone() is not None}")
    
    conn.close()
else:
    print("Database not found.")
