#!/usr/bin/env python3
"""Добавляет premium-only курсы: 1С, веб-дизайнер, C++, C#, AutoCAD, Blender."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.course import Course
from app.models.course_category import CourseCategory
from app.models.user import User
from datetime import datetime, timezone
from decimal import Decimal

PREMIUM_COURSES = [
    {
        "title": "1С:Предприятие 8",
        "description": "Бухгалтерия, конфигурирование и программирование на платформе 1С. Практические навыки для работы бухгалтером и разработчиком.",
        "category_name": "Деректер ғылымы",
        "price": Decimal("0"),
    },
    {
        "title": "Веб-дизайнер",
        "description": "UI/UX дизайн, Figma, вёрстка. Создание современных интерфейсов для веб и мобильных приложений.",
        "category_name": "Web-әзірлеу",
        "price": Decimal("0"),
    },
    {
        "title": "C++ разработчик",
        "description": "Системное программирование на C++. Память, указатели, ООП, STL. Подготовка к разработке высокопроизводительных приложений.",
        "category_name": "Программалау",
        "price": Decimal("0"),
    },
    {
        "title": "C# разработчик",
        "description": "Разработка на .NET. C#, ASP.NET, Entity Framework. Создание веб-приложений и десктопных программ.",
        "category_name": "Программалау",
        "price": Decimal("0"),
    },
    {
        "title": "AutoCAD",
        "description": "Черчение и проектирование в AutoCAD. 2D и 3D моделирование для инженеров и архитекторов.",
        "category_name": "Деректер ғылымы",
        "price": Decimal("0"),
    },
    {
        "title": "Blender 3D",
        "description": "3D-моделирование, анимация и рендеринг в Blender. Создание игровых ассетов, визуализация, motion design.",
        "category_name": "Дизайн",
        "price": Decimal("0"),
    },
]


def main():
    db = SessionLocal()
    try:
        categories = {c.name: c.id for c in db.query(CourseCategory).all()}
        existing_titles = {c.title for c in db.query(Course.title).all()}

        admin = db.query(User).filter(User.role == "admin").first()
        admin_id = admin.id if admin else 1

        added = 0
        for d in PREMIUM_COURSES:
            if d["title"] in existing_titles:
                continue
            cat_id = categories.get(d["category_name"])
            if not cat_id:
                cat_id = list(categories.values())[0] if categories else 1

            course = Course(
                title=d["title"],
                description=d["description"],
                category_id=cat_id,
                is_active=True,
                is_premium_only=True,
                price=d["price"],
                language="kz",
                created_by=admin_id,
                published_at=datetime.now(timezone.utc),
            )
            db.add(course)
            added += 1

        db.commit()
        print(f"Добавлено {added} premium-курсов.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
