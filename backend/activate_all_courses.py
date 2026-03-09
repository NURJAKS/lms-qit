#!/usr/bin/env python3
"""Set all courses to is_active=True and published_at=now. Run: python3 activate_all_courses.py"""
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.course import Course


def main():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        courses = db.query(Course).all()
        for c in courses:
            c.is_active = True
            if c.published_at is None:
                c.published_at = now
        db.commit()
        print(f"Activated {len(courses)} courses.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
