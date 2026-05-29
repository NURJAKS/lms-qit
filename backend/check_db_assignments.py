import sys
from pathlib import Path

# Корень backend (рядом с app/)
_backend = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))

from app.core.database import SessionLocal
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission

def check_assignments():
    db = SessionLocal()
    try:
        assignments = db.query(TeacherAssignment).all()
        print(f"Total assignments: {len(assignments)}")
        for a in assignments:
            print(f"ID: {a.id}, Title: {a.title}, Deadline: {a.deadline}, Closed: {a.closed_at}")
            
        submissions = db.query(AssignmentSubmission).all()
        print(f"\nTotal submissions: {len(submissions)}")
        for s in submissions:
            print(f"Assignment ID: {s.assignment_id}, Student ID: {s.student_id}, Grade: {s.grade}, Submitted At: {s.submitted_at}")
    finally:
        db.close()

if __name__ == "__main__":
    check_assignments()
