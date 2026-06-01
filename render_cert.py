import os
import sys
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# Add backend to sys.path to import the renderer
sys.path.insert(0, os.path.abspath("backend"))

from app.services.certificate_render import render_certificate_png

def main():
    db_path = "backend/education.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Get user
    cur.execute("SELECT id, full_name, email FROM users WHERE email='student1@edu.kz'")
    user_row = cur.fetchone()
    if not user_row:
        print("User not found")
        return
    user_id, full_name, email = user_row
    
    # Get course
    cur.execute("SELECT id, title FROM courses LIMIT 1")
    course_row = cur.fetchone()
    if not course_row:
        print("Course not found")
        return
    course_id, course_title = course_row
    
    # Get certificate
    cur.execute("SELECT id FROM certificates WHERE user_id=? AND course_id=?", (user_id, course_id))
    cert_row = cur.fetchone()
    if not cert_row:
        print("Certificate not found")
        return
    cert_id = cert_row[0]
    
    student_label = full_name.strip() if full_name else email
    
    # Render PNG
    print(f"Rendering cert for {student_label} - {course_title}")
    cert_url = render_certificate_png(
        cert_id=cert_id,
        student_name=student_label,
        course_title=course_title,
        issued_at=datetime.now(timezone.utc)
    )
    
    # Update DB
    cur.execute("UPDATE certificates SET certificate_url=? WHERE id=?", (cert_url, cert_id))
    conn.commit()
    conn.close()
    
    print(f"Success! URL: {cert_url}")

if __name__ == "__main__":
    main()
