#!/usr/bin/env python3
"""
Update Python and Web courses to use new Kazakh videos and adjusted topic counts.
"""
import os
import sys

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_root)
os.chdir(_backend_root)

from app.core.database import SessionLocal
from app.models.course import Course
from seed_data import (
    _populate_python_modules_topics_tests,
    _populate_web_modules_topics_tests,
    _clear_course_modules_topics_tests
)

titles = ("Python программалау негіздері", "Web-әзірлеу негіздері")

def main():
    db = SessionLocal()
    try:
        c_py = db.query(Course).filter(Course.title == titles[0]).first()
        c_web = db.query(Course).filter(Course.title == titles[1]).first()

        if not c_py:
            print(f"Error: {titles[0]} not found.")
        else:
            print(f"Updating {titles[0]}...")
            _clear_course_modules_topics_tests(db, c_py.id)
            _populate_python_modules_topics_tests(db, c_py.id)
            print(f"Done Python.")

        if not c_web:
            print(f"Error: {titles[1]} not found.")
        else:
            print(f"Updating {titles[1]}...")
            _clear_course_modules_topics_tests(db, c_web.id)
            _populate_web_modules_topics_tests(db, c_web.id)
            print(f"Done Web.")

        db.commit()
        print("Curriculum updated successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
