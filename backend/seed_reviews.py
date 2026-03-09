"""
Добавляет фейковые хорошие отзывы о платформе и курсах.
Запуск: cd backend && python3 seed_reviews.py
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import User, Course, CourseReview, CourseEnrollment
from datetime import datetime, timezone, timedelta

def seed():
    db = SessionLocal()
    try:
        # Получаем студентов и курсы
        students = db.query(User).filter(User.role == 'student').limit(10).all()
        courses = db.query(Course).filter(Course.is_active == True).limit(5).all()
        
        if not students or not courses:
            print("Нужны студенты и курсы. Запустите seed_data.py сначала.")
            return
        
        # Хорошие отзывы на русском и казахском
        fake_reviews = [
            {
                "rating": 5,
                "text": "Отличная платформа! Материалы очень понятные, преподаватели всегда готовы помочь. Курс Python помог мне освоить программирование с нуля. Рекомендую всем!",
                "is_featured": True
            },
            {
                "rating": 5,
                "text": "Қазақстандағы ең жақсы IT платформасы! Курстар сапалы, мұғалімдер кәсіби. Python курсынан көп нәрсе үйрендім. Рахмет!",
                "is_featured": True
            },
            {
                "rating": 5,
                "text": "Платформа просто супер! Удобный интерфейс, интересные задания, хорошая обратная связь. Прошел курс по веб-разработке и уже работаю в IT-компании.",
                "is_featured": False
            },
            {
                "rating": 4,
                "text": "Очень доволен обучением. Материалы структурированы, есть практические задания. Единственное - хотелось бы больше видеоуроков. В целом рекомендую!",
                "is_featured": False
            },
            {
                "rating": 5,
                "text": "Лучшая инвестиция в свое будущее! Курсы качественные, поддержка на высшем уровне. После завершения курса получил предложение о работе. Спасибо команде!",
                "is_featured": True
            },
            {
                "rating": 5,
                "text": "Платформа менің IT-карьерамға бастама берді. Курстар нақты практикалық, мұғалімдер маман. Ұсынылады!",
                "is_featured": False
            },
            {
                "rating": 4,
                "text": "Хорошая платформа для изучения программирования. Материалы понятные, есть возможность задавать вопросы. Немного не хватает интерактивности, но в целом отлично!",
                "is_featured": False
            },
            {
                "rating": 5,
                "text": "Прошел несколько курсов на платформе. Качество обучения на высшем уровне! Преподаватели опытные, задания интересные. Платформа помогла мне сменить профессию.",
                "is_featured": False
            }
        ]
        
        added_count = 0
        review_index = 0
        
        # Распределяем отзывы по студентам и курсам
        for student in students:
            if review_index >= len(fake_reviews):
                break
                
            for course in courses:
                if review_index >= len(fake_reviews):
                    break
                
                # Проверяем, есть ли уже отзыв от этого студента на этот курс
                existing = db.query(CourseReview).filter(
                    CourseReview.user_id == student.id,
                    CourseReview.course_id == course.id
                ).first()
                
                if existing:
                    continue
                
                # Проверяем, записан ли студент на курс (или добавляем запись)
                enrollment = db.query(CourseEnrollment).filter(
                    CourseEnrollment.user_id == student.id,
                    CourseEnrollment.course_id == course.id
                ).first()
                
                if not enrollment:
                    enrollment = CourseEnrollment(
                        user_id=student.id,
                        course_id=course.id,
                        payment_confirmed=True
                    )
                    db.add(enrollment)
                    db.flush()
                
                # Создаем отзыв
                review_data = fake_reviews[review_index]
                review = CourseReview(
                    user_id=student.id,
                    course_id=course.id,
                    rating=review_data["rating"],
                    text=review_data["text"],
                    is_approved=True,  # Одобренные отзывы
                    is_featured=review_data.get("is_featured", False),
                    created_at=datetime.now(timezone.utc) - timedelta(days=review_index * 3)  # Разные даты
                )
                db.add(review)
                added_count += 1
                review_index += 1
        
        db.commit()
        print(f"✅ Добавлено {added_count} фейковых отзывов!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
