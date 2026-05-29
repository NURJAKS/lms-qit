import os
import sys
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

# Add backend to path to import models
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_path)

from app.core.database import SessionLocal
from app.models.course_feed_post import CourseFeedPost

def localize_community():
    db = SessionLocal()
    try:
        posts = db.query(CourseFeedPost).all()
        translations = {
            "Добро пожаловать в наше сообщество!": "Біздің қоғамдастыққа қош келдіңіз!",
            "Здесь вы можете задавать вопросы и делиться опытом.": "Мұнда сіз сұрақтар қойып, тәжірибе бөлісе аласыз.",
            "Объявление": "Хабарландыру",
            "Новое задание": "Жаңа тапсырма",
            "Пожалуйста, соблюдайте правила общения.": "Қарым-қатынас ережелерін сақтауыңызды сұраймыз.",
            "Важное сообщение": "Маңызды хабарлама",
            "Опрос": "Сауалнама",
            "Результаты теста": "Тест нәтижелері"
        }
        
        updated_count = 0
        for post in posts:
            changed = False
            if post.title in translations:
                post.title = translations[post.title]
                changed = True
            if post.body in translations:
                post.body = translations[post.body]
                changed = True
            
            # Simple substring replacement for common phrases if exact match not found
            if not changed:
                for ru, kk in translations.items():
                    if post.title and ru in post.title:
                        post.title = post.title.replace(ru, kk)
                        changed = True
                    if post.body and ru in post.body:
                        post.body = post.body.replace(ru, kk)
                        changed = True
            
            if changed:
                updated_count += 1
        
        db.commit()
        print(f"Successfully updated {updated_count} community posts to Kazakh.")
    finally:
        db.close()

if __name__ == "__main__":
    localize_community()
