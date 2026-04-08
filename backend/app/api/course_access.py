from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.enrollment import CourseEnrollment
from app.models.add_student_task import AddStudentTask
from app.models.group_student import GroupStudent
from app.models.teacher_group import TeacherGroup
from app.models.user import User


PENDING_GROUP_DETAIL = "pending_group"


def has_course_group_membership(db: Session, user_id: int, course_id: int) -> bool:
    return (
        db.query(GroupStudent)
        .join(TeacherGroup, TeacherGroup.id == GroupStudent.group_id)
        .filter(
            GroupStudent.student_id == user_id,
            TeacherGroup.course_id == course_id,
        )
        .first()
        is not None
    )


def course_has_groups(db: Session, course_id: int) -> bool:
    return db.query(TeacherGroup).filter(TeacherGroup.course_id == course_id).first() is not None


def has_manager_assignment_for_course(db: Session, user_id: int, course_id: int) -> bool:
    return (
        db.query(AddStudentTask)
        .join(TeacherGroup, TeacherGroup.id == AddStudentTask.group_id)
        .filter(
            AddStudentTask.student_id == user_id,
            TeacherGroup.course_id == course_id,
        )
        .first()
        is not None
    )


def is_student_course_ready_for_content(db: Session, user_id: int, course_id: int) -> bool:
    if not course_has_groups(db, course_id):
        return True
    # If the student is already added to any group for the course, access should open
    # even when manager assignment task was not created beforehand.
    if has_course_group_membership(db, user_id, course_id):
        return True
    # Keep legacy "manager assigned" state meaningful for pending screens/UX.
    _ = has_manager_assignment_for_course(db, user_id, course_id)
    return False


def has_any_ready_course_access(db: Session, user_id: int) -> bool:
    enrollments = db.query(CourseEnrollment.course_id).filter(CourseEnrollment.user_id == user_id).all()
    for (course_id,) in enrollments:
        if is_student_course_ready_for_content(db, user_id, course_id):
            return True
    return False


def assert_can_access_course_materials(db: Session, user: User, course_id: int) -> None:
    enrollment = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.user_id == user.id,
            CourseEnrollment.course_id == course_id,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Сначала запишитесь на курс.")

    if user.role != "student":
        return

    if is_student_course_ready_for_content(db, user.id, course_id):
        return

    raise HTTPException(status_code=403, detail=PENDING_GROUP_DETAIL)


def can_view_course_structure_video_urls(db: Session, user: User, course: Course) -> bool:
    if user.role in ("admin", "director", "curator", "teacher"):
        return True
    if user.role != "student":
        return False
    try:
        assert_can_access_course_materials(db, user, course.id)
    except HTTPException:
        return False
    return True
