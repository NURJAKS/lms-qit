"""
Добавляет прогресс реальным студентам (student1-student5) с высокими баллами для попадания в топ-5 рейтинга.
Запуск: cd backend && python seed_real_students_progress.py
Требуется: seed_data.py уже выполнен (созданы студенты и курсы).
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import (
    User, Course, CourseTopic, CourseEnrollment, StudentProgress,
)
from decimal import Decimal

def seed():
    db = SessionLocal()
    try:
        courses = db.query(Course).filter(Course.is_active == True).all()
        if len(courses) < 2:
            print("Run seed_data.py first.")
            return

        course1, course2 = courses[0], courses[1]
        topic1_ids = [t.id for t in db.query(CourseTopic).filter(
            CourseTopic.course_id == course1.id
        ).order_by(CourseTopic.order_number).all()]
        topic2_ids = [t.id for t in db.query(CourseTopic).filter(
            CourseTopic.course_id == course2.id
        ).order_by(CourseTopic.order_number).all()]

        if not topic1_ids or not topic2_ids:
            print("Topics not found. Run seed_data.py first.")
            return

        # Получаем реальных студентов (student1-student5)
        real_students = []
        for i in range(1, 6):
            student = db.query(User).filter(User.email == f"student{i}@edu.kz").first()
            if student:
                real_students.append(student)

        if not real_students:
            print("Реальные студенты (student1-student5) не найдены. Run seed_data.py first.")
            return

        # Настройки прогресса для каждого студента (топ-5)
        # student1: топ-1, student2: топ-2, и т.д.
        progress_configs = [
            {"avg_base": 97, "activity_base": 12, "name": "топ-1"},  # student1
            {"avg_base": 94, "activity_base": 11, "name": "топ-2"},  # student2
            {"avg_base": 92, "activity_base": 10, "name": "топ-3"},  # student3
            {"avg_base": 90, "activity_base": 9, "name": "топ-4"},   # student4
            {"avg_base": 87, "activity_base": 8, "name": "топ-5"},   # student5
        ]

        for idx, student in enumerate(real_students[:5]):
            config = progress_configs[idx]
            avg_base = config["avg_base"]
            activity_base = config["activity_base"]
            
            print(f"Добавляем прогресс для {student.full_name} ({student.email}) - {config['name']}")

            # Добавляем прогресс по первому курсу (все темы)
            for tid_idx, tid in enumerate(topic1_ids):
                if not db.query(StudentProgress).filter(
                    StudentProgress.user_id == student.id,
                    StudentProgress.topic_id == tid,
                ).first():
                    # Баллы варьируются от avg_base до avg_base+3
                    score = avg_base + (tid_idx % 4)
                    db.add(StudentProgress(
                        user_id=student.id,
                        course_id=course1.id,
                        topic_id=tid,
                        is_completed=True,
                        test_score=Decimal(str(score)),
                        video_watched_seconds=400 + (tid_idx * 10),
                    ))

            # Добавляем прогресс по второму курсу (все темы)
            for tid_idx, tid in enumerate(topic2_ids):
                if not db.query(StudentProgress).filter(
                    StudentProgress.user_id == student.id,
                    StudentProgress.topic_id == tid,
                ).first():
                    # Баллы немного ниже для второго курса
                    score = avg_base - 2 + (tid_idx % 4)
                    db.add(StudentProgress(
                        user_id=student.id,
                        course_id=course2.id,
                        topic_id=tid,
                        is_completed=True,
                        test_score=Decimal(str(score)),
                        video_watched_seconds=450 + (tid_idx * 10),
                    ))

            # Записываем на оба курса
            for c in [course1, course2]:
                if not db.query(CourseEnrollment).filter(
                    CourseEnrollment.user_id == student.id,
                    CourseEnrollment.course_id == c.id,
                ).first():
                    db.add(CourseEnrollment(user_id=student.id, course_id=c.id, payment_confirmed=True))

        db.commit()
        print(f"Прогресс добавлен для {len(real_students[:5])} реальных студентов. Они должны быть в топ-5 рейтинга.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
