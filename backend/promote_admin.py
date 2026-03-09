#!/usr/bin/env python3
"""
Назначить роль admin пользователю по email.
Запуск из папки backend: python promote_admin.py <email>

Пример: python promote_admin.py nirbor4@gmail.com
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User


def main():
    if len(sys.argv) < 2:
        print("Использование: python promote_admin.py <email>")
        print("Пример: python promote_admin.py nirbor4@gmail.com")
        sys.exit(1)

    email = sys.argv[1].strip()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Пользователь с email {email} не найден.")
            sys.exit(1)
        if user.role == "admin":
            print(f"Пользователь {email} уже имеет роль admin.")
            sys.exit(0)
        user.role = "admin"
        db.commit()
        print(f"Роль admin назначена пользователю {email}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
