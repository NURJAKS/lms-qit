"""
Скрипт для создания тестовых курьеров.
Запуск: python seed_couriers.py (из директории backend)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import User
from app.core.security import get_password_hash

def seed_couriers():
    db = SessionLocal()
    try:
        # Список курьеров с казахскими именами
        couriers_data = [
            {
                "email": "courier1@edu.kz",
                "full_name": "Асқар Нұрлан",
                "phone": "+77001234567",
            },
            {
                "email": "courier2@edu.kz",
                "full_name": "Ерлан Дәулет",
                "phone": "+77001234568",
            },
            {
                "email": "courier3@edu.kz",
                "full_name": "Мұрат Серік",
                "phone": "+77001234569",
            },
            {
                "email": "courier4@edu.kz",
                "full_name": "Нұрбек Айбек",
                "phone": "+77001234570",
            },
            {
                "email": "courier5@edu.kz",
                "full_name": "Айдар Қасым",
                "phone": "+77001234571",
            },
        ]

        created_count = 0
        for courier_data in couriers_data:
            # Проверяем, существует ли уже курьер с таким email
            existing = db.query(User).filter(User.email == courier_data["email"]).first()
            if existing:
                print(f"Курьер {courier_data['email']} уже существует, пропускаем")
                continue

            courier = User(
                email=courier_data["email"],
                password_hash=get_password_hash("courier123"),
                full_name=courier_data["full_name"],
                role="courier",
                phone=courier_data["phone"],
            )
            db.add(courier)
            created_count += 1
            print(f"Создан курьер: {courier_data['full_name']} ({courier_data['email']})")

        db.commit()
        print(f"\nУспешно создано {created_count} курьеров")
    except Exception as e:
        db.rollback()
        print(f"Ошибка при создании курьеров: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_couriers()
