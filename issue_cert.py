import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Setup environment to import backend modules
sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.course import Course
from app.models.certificate import Certificate
from app.services.certificate_render import render_certificate_png

def main():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "student1@edu.kz").first()
    if not user:
        print("User not found")
        return
        
    course = db.query(Course).first()
    if not course:
        print("No course found")
        return
        
    existing = db.query(Certificate).filter(Certificate.user_id == user.id, Certificate.course_id == course.id).first()
    if existing:
        print("Certificate already exists!")
        return

    cert = Certificate(
        user_id=user.id,
        course_id=course.id,
        certificate_url="",
        final_score=95,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)

    course_title = course.title.strip()
    student_label = (user.full_name or "").strip() or "Student"
    
    cert.certificate_url = render_certificate_png(
        cert.id,
        student_label,
        course_title,
        issued_at=datetime.now(timezone.utc),
    )
    db.commit()
    print(f"Issued certificate {cert.id} to {user.email} for {course.title}: {cert.certificate_url}")

if __name__ == "__main__":
    main()
