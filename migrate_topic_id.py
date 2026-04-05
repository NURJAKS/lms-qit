import sqlite3
import os

db_path = "backend/education.db"
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if topic_id already exists
        cursor.execute("PRAGMA table_info(teacher_questions)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "topic_id" not in columns:
            print("Adding topic_id column to teacher_questions...")
            cursor.execute("ALTER TABLE teacher_questions ADD COLUMN topic_id INTEGER REFERENCES course_topics(id) ON DELETE SET NULL")
            conn.commit()
            print("Column added successfully.")
        else:
            print("topic_id column already exists in teacher_questions.")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
