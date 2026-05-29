#!/usr/bin/env python3
"""
Remove specific topics from Python and Web courses as requested by user.
Python:
- Сынып типтер негіздері (Order 9)
- Модульдер және пакеттер (Order 10)

Web:
- Оқиғалар және функциялар (Order 10)
- HTML тегтері (Order 2) - User showed "HTML-теги" which is this one.
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
        # 1. Python course topics removal
        python_course = db.query(Course).filter(Course.title == "Python программалау негіздері").first()
        if python_course:
            titles_to_remove = ["Сынып типтер негіздері", "Модульдер және пакеттер"]
            removed_count = db.query(CourseTopic).filter(
                CourseTopic.course_id == python_course.id,
                CourseTopic.title.in_(titles_to_remove)
            ).delete(synchronize_session=False)
            print(f"Removed {removed_count} topics from Python course.")
        
        # 2. Web course topics removal
        web_course = db.query(Course).filter(Course.title == "Web-әзірлеу негіздері").first()
        if web_course:
            titles_to_remove = ["Оқиғалар және функциялар", "HTML тегтері"]
            removed_count = db.query(CourseTopic).filter(
                CourseTopic.course_id == web_course.id,
                CourseTopic.title.in_(titles_to_remove)
            ).delete(synchronize_session=False)
            print(f"Removed {removed_count} topics from Web course.")
        
        db.commit()
        print("Changes committed successfully.")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
