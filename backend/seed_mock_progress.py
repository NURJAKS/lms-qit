"""
Добавляет демо-данные: записи на курсы, группы, задания. Без фейкового прогресса — прогресс только реальный.
Запуск: cd backend && python3 seed_mock_progress.py
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import (
    User, Course, CourseEnrollment,
    TeacherGroup, GroupStudent, TeacherAssignment, AssignmentSubmission,
)
from datetime import datetime, timezone, timedelta
from decimal import Decimal

def seed():
    db = SessionLocal()
    try:
        students = db.query(User).filter(User.role == 'student').all()
        teachers = db.query(User).filter(User.role == 'teacher').all()
        courses = db.query(Course).filter(Course.is_active == True).all()
        if not students or not courses or not teachers:
            print("Run seed_data.py first.")
            return

        course1, course2 = courses[0], courses[1]

        # Enroll all students in both courses (без фейкового прогресса)
        for s in students:
            for c in [course1, course2]:
                if not db.query(CourseEnrollment).filter(CourseEnrollment.user_id == s.id, CourseEnrollment.course_id == c.id).first():
                    db.add(CourseEnrollment(user_id=s.id, course_id=c.id, payment_confirmed=True))

        db.commit()

        # --- Create Groups ---
        groups = []
        for i, c in enumerate(courses[:3]):
            g_name = f"{c.title} топ {i+1}"
            gr = db.query(TeacherGroup).filter(TeacherGroup.group_name == g_name).first()
            if not gr:
                gr = TeacherGroup(teacher_id=teachers[0].id, course_id=c.id, group_name=g_name)
                db.add(gr)
                db.flush()
            groups.append(gr)

        # --- Distribute Students among Groups ---
        # Each student is added to one of the 3 groups
        for idx, s in enumerate(students):
            gr = groups[idx % len(groups)]
            if not db.query(GroupStudent).filter(GroupStudent.group_id == gr.id, GroupStudent.student_id == s.id).first():
                db.add(GroupStudent(group_id=gr.id, student_id=s.id))
        
        db.commit()

        # --- Create Assignments for each Group ---
        for gr in groups:
            # First Assignment
            asn1 = db.query(TeacherAssignment).filter(TeacherAssignment.group_id == gr.id, TeacherAssignment.title == "Тапсырма 1: Кіріспе").first()
            if not asn1:
                asn1 = TeacherAssignment(
                    teacher_id=teachers[0].id,
                    group_id=gr.id,
                    course_id=gr.course_id,
                    title="Тапсырма 1: Кіріспе",
                    description="Осы тақырып бойынша негізгі ұғымдарды түсіндіріп беріңіз.",
                    deadline=datetime.now(timezone.utc) + timedelta(days=7)
                )
                db.add(asn1)
                db.flush()

            # Second Assignment
            asn2 = db.query(TeacherAssignment).filter(TeacherAssignment.group_id == gr.id, TeacherAssignment.title == "Практикалық жұмыс").first()
            if not asn2:
                asn2 = TeacherAssignment(
                    teacher_id=teachers[0].id,
                    group_id=gr.id,
                    course_id=gr.course_id,
                    title="Практикалық жұмыс",
                    description="Өтілген материалды іс жүзінде қолданыңыз.",
                    deadline=datetime.now(timezone.utc) + timedelta(days=14)
                )
                db.add(asn2)
                db.flush()

            # --- Add Submissions for Students in this Group ---
            group_students = db.query(GroupStudent).filter(GroupStudent.group_id == gr.id).limit(10).all()
            for gs in group_students:
                s_id = gs.student_id
                # Submission for asn1 (Graded)
                if not db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == asn1.id, AssignmentSubmission.student_id == s_id).first():
                    db.add(AssignmentSubmission(
                        assignment_id=asn1.id,
                        student_id=s_id,
                        submission_text="Мен тапсырманы орындадым. Мазмұны өте қызықты болды.",
                        grade=Decimal("90") if s_id % 2 == 0 else Decimal("85"),
                        teacher_comment="Жақсы жұмыс! Түсініктемелер дұрыс.",
                        submitted_at=datetime.now(timezone.utc) - timedelta(days=1)
                    ))
                
                # Submission for asn2 (Pending grade)
                if not db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == asn2.id, AssignmentSubmission.student_id == s_id).first() and s_id % 3 == 0:
                    db.add(AssignmentSubmission(
                        assignment_id=asn2.id,
                        student_id=s_id,
                        submission_text="Екінші тапсырма дайын. Тексеруіңізді сұраймын.",
                        grade=None,
                        submitted_at=datetime.now(timezone.utc) - timedelta(hours=5)
                    ))

        db.commit()
        print("Demo data seeded: all 35 students distributed, assignments and submissions created.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
