#!/usr/bin/env python3
"""
Сброс пароля пользователя по email (DATABASE_URL из окружения).

  cd backend && DATABASE_URL=postgresql://... python scripts/set_user_password.py user@mail.com НовыйПароль

Docker:
  docker compose ... exec backend python scripts/set_user_password.py zhandossahiev@gmail.com zhandos123
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


def main() -> int:
    if len(sys.argv) != 3:
        print("Использование: set_user_password.py <email> <новый_пароль>")
        return 1
    email = sys.argv[1].strip().lower()
    password = sys.argv[2]
    db: Session = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            # подсказка по опечатке sahlev/sahiev
            alt = email.replace("sahlev", "sahiev")
            if alt != email:
                u = db.query(User).filter(User.email == alt).first()
            if not u:
                print(f"Пользователь не найден: {email}")
                return 1
            print(f"Найден по каноническому email: {u.email}")
        u.password_hash = get_password_hash(password)
        db.commit()
        print("Пароль обновлён.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
