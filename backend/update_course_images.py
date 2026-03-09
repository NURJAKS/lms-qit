#!/usr/bin/env python3
"""Update image_url for existing courses (Unsplash). Run: python3 update_course_images.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.course import Course

# Map title substring -> Unsplash image URL
IMAGE_MAP = [
    ("Python программалау", "https://codedamn-blog.s3.amazonaws.com/wp-content/uploads/2022/12/10131134/Python-image-with-logo-940x530-1.webp"),
    ("Web-әзірлеу", "https://cdn.dribbble.com/userupload/28665909/file/original-ca7a072deb149dfe731d8de63491bfed.png?resize=752x&vertical=center"),
    ("Машиналық оқыту", "https://www.shutterstock.com/image-illustration/robot-hand-holding-ai-ml-600nw-2661516405.jpg"),
    ("React әзірлеу", "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80"),
    ("Flutter мобильді", "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&q=80"),
    ("UI/UX дизайн", "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80"),
    ("SQL және деректер", "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&q=80"),
    ("Docker және", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRIuhHJZ4Dk-nyf6G2z4-VTm__3JSfQ1P21gA&s"),
    ("TypeScript", "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400&q=80"),
    ("Node.js Backend", "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&q=80"),
    ("Vue.js", "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=400&q=80"),
    ("MongoDB", "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&q=80"),
    ("GraphQL", "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80"),
    ("Figma дизайн", "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80"),
    ("Git және GitHub", "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=400&q=80"),
    ("AWS бұлтты", "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80"),
    ("Кибер қауіпсіздік", "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&q=80"),
    ("Блокчейн", "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80"),
    ("Agile және Scrum", "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80"),
    ("Тестілеу және QA", "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&q=80"),
]


def main():
    db = SessionLocal()
    try:
        courses = db.query(Course).all()
        updated = 0
        for course in courses:
            url = None
            for key, image_url in IMAGE_MAP:
                if key in course.title:
                    url = image_url
                    break
            if url and course.image_url != url:
                course.image_url = url
                updated += 1
        db.commit()
        print(f"Updated {updated} courses with Unsplash images.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
