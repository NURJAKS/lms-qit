#!/usr/bin/env python3
# Запуск: cd backend && python3 clear_mock_progress.py
"""
Очищает моковый прогресс. seed_mock_progress.py помечает темы как пройденные для демо.
После этого скрипта студенты увидят реальный прогресс (только то, что прошли сами).

Запуск: cd backend && python clear_mock_progress.py
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import User, StudentProgress

def main():
    db = SessionLocal()
    try:
        students = db.query(User).filter(User.role == 'student').all()
        if not students:
            print("Нет студентов в базе.")
            return

        deleted = 0
        for s in students:
            n = db.query(StudentProgress).filter(StudentProgress.user_id == s.id).delete()
            deleted += n

        db.commit()
        print(f"Удалено записей прогресса: {deleted}.")
        print("Студенты теперь видят только реально пройденные темы.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
