#!/usr/bin/env python3
"""
Remove specific topics from Python course as requested by user.
Python:
- Сөздіктер және файлдармен жұмыс (Order 8)
"""
from __future__ import annotations
import os
import sys

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_root)
os.chdir(_backend_root)

from app.core.database import SessionLocal
from app.models.course import Course
from app.models.course_topic import CourseTopic

def main():
    db = SessionLocal()
    try:
        # Python course topics removal
        python_course = db.query(Course).filter(Course.title == "Python программалау негіздері").first()
        if python_course:
            titles_to_remove = ["Сөздіктер және файлдармен жұмыс"]
            removed_count = db.query(CourseTopic).filter(
                CourseTopic.course_id == python_course.id,
                CourseTopic.title.in_(titles_to_remove)
            ).delete(synchronize_session=False)
            print(f"Removed {removed_count} topics from Python course.")
        
        db.commit()
        print("Changes committed successfully.")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
