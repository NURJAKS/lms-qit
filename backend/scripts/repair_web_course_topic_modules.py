#!/usr/bin/env python3
"""
Re-assign course_topics.module_id for the main Web course by order_number bands
(как в seed_data: тақырып 1–4 → модуль HTML, 5–7 → CSS, 8–10 → JS).

Если у тем стоит module_id = NULL или неверный модуль, в /courses/{id}/structure
они не попадают в «Модуль 1» — на странице курса видны только часть тем
(например только «Формалар» и «Семантикалық HTML»).

Запуск из каталога backend:
  python scripts/repair_web_course_topic_modules.py
"""
from __future__ import annotations

import os
import sys

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_root)
os.chdir(_backend_root)

from app.core.database import SessionLocal  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.course_module import CourseModule  # noqa: E402
from app.models.course_topic import CourseTopic  # noqa: E402

WEB_COURSE_TITLE = "Web-әзірлеу негіздері"


def repair_module_ids(db, course_id: int) -> int:
    modules = (
        db.query(CourseModule)
        .filter(CourseModule.course_id == course_id)
        .order_by(CourseModule.order_number)
        .all()
    )
    if len(modules) < 3:
        return 0
    bands = [
        (1, 4, modules[0].id),
        (5, 7, modules[1].id),
        (8, 10, modules[2].id),
    ]
    updated = 0
    for lo, hi, mid in bands:
        for t in (
            db.query(CourseTopic)
            .filter(
                CourseTopic.course_id == course_id,
                CourseTopic.order_number >= lo,
                CourseTopic.order_number <= hi,
            )
            .all()
        ):
            if t.module_id != mid:
                t.module_id = mid
                updated += 1
    return updated


def main() -> None:
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
        if not course:
            print(f'Course "{WEB_COURSE_TITLE}" not found.')
            sys.exit(1)
        n = repair_module_ids(db, course.id)
        db.commit()
        print(f"Updated module_id on {n} topic(s) for course id={course.id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
