import sys
import os
from decimal import Decimal
from datetime import datetime, timezone

# Add parent directory to sys.path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.course import Course
from app.models.course_module import CourseModule
from app.models.course_topic import CourseTopic
from app.models.test import Test
from app.models.test_question import TestQuestion

# Import correct questions and content from seed_data
import seed_data
from topic_theory_content import DESCRIPTIONS_COURSE_1
from topic_video_urls import PYTHON_TOPIC_VIDEOS

def run_fix():
    db = SessionLocal()
    try:
        # ----------------------------------------------------
        # 1. FIX MACHINE LEARNING (COURSE 3)
        # ----------------------------------------------------
        ml_test = db.query(Test).filter(Test.course_id == 3, Test.title == "а").first()
        if ml_test:
            db.query(TestQuestion).filter(TestQuestion.test_id == ml_test.id).delete()
            db.delete(ml_test)
            print("ML course final test 'а' deleted successfully.")
        
        # ----------------------------------------------------
        # 2. FIX INFORMATICS (COURSE 28)
        # ----------------------------------------------------
        inf_final = db.query(Test).filter(Test.course_id == 28, Test.is_final == 1).first()
        if inf_final:
            db.query(TestQuestion).filter(TestQuestion.test_id == inf_final.id).delete()
            seed_data._add_questions_to_test(db, inf_final.id, seed_data.INFO_FINAL_QUESTIONS)
            inf_final.question_count = len(seed_data.INFO_FINAL_QUESTIONS)
            print(f"Informatics final test updated with {len(seed_data.INFO_FINAL_QUESTIONS)} questions.")
        
        # ----------------------------------------------------
        # 3. FIX WEB COURSE (COURSE 2)
        # ----------------------------------------------------
        # Delete mock/placeholder tests
        mock_web_tests = db.query(Test).filter(
            Test.course_id == 2, 
            Test.is_final == 0, 
            Test.title.in_(["Тест: тест с квизом", "Тест: задание с вопросом"])
        ).all()
        for mt in mock_web_tests:
            db.query(TestQuestion).filter(TestQuestion.test_id == mt.id).delete()
            db.delete(mt)
            print(f"Web course mock test '{mt.title}' deleted.")

        # Refresh standard 8 tests with corrected questions
        web_topics = db.query(CourseTopic).filter(CourseTopic.course_id == 2).order_by(CourseTopic.order_number).all()
        for idx, topic in enumerate(web_topics):
            if idx >= len(seed_data.TOPIC_QUESTIONS_WEB):
                break
            test = db.query(Test).filter(Test.topic_id == topic.id, Test.is_final == 0).first()
            if test:
                db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
                qs = seed_data.TOPIC_QUESTIONS_WEB[idx]
                seed_data._add_questions_to_test(db, test.id, qs)
                test.question_count = len(qs)
                test.title = f"Тест {idx+1}"
                print(f"Web Test {idx+1} for Topic '{topic.title}' updated with {len(qs)} questions.")

        # ----------------------------------------------------
        # 4. FIX PYTHON COURSE (COURSE 1)
        # ----------------------------------------------------
        # Delete garbage mock tests
        mock_py_test = db.query(Test).filter(Test.course_id == 1, Test.title == "Тест: пайтон тапсыр ма").first()
        if mock_py_test:
            db.query(TestQuestion).filter(TestQuestion.test_id == mock_py_test.id).delete()
            db.delete(mock_py_test)
            print("Python course mock test 'Тест: пайтон тапсыр ма' deleted.")

        # Rename topic 1 title if needed
        t1 = db.query(CourseTopic).filter(CourseTopic.course_id == 1, CourseTopic.order_number == 1).first()
        if t1 and t1.title == "Python дегеніміз не??":
            t1.title = "Python дегеніміз не?"
            print("Python topic 1 title corrected.")

        # Check Module 4, create if missing
        m4 = db.query(CourseModule).filter(CourseModule.course_id == 1, CourseModule.order_number == 4).first()
        if not m4:
            m4 = CourseModule(
                course_id=1,
                title="Объектіге бағытталған бағдарламалау",
                order_number=4,
                description="ООП негіздері және модульдер"
            )
            db.add(m4)
            db.flush()
            print("Python Module 4 created.")
        
        m3 = db.query(CourseModule).filter(CourseModule.course_id == 1, CourseModule.order_number == 3).first()
        if m3:
            m3.description = "Функциялар, коллекциялар"

        # Add topics 8, 9, 10 if missing
        t8 = db.query(CourseTopic).filter(CourseTopic.course_id == 1, CourseTopic.order_number == 8).first()
        if not t8:
            t8 = CourseTopic(
                course_id=1,
                module_id=m3.id,
                title="Сөздіктер және файлдармен жұмыс",
                order_number=8,
                video_url=PYTHON_TOPIC_VIDEOS[7],
                video_duration=600,
                description=DESCRIPTIONS_COURSE_1[7]
            )
            db.add(t8)
            db.flush()
            print("Python Topic 8 created.")

        t9 = db.query(CourseTopic).filter(CourseTopic.course_id == 1, CourseTopic.order_number == 9).first()
        if not t9:
            t9 = CourseTopic(
                course_id=1,
                module_id=m4.id,
                title="Объектіге бағытталған бағдарламалау (ООП)",
                order_number=9,
                video_url=PYTHON_TOPIC_VIDEOS[8],
                video_duration=600,
                description=DESCRIPTIONS_COURSE_1[8]
            )
            db.add(t9)
            db.flush()
            print("Python Topic 9 created.")

        t10 = db.query(CourseTopic).filter(CourseTopic.course_id == 1, CourseTopic.order_number == 10).first()
        if not t10:
            t10 = CourseTopic(
                course_id=1,
                module_id=m4.id,
                title="Модульдер, пакеттер және pip",
                order_number=10,
                video_url=PYTHON_TOPIC_VIDEOS[9],
                video_duration=600,
                description=DESCRIPTIONS_COURSE_1[9]
            )
            db.add(t10)
            db.flush()
            print("Python Topic 10 created.")

        # Create or update tests for Python topics 1 to 10
        py_topics = db.query(CourseTopic).filter(CourseTopic.course_id == 1).order_by(CourseTopic.order_number).all()
        for idx, topic in enumerate(py_topics):
            if idx >= len(seed_data.TOPIC_QUESTIONS_PYTHON):
                break
            test = db.query(Test).filter(Test.topic_id == topic.id, Test.is_final == 0).first()
            if not test:
                test = Test(
                    topic_id=topic.id,
                    course_id=1,
                    title=f"Тест {idx+1}",
                    passing_score=70,
                    question_count=0,
                    is_final=0,
                    time_limit_seconds=600
                )
                db.add(test)
                db.flush()
                print(f"Test for Python topic {idx+1} created.")
            
            db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
            qs = seed_data.TOPIC_QUESTIONS_PYTHON[idx]
            seed_data._add_questions_to_test(db, test.id, qs)
            test.question_count = len(qs)
            test.title = f"Тест {idx+1}"
            print(f"Python Test {idx+1} for Topic '{topic.title}' updated with {len(qs)} questions.")

        # ----------------------------------------------------
        # 5. FIX CYBERSECURITY COURSE (COURSE 17)
        # ----------------------------------------------------
        cyber_mods_count = db.query(CourseModule).filter(CourseModule.course_id == 17).count()
        if cyber_mods_count == 0:
            print("Seeding Cybersecurity course (Course 17) modules, topics, and tests...")
            seed_data._populate_cybersecurity_modules_topics_tests(db, 17)
            print("Cybersecurity course seeded successfully.")
        else:
            print("Cybersecurity course already has modules. Skipping seeding.")

        db.commit()
        print("Database correction successfully completed!")

    except Exception as e:
        db.rollback()
        print(f"Error during execution: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_fix()
