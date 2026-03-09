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

        # Teacher groups
        t1 = teachers[0]
        gr = db.query(TeacherGroup).filter(TeacherGroup.teacher_id == t1.id, TeacherGroup.course_id == course1.id).first()
        if not gr:
            gr = TeacherGroup(teacher_id=t1.id, course_id=course1.id, group_name="Python топ 1")
            db.add(gr)
            db.flush()
        for s in students[:3]:
            if not db.query(GroupStudent).filter(GroupStudent.group_id == gr.id, GroupStudent.student_id == s.id).first():
                db.add(GroupStudent(group_id=gr.id, student_id=s.id))

        # Assignment
        asn = db.query(TeacherAssignment).filter(TeacherAssignment.group_id == gr.id).first()
        if not asn:
            asn = TeacherAssignment(teacher_id=t1.id, group_id=gr.id, course_id=course1.id, title="Тапсырма 1: Циклдар", description="for және while циклдарын қолданып программа жазыңыз.", deadline=datetime.now(timezone.utc) + timedelta(days=7))
            db.add(asn)
            db.flush()
        for s in students[:2]:
            if not db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == asn.id, AssignmentSubmission.student_id == s.id).first():
                db.add(AssignmentSubmission(assignment_id=asn.id, student_id=s.id, submission_text="Мен циклдарды қолданып программа жасадым.", grade=Decimal("95"), teacher_comment="Жақсы жұмыс!"))

        db.commit()
        print("Demo data seeded: enrollments, groups, assignments. Progress — только реальный.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
