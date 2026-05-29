
import sqlite3
import os

db_path = "education.db"
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found.")

    exit(1)

print(f"Migrating {db_path}...")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get existing columns
cur.execute("PRAGMA table_info(teacher_assignments);")
existing_columns = [row[1] for row in cur.fetchall()]

migrations = [
    ("is_synopsis", "BOOLEAN NOT NULL DEFAULT 0"),
    ("allow_student_class_comments", "BOOLEAN NOT NULL DEFAULT 1"),
    ("allow_student_edit_submission", "BOOLEAN NOT NULL DEFAULT 0")
]

for col_name, col_type in migrations:
    if col_name not in existing_columns:
        print(f"Adding column {col_name} to teacher_assignments...")
        try:
            cur.execute(f"ALTER TABLE teacher_assignments ADD COLUMN {col_name} {col_type};")
            print(f"Successfully added {col_name}.")
        except Exception as e:
            print(f"Failed to add {col_name}: {e}")
    else:
        print(f"Column {col_name} already exists.")

conn.commit()
conn.close()
print("Migration completed.")
