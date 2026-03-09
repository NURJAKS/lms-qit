"""
Добавляет 30 студентов с разными рейтингами — по 10 в каждой категории (Высокий, Средний, Потенциал роста).
ВНИМАНИЕ: Этот скрипт создает МОКОВЫХ студентов только для тестирования!
Не запускать автоматически в production. Использовать только для ручного тестирования рейтинга.

Запуск: cd backend && python seed_leaderboard_students.py
Требуется: seed_data.py и seed_mock_progress.py уже выполнены.
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import (
    User, Course, CourseTopic, CourseEnrollment, StudentProgress,
)
from decimal import Decimal

# 30 студентов (student6 — student35) — по 10 на каждую категорию
STUDENT_NAMES = [
    "Жандос Қанат", "Дархан Нұрлан", "Аружан Сая", "Ерлан Бекзат",
    "Айгүл Мәдина", "Нұрлан Дастан", "Айдана Серік", "Қайрат Ерлан",
    "Динара Айгүл", "Бекзат Нұрбол", "Асель Гүлнар", "Ерлан Жандос",
    "Мәдина Аружан", "Нұрсұлтан Дархан", "Сая Айдана", "Дастан Қанат",
    "Серік Динара", "Мұрат Бекзат", "Гүлнар Асель", "Қанат Нұрлан",
    "Нұрбол Мұрат", "Айгүл Ерлан", "Бекзат Сая", "Дархан Айдана",
    "Аружан Жандос", "Темірлан Асқар", "Айгерім Нұржан", "Ержан Дәулет",
    "Гүлдана Серік", "Қайсар Мұрат",
]


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

        # Ищем существующих студентов 6–35 (не создаем новых - только обновляем прогресс)
        new_students = [db.query(User).filter(User.email == f"student{i}@edu.kz").first()
                        for i in range(6, 36)]
        new_students = [s for s in new_students if s]
        
        if not new_students:
            print("Моковые студенты (student6-student35) не найдены. Создайте их вручную для тестирования.")
            return

        # Распределение: Top 10, Middle 10, Low 10
        # Рейтинг: avg_score*0.3 + avg_assignment*0.3 + courses_done*10*0.2 + activity*0.2
        # Top: avg 70–80 (снижено с 88–98), 2 courses, activity 8–15
        # Mid: avg 60–70 (снижено с 72–86), 1–2 courses, activity 3–8
        # Low: avg 50–60 (снижено с 50–70), 1 course, activity 1–3

        n = len(new_students)
        top_n = min(10, n // 3)
        mid_n = min(10, (n - top_n) // 2)
        low_n = min(10, n - top_n - mid_n)

        for idx, student in enumerate(new_students[: top_n + mid_n + low_n]):
            if idx < top_n:
                # Top level: средние баллы (снижено для тестирования), 2 курса
                avg = 70 + (idx % 10)  # 70-80 вместо 88-98
                act = 8 + (idx % 8)
                for tid in topic1_ids:
                    if not db.query(StudentProgress).filter(
                        StudentProgress.user_id == student.id,
                        StudentProgress.topic_id == tid,
                    ).first():
                        db.add(StudentProgress(
                            user_id=student.id,
                            course_id=course1.id,
                            topic_id=tid,
                            is_completed=True,
                            test_score=Decimal(str(avg + (idx % 5))),
                            video_watched_seconds=400,
                        ))
                for tid in topic2_ids:
                    if not db.query(StudentProgress).filter(
                        StudentProgress.user_id == student.id,
                        StudentProgress.topic_id == tid,
                    ).first():
                        db.add(StudentProgress(
                            user_id=student.id,
                            course_id=course2.id,
                            topic_id=tid,
                            is_completed=True,
                            test_score=Decimal(str(avg - 2 + (idx % 4))),
                            video_watched_seconds=450,
                        ))
                for c in [course1, course2]:
                    if not db.query(CourseEnrollment).filter(
                        CourseEnrollment.user_id == student.id,
                        CourseEnrollment.course_id == c.id,
                    ).first():
                        db.add(CourseEnrollment(user_id=student.id, course_id=c.id, payment_confirmed=True))

            elif idx < top_n + mid_n:
                # Average level: средние баллы (снижено для тестирования)
                avg = 60 + (idx - top_n) % 10  # 60-70 вместо 72-86
                tids = topic1_ids[:4] + (topic2_ids[:3] if (idx - top_n) % 2 == 0 else [])
                for tid in tids:
                    if not db.query(StudentProgress).filter(
                        StudentProgress.user_id == student.id,
                        StudentProgress.topic_id == tid,
                    ).first():
                        cid = course1.id if tid in topic1_ids else course2.id
                        db.add(StudentProgress(
                            user_id=student.id,
                            course_id=cid,
                            topic_id=tid,
                            is_completed=True,
                            test_score=Decimal(str(avg + (idx % 5))),
                            video_watched_seconds=350,
                        ))
                for c in [course1, course2]:
                    if not db.query(CourseEnrollment).filter(
                        CourseEnrollment.user_id == student.id,
                        CourseEnrollment.course_id == c.id,
                    ).first():
                        db.add(CourseEnrollment(user_id=student.id, course_id=c.id, payment_confirmed=True))

            else:
                # Growth potential: низкие баллы (снижено для тестирования), 1 курс
                avg = 50 + (idx - top_n - mid_n) % 10  # 50-60 вместо 50-70
                for tid in topic1_ids[: min(3, len(topic1_ids))]:
                    if not db.query(StudentProgress).filter(
                        StudentProgress.user_id == student.id,
                        StudentProgress.topic_id == tid,
                    ).first():
                        db.add(StudentProgress(
                            user_id=student.id,
                            course_id=course1.id,
                            topic_id=tid,
                            is_completed=True,
                            test_score=Decimal(str(avg + (idx % 5))),
                            video_watched_seconds=200,
                        ))
                if not db.query(CourseEnrollment).filter(
                    CourseEnrollment.user_id == student.id,
                    CourseEnrollment.course_id == course1.id,
                ).first():
                    db.add(CourseEnrollment(user_id=student.id, course_id=course1.id, payment_confirmed=True))

        db.commit()
        print(f"Leaderboard students seeded: {len(new_students)} students with progress.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
