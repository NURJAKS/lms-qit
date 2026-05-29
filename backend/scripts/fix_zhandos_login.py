import sqlite3
import os
from passlib.context import CryptContext

db_path = "/home/nurjaks/Dev/LMS platform - order/backend/education.db"
output_path = "/home/nurjaks/Dev/LMS platform - order/backend/fix_log.txt"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def main():
    if not os.path.exists(db_path):
        with open(output_path, "w") as f:
            f.write(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    with open(output_path, "w") as f:
        f.write("Starting fix script...\n")
        
        # 1. Find any user matching zhandos
        cursor.execute("SELECT id, email, role FROM users WHERE email LIKE '%zhandos%'")
        users = cursor.fetchall()
        f.write(f"Found {len(users)} users matching 'zhandos':\n")
        for u in users:
            f.write(f"ID={u[0]}, Email={u[1]}, Role={u[2]}\n")
            
        # 2. Canonical fix
        # Ensure zhandossahiev@gmail.com exists and has the right password
        canonical_email = "zhandossahiev@gmail.com"
        new_password_hash = get_password_hash("zhandos123")
        
        # Check if sahlev exists
        typo_email = "zhandossahlev@gmail.com"
        cursor.execute("SELECT id FROM users WHERE email = ?", (typo_email,))
        typo_user = cursor.fetchone()
        
        if typo_user:
            f.write(f"Found user with typo email {typo_email}. Renaming to {canonical_email}...\n")
            cursor.execute("UPDATE users SET email = ?, password_hash = ? WHERE id = ?", (canonical_email, new_password_hash, typo_user[0]))
        else:
            # Check if sahiev exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (canonical_email,))
            canonical_user = cursor.fetchone()
            if canonical_user:
                f.write(f"Found user with canonical email {canonical_email}. Resetting password...\n")
                cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_password_hash, canonical_user[0]))
            else:
                f.write(f"User {canonical_email} not found. Creating new user...\n")
                # Need to find a safe way to create a user with all required fields
                # For now, just report that they are missing
                f.write("User creation skipped - not found in DB.\n")
        
        conn.commit()
        f.write("Finished.\n")
    
    conn.close()

if __name__ == "__main__":
    main()
