#!/usr/bin/env python3
"""
One-off repair: Web course, topic «HTML тегтері» (order 2 — after «HTML дегеніміз не?»).

- Sets description from topic_theory_content.DESCRIPTIONS_COURSE_2[1]
- Rebuilds non-final test questions from seed_data.QUESTIONS_WEB_TOPIC_1
- Does not change video_url / video_duration (keeps current DB values)

Run from backend directory:
  python scripts/repair_web_html_tags_topic.py
"""
from __future__ import annotations

import os
import sys

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_root)
os.chdir(_backend_root)

from app.core.database import SessionLocal  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.course_topic import CourseTopic  # noqa: E402
from app.models.test import Test  # noqa: E402
from app.models.test_question import TestQuestion  # noqa: E402
from topic_theory_content import DESCRIPTIONS_COURSE_2  # noqa: E402
from seed_data import QUESTIONS_WEB_TOPIC_1  # noqa: E402

WEB_COURSE_TITLE = "Web-әзірлеу негіздері"
TOPIC_TITLE = "HTML тегтері"


def main() -> None:
    if not DESCRIPTIONS_COURSE_2 or len(DESCRIPTIONS_COURSE_2) < 2:
        print("DESCRIPTIONS_COURSE_2 is missing or too short (need intro + HTML тегтері).")
        sys.exit(1)

    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
        if not course:
            print(f'Course "{WEB_COURSE_TITLE}" not found.')
            sys.exit(1)

        topic = (
            db.query(CourseTopic)
            .filter(
                CourseTopic.course_id == course.id,
                CourseTopic.order_number == 2,
                CourseTopic.title == TOPIC_TITLE,
            )
            .first()
        )
        if not topic:
            print(f'Topic "{TOPIC_TITLE}" (order 2) not found for Web course id={course.id}.')
            sys.exit(1)

        new_desc = DESCRIPTIONS_COURSE_2[1].strip()
        topic.description = new_desc
        db.add(topic)
        db.flush()

        test = (
            db.query(Test)
            .filter(Test.topic_id == topic.id, Test.is_final == 0)
            .first()
        )
        if not test:
            print(f"No non-final test for topic id={topic.id}.")
            sys.exit(1)

        db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
        db.flush()

        for i, q in enumerate(QUESTIONS_WEB_TOPIC_1):
            db.add(
                TestQuestion(
                    test_id=test.id,
                    question_text=q[0],
                    correct_answer=q[1],
                    option_a=q[2],
                    option_b=q[3],
                    option_c=q[4],
                    option_d=q[5],
                    order_number=i + 1,
                )
            )
        test.question_count = len(QUESTIONS_WEB_TOPIC_1)
        db.add(test)
        db.commit()
        print(
            f"OK: topic id={topic.id} description updated ({len(new_desc)} chars), "
            f"test id={test.id} — {len(QUESTIONS_WEB_TOPIC_1)} questions."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
