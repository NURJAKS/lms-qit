#!/usr/bin/env python3
"""Update course prices in existing DB. Run: python update_course_prices.py"""
import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.course import Course

# title -> new price (tenge)
PRICE_MAP = {
    "Python программалау негіздері": 30000,
    "Web-әзірлеу негіздері": 35000,
    "Машиналық оқыту негіздері": 45000,
    "React әзірлеу": 40000,
    "Flutter мобильді әзірлеу": 42000,
    "UI/UX дизайн": 38000,
    "SQL және деректер базасы": 32000,
    "Docker және контейнерлеу": 48000,
    "TypeScript программалау": 36000,
    "Node.js Backend әзірлеу": 44000,
    "Vue.js фреймворкі": 38000,
    "MongoDB NoSQL база": 40000,
    "GraphQL API": 42000,
    "Figma дизайн құралы": 35000,
    "Git және GitHub": 25000,
    "AWS бұлтты қызметтер": 55000,
    "Кибер қауіпсіздік негіздері": 50000,
    "Блокчейн технологиясы": 60000,
    "Agile және Scrum": 28000,
    "Тестілеу және QA": 38000,
}


def main():
    db = SessionLocal()
    try:
        courses = db.query(Course).all()
        updated = 0
        for c in courses:
            if c.title in PRICE_MAP:
                new_price = Decimal(str(PRICE_MAP[c.title]))
                if c.price != new_price:
                    old_price = c.price
                    c.price = new_price
                    updated += 1
                    print(f"  {c.title}: {old_price} -> {new_price} ₸")
        db.commit()
        print(f"Updated {updated} course prices.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
