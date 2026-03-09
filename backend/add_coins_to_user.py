"""
Скрипт для добавления монет пользователю по email.
Использование: python add_coins_to_user.py <email> <amount> [reason]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.services.coins import add_coins

def add_coins_to_user(email: str, amount: int, reason: str = "manual_admin_grant"):
    """Добавляет монеты пользователю по email."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ Пользователь с email '{email}' не найден")
            return False
        
        print(f"✅ Найден пользователь: {user.full_name} (ID: {user.id})")
        print(f"📊 Текущий баланс: {user.points or 0} монет")
        
        if add_coins(db, user.id, amount, reason):
            db.commit()
            db.refresh(user)
            print(f"✅ Успешно добавлено {amount} монет")
            print(f"📊 Новый баланс: {user.points} монет")
            return True
        else:
            print(f"❌ Ошибка при добавлении монет")
            return False
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Использование: python add_coins_to_user.py <email> <amount> [reason]")
        print("Пример: python add_coins_to_user.py student1@edu.kz 1000")
        sys.exit(1)
    
    email = sys.argv[1]
    try:
        amount = int(sys.argv[2])
    except ValueError:
        print("❌ Количество монет должно быть числом")
        sys.exit(1)
    
    reason = sys.argv[3] if len(sys.argv) > 3 else "manual_admin_grant"
    
    add_coins_to_user(email, amount, reason)
