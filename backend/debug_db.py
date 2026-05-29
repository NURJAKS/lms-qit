import sqlite3
import os

db_path = "/home/nurjaks/Dev/LMS platform - order/backend/education.db"
output_path = "/home/nurjaks/Dev/LMS platform - order/backend/user_debug.txt"

if not os.path.exists(db_path):
    with open(output_path, "w") as f:
        f.write(f"Database not found at {db_path}")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    with open(output_path, "w") as f:
        f.write(f"Tables: {tables}\n\n")
        
        if ('users',) in tables or ('user',) in tables:
            table_name = 'users' if ('users',) in tables else 'user'
            cursor.execute(f"SELECT id, email, role FROM {table_name}")
            users = cursor.fetchall()
            f.write(f"Users in {table_name}:\n")
            for u in users:
                f.write(f"{u}\n")
        else:
            f.write("No users/user table found.\n")
except Exception as e:
    with open(output_path, "a") as f:
        f.write(f"Error: {str(e)}\n")
finally:
    conn.close()
