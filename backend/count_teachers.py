import sys
import os

# Add current directory to path so 'app' can be found
sys.path.append(os.getcwd())

from app.core.database import SessionLocal
from app.models.user import User

def count_teachers():
    db = SessionLocal()
    try:
        teachers = db.query(User).filter(User.role == 'teacher').all()
        print(f"Total teachers found: {len(teachers)}")
        for i, u in enumerate(teachers, 1):
            print(f"{i}. {u.full_name} ({u.email}) - ID: {u.id}")
    finally:
        db.close()

if __name__ == "__main__":
    count_teachers()
