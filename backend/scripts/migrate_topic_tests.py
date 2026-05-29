"""
Replace topic test questions with topic-specific sets for Python and Web courses.
Courses are resolved by title (not hardcoded course_id). Run from backend dir:

  python migrate_topic_tests.py
"""
import sys

sys.path.insert(0, ".")

from app.core.database import SessionLocal
from app.models import Course, CourseTopic, Test, TestQuestion

from seed_data import (
    TOPIC_QUESTIONS_PYTHON,
    PYTHON_FINAL_QUESTIONS,
    TOPIC_QUESTIONS_WEB,
    WEB_FINAL_QUESTIONS,
    PYTHON_COURSE_TITLE,
    WEB_COURSE_TITLE,
    FINAL_TEST_TIME_LIMIT_SECONDS,
    _add_questions_to_test,
)


def migrate() -> None:
    db = SessionLocal()
    try:
        py_course = db.query(Course).filter(Course.title == PYTHON_COURSE_TITLE).first()
        if not py_course:
            print(f"Python course not found: {PYTHON_COURSE_TITLE!r}")
        else:
            topics1 = (
                db.query(CourseTopic)
                .filter(CourseTopic.course_id == py_course.id)
                .order_by(CourseTopic.order_number)
                .all()
            )
            for idx, topic in enumerate(topics1):
                if idx >= len(TOPIC_QUESTIONS_PYTHON):
                    continue
                test = db.query(Test).filter(Test.topic_id == topic.id, Test.is_final == 0).first()
                if not test:
                    continue
                db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
                qs = TOPIC_QUESTIONS_PYTHON[idx]
                _add_questions_to_test(db, test.id, qs)
                test.question_count = len(qs)
                print(f"Python topic {topic.id} ({topic.title[:30]}...): test {test.id} — {len(qs)} questions")
            final1 = db.query(Test).filter(Test.course_id == py_course.id, Test.is_final == 1).first()
            if final1:
                db.query(TestQuestion).filter(TestQuestion.test_id == final1.id).delete()
                _add_questions_to_test(db, final1.id, PYTHON_FINAL_QUESTIONS)
                final1.question_count = len(PYTHON_FINAL_QUESTIONS)
                final1.time_limit_seconds = FINAL_TEST_TIME_LIMIT_SECONDS
                print(
                    f"Python final test {final1.id}: {len(PYTHON_FINAL_QUESTIONS)} questions, "
                    f"time_limit={FINAL_TEST_TIME_LIMIT_SECONDS}s"
                )

        web_course = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
        if not web_course:
            print(f"Web course not found: {WEB_COURSE_TITLE!r}")
        else:
            topics2 = (
                db.query(CourseTopic)
                .filter(CourseTopic.course_id == web_course.id)
                .order_by(CourseTopic.order_number)
                .all()
            )
            for idx, topic in enumerate(topics2):
                if idx >= len(TOPIC_QUESTIONS_WEB):
                    continue
                test = db.query(Test).filter(Test.topic_id == topic.id, Test.is_final == 0).first()
                if not test:
                    continue
                db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
                qs = TOPIC_QUESTIONS_WEB[idx]
                _add_questions_to_test(db, test.id, qs)
                test.question_count = len(qs)
                print(f"Web topic {topic.id} ({topic.title[:30]}...): test {test.id} — {len(qs)} questions")
            final2 = db.query(Test).filter(Test.course_id == web_course.id, Test.is_final == 1).first()
            if final2:
                db.query(TestQuestion).filter(TestQuestion.test_id == final2.id).delete()
                _add_questions_to_test(db, final2.id, WEB_FINAL_QUESTIONS)
                final2.question_count = len(WEB_FINAL_QUESTIONS)
                final2.time_limit_seconds = FINAL_TEST_TIME_LIMIT_SECONDS
                print(
                    f"Web final test {final2.id}: {len(WEB_FINAL_QUESTIONS)} questions, "
                    f"time_limit={FINAL_TEST_TIME_LIMIT_SECONDS}s"
                )

        db.commit()
        print("Done. All topic and final tests updated with topic-specific questions.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
