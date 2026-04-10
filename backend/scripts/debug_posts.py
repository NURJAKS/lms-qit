import sqlite3
import os

def check_posts():
    db_path = os.path.join(os.path.dirname(__file__), "..", "education.db")
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, title, body, kind FROM course_feed_posts LIMIT 10")
    posts = cursor.fetchall()
    for p in posts:
        print(p)
    conn.close()

if __name__ == "__main__":
    check_posts()
