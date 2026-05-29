import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from app.models.assignment_private_comment import AssignmentPrivateComment

def migrate():
    print("Creating assignment_private_comments table...")
    AssignmentPrivateComment.metadata.create_all(bind=engine, tables=[AssignmentPrivateComment.__table__])
    print("Done!")

if __name__ == "__main__":
    migrate()
