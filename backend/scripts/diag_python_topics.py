#!/usr/bin/env python3
"""
Diagnostic script to see current Python course topics.
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

PYTHON_COURSE_TITLE = "Python программалау негіздері"

def main():
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.title == PYTHON_COURSE_TITLE).first()
        if not course:
            print(f"Course {PYTHON_COURSE_TITLE} not found")
            return
        
        topics = db.query(CourseTopic).filter(CourseTopic.course_id == course.id).order_by(CourseTopic.order_number).all()
        print(f"Python Course ID: {course.id}")
        print(f"Topics count: {len(topics)}")
        for t in topics:
            print(f"Order: {t.order_number} | Title: {t.title} | ModuleID: {t.module_id}")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
