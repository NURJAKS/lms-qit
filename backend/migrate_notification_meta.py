
import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), "education.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Adding 'meta' column to 'notifications' table...")
    try:
        cursor.execute("ALTER TABLE notifications ADD COLUMN meta TEXT")
        print("Column 'meta' added successfully.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'meta' already exists.")
        else:
            print(f"Error adding column: {e}")

    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
