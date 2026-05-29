#!/usr/bin/env python3
"""
Add first Web-course topic «HTML дегеніміз не?» (intro) and shift existing topics.

- Expects Web course first topic to be «HTML тегтері» at order_number 1 (pre–seed layout).
- Skips if a topic titled «HTML дегеніміз не?» already exists for that course.
- Shifts all topics’ order_number by +1, inserts intro at 1 with video, theory, test.
- Syncs video_url / description from topic_video_urls.WEB_TOPIC_VIDEOS and
  topic_theory_content.DESCRIPTIONS_COURSE_2 by order (overwrites descriptions).

Run from backend directory (сначала при необходимости привяжите темы к модулям):
  python scripts/repair_web_course_topic_modules.py
  python scripts/add_web_html_intro_topic.py
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
from app.models.test import Test  # noqa: E402
from app.models.test_question import TestQuestion  # noqa: E402
from seed_data import TOPIC_QUESTIONS_WEB, _add_questions_to_test  # noqa: E402
from topic_theory_content import DESCRIPTIONS_COURSE_2  # noqa: E402
from topic_video_urls import WEB_TOPIC_VIDEOS  # noqa: E402

WEB_COURSE_TITLE = "Web-әзірлеу негіздері"
INTRO_TITLE = "HTML дегеніміз не?"
LEGACY_FIRST_TITLE = "HTML тегтері"


def _repair_module_ids(db, course_id: int) -> int:
    modules = (
        db.query(CourseModule)
        .filter(CourseModule.course_id == course_id)
        .order_by(CourseModule.order_number)
        .all()
    )
    if len(modules) < 3:
        return 0
    bands = [(1, 4, modules[0].id), (5, 7, modules[1].id), (8, 10, modules[2].id)]
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
    if len(WEB_TOPIC_VIDEOS) < 10 or len(DESCRIPTIONS_COURSE_2) < 10:
        print("WEB_TOPIC_VIDEOS or DESCRIPTIONS_COURSE_2 must have at least 10 entries.")
        sys.exit(1)
    if len(TOPIC_QUESTIONS_WEB) < 10:
        print("TOPIC_QUESTIONS_WEB must include intro + 9 topics.")
        sys.exit(1)

    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
        if not course:
            print(f'Course "{WEB_COURSE_TITLE}" not found.')
            sys.exit(1)

        fixed = _repair_module_ids(db, course.id)
        if fixed:
            db.commit()
            print(f"Repaired module_id on {fixed} topic(s) (they will show under the correct modules).")

        if (
            db.query(CourseTopic)
            .filter(CourseTopic.course_id == course.id, CourseTopic.title == INTRO_TITLE)
            .first()
        ):
            print("Intro topic already exists. Nothing else to do.")
            return

        first = (
            db.query(CourseTopic)
            .filter(CourseTopic.course_id == course.id)
            .order_by(CourseTopic.order_number)
            .first()
        )
        if not first:
            print("Web course has no topics.")
            sys.exit(1)
        if first.order_number != 1 or first.title != LEGACY_FIRST_TITLE:
            print(
                f"Unexpected first topic (order={first.order_number}, title={first.title!r}). "
                f"Expected order 1 and title {LEGACY_FIRST_TITLE!r}."
            )
            sys.exit(1)

        n = db.query(CourseTopic).filter(CourseTopic.course_id == course.id).count()
        if n != 9:
            print(
                f"Expected exactly 9 Web topics before adding intro (found {n}). "
                "If the course was customized, add the topic manually or reset course content. Abort."
            )
            sys.exit(1)

        html_mod = (
            db.query(CourseModule)
            .filter(CourseModule.course_id == course.id, CourseModule.order_number == 1)
            .first()
        )

        for t in (
            db.query(CourseTopic)
            .filter(CourseTopic.course_id == course.id)
            .order_by(CourseTopic.order_number.desc())
            .all()
        ):
            t.order_number += 1
        db.flush()

        new_topic = CourseTopic(
            course_id=course.id,
            module_id=html_mod.id if html_mod else None,
            title=INTRO_TITLE,
            order_number=1,
            video_url=WEB_TOPIC_VIDEOS[0],
            video_duration=600,
            description=DESCRIPTIONS_COURSE_2[0],
        )
        db.add(new_topic)
        db.flush()

        for t in (
            db.query(CourseTopic)
            .filter(CourseTopic.course_id == course.id)
            .order_by(CourseTopic.order_number)
            .all()
        ):
            idx = t.order_number - 1
            if 0 <= idx < len(WEB_TOPIC_VIDEOS):
                t.video_url = WEB_TOPIC_VIDEOS[idx]
            if 0 <= idx < len(DESCRIPTIONS_COURSE_2):
                t.description = DESCRIPTIONS_COURSE_2[idx]
            if idx >= len(TOPIC_QUESTIONS_WEB):
                continue
            test = (
                db.query(Test)
                .filter(Test.topic_id == t.id, Test.course_id == course.id, Test.is_final == 0)
                .first()
            )
            if not test:
                test = Test(
                    topic_id=t.id,
                    course_id=course.id,
                    title=f"Тест {t.order_number}",
                    passing_score=70,
                    question_count=0,
                    is_final=0,
                    time_limit_seconds=600,
                )
                db.add(test)
                db.flush()
            qs = TOPIC_QUESTIONS_WEB[idx]
            test.title = f"Тест {t.order_number}"
            db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
            db.flush()
            _add_questions_to_test(db, test.id, qs)
            test.question_count = len(qs)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
