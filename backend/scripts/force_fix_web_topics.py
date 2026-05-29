#!/usr/bin/env python3
"""
Fix Web course topics:
1. Delete duplicates or wrong topics.
2. Re-order correctly (1-10).
3. Set correct module_id.
4. Add intro if missing.
"""
from __future__ import annotations
import os
import sys

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_root)
os.chdir(_backend_root)

from app.core.database import SessionLocal
from app.models.course import Course
from app.models.course_module import CourseModule
from app.models.course_topic import CourseTopic
from app.models.test import Test
from app.models.test_question import TestQuestion
from seed_data import TOPIC_QUESTIONS_WEB, _add_questions_to_test
from topic_theory_content import DESCRIPTIONS_COURSE_2
from topic_video_urls import WEB_TOPIC_VIDEOS

WEB_COURSE_TITLE = "Web-әзірлеу негіздері"

def main():
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
        if not course:
            print(f"Course {WEB_COURSE_TITLE} not found")
            return

        modules = db.query(CourseModule).filter(CourseModule.course_id == course.id).order_by(CourseModule.order_number).all()
        if len(modules) < 3:
            print("Not enough modules found for Web course")
            return

        # Delete all existing topics for this course to start fresh and clean
        # This is the safest way given the messed up order and titles
        print("Cleaning up existing Web topics...")
        topics = db.query(CourseTopic).filter(CourseTopic.course_id == course.id).all()
        for t in topics:
            db.delete(t)
        db.commit()

        # Re-create all 10 topics correctly
        print("Creating 10 Web topics...")
        topic_titles = [
            "HTML дегеніміз не?",
            "HTML тегтері",
            "Формалар",
            "Семантикалық HTML",
            "CSS селекторлары",
            "Flexbox",
            "Responsive дизайн",
            "JavaScript айнымалылары",
            "DOM манипуляциясы",
            "Оқиғалар және функциялар"
        ]

        # Module mapping: 1-4 -> Mod 1, 5-7 -> Mod 2, 8-10 -> Mod 3
        for i, title in enumerate(topic_titles):
            order = i + 1
            if order <= 4:
                mid = modules[0].id
            elif order <= 7:
                mid = modules[1].id
            else:
                mid = modules[2].id
            
            new_topic = CourseTopic(
                course_id=course.id,
                module_id=mid,
                title=title,
                order_number=order,
                video_url=WEB_TOPIC_VIDEOS[i],
                video_duration=600,
                description=DESCRIPTIONS_COURSE_2[i]
            )
            db.add(new_topic)
            db.flush()

            # Create test for each topic
            test = Test(
                topic_id=new_topic.id,
                course_id=course.id,
                title=f"Тест {order}",
                passing_score=70,
                question_count=0,
                is_final=0,
                time_limit_seconds=600
            )
            db.add(test)
            db.flush()

            if i < len(TOPIC_QUESTIONS_WEB):
                qs = TOPIC_QUESTIONS_WEB[i]
                _add_questions_to_test(db, test.id, qs)
                test.question_count = len(qs)

        db.commit()
        print("Successfully re-created all 10 Web topics with correct modules and tests.")

    finally:
        db.close()

if __name__ == "__main__":
    main()
