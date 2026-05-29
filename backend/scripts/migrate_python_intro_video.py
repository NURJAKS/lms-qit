"""
Миграция: обновить длительность видео первого урока Python (Что такое Python?).
Видео уже скопировано в uploads/videos/course1/intro.mp4 (2:23 = 143 сек).
Запуск: cd backend && python migrate_python_intro_video.py
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import CourseTopic

PYTHON_INTRO_DURATION = 143  # 2:23


def migrate():
    db = SessionLocal()
    try:
        topic = db.query(CourseTopic).filter(
            CourseTopic.course_id == 1,
            CourseTopic.order_number == 1,
        ).first()
        if not topic:
            print("Topic 'Python дегеніміз не?' not found.")
            return
        topic.video_url = "/uploads/videos/course1/intro.mp4"
        topic.video_duration = PYTHON_INTRO_DURATION
        db.commit()
        print(f"Updated topic id={topic.id}: video_duration={PYTHON_INTRO_DURATION}s.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
