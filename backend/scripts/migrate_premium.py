"""Добавляет колонку is_premium в users и создаёт таблицу premium_subscriptions."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import engine
from app.models import Base

# Создаём все таблицы (premium_subscriptions)
Base.metadata.create_all(bind=engine)

# Добавляем колонку is_premium если её нет
db_url = str(engine.url)
with engine.connect() as conn:
    has_column = False
    if "sqlite" in db_url:
        result = conn.execute(text("PRAGMA table_info(users)"))
        for row in result:
            if row[1] == "is_premium":
                has_column = True
                break
    else:
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'is_premium'
        """))
        has_column = result.fetchone() is not None
    if not has_column:
        conn.execute(text("ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0"))
        conn.commit()
        print("Колонка is_premium добавлена в users.")
    else:
        print("Колонка is_premium уже существует.")
    print("Миграция premium завершена.")
