"""Add parent user and link to student1 if not exists. Run: cd backend && python -c \"import sys; sys.path.insert(0,'..'); exec(open('../scripts/seed_parent.py').read())\" """
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def main():
    db = SessionLocal()
    try:
        parent = db.query(User).filter(User.email == "parent@edu.kz").first()
        if not parent:
            parent = User(
                email="parent@edu.kz",
                password_hash=get_password_hash("parent123"),
                full_name="Ата-ана (Родитель)",
                role="parent",
            )
            db.add(parent)
            db.flush()
            print("Created parent user: parent@edu.kz / parent123")
        student1 = db.query(User).filter(User.email == "student1@edu.kz").first()
        if student1 and not student1.parent_id and parent:
            student1.parent_id = parent.id
            print("Linked student1 to parent")
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    main()
