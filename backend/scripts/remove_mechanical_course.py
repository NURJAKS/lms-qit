#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Add backend to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.core.database import SessionLocal
from app.models.course import Course

TITLES_TO_REMOVE = [
    "Машина жасау және трансформациялау",
    "Машиностроение и трансформация",
    "Mechanical Engineering and Transformation"
]

def main():
    db = SessionLocal()
    try:
        updated_count = 0
        for title in TITLES_TO_REMOVE:
            courses = db.query(Course).filter(Course.title == title).all()
            for course in courses:
                if course.is_active:
                    course.is_active = False
                    updated_count += 1
                    print(f"Deactivated course (ID: {course.id}): {course.title}")
        
        db.commit()
        if updated_count == 0:
            print("No active courses with specified titles found.")
        else:
            print(f"Successfully deactivated {updated_count} course(s).")
    except Exception as e:
        db.rollback()
        print(f"Error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
