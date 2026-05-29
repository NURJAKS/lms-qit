import sqlite3

db_path = "/home/nurjaks/Dev/LMS platform - order/backend/education.db"
email = "zhandossahiev@gmail.com"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Try to find the users table
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"Tables: {tables}")

# Assuming there's a 'users' table or similar
# Let's search for the user
try:
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if user:
        print(f"User found: {user}")
        # Get column names
        column_names = [description[0] for description in cursor.description]
        print(f"Columns: {column_names}")
    else:
        print("User not found in 'users' table.")
except sqlite3.OperationalError:
    print("'users' table not found or error occurred.")

conn.close()
