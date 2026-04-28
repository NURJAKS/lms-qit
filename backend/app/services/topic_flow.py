"""Гейты цикла темы: видео → конспект → домашка (оценена) → тест."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.course_topic import CourseTopic
from app.models.progress import StudentProgress
from app.models.group_student import GroupStudent
from app.models.teacher_group import TeacherGroup
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.models.topic_synopsis import TopicSynopsisSubmission


def student_group_ids_for_course(db: Session, user_id: int, course_id: int) -> list[int]:
    rows = (
        db.query(GroupStudent.group_id)
        .join(TeacherGroup, TeacherGroup.id == GroupStudent.group_id)
        .filter(
            GroupStudent.student_id == user_id,
            TeacherGroup.course_id == course_id,
        )
        .all()
    )
    return [r[0] for r in rows]


def video_requirement_met(db: Session, user_id: int, topic: CourseTopic) -> bool:
    if not (topic.video_url or "").strip():
        return True
    prog = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.topic_id == topic.id,
        )
        .first()
    )
    if prog and prog.is_completed:
        return True
    effective_duration = (topic.video_duration or 0) or 300
    if effective_duration <= 0:
        return True
    watched = (prog.video_watched_seconds if prog else 0) or 0
    # Requirement: watch at least 90% of the video (lowered from 99% for better UX)
    return watched / effective_duration >= 0.90


def synopsis_graded(db: Session, user_id: int, topic_id: int) -> bool:
    """Проверка: оценен ли конспект по теме (через специальное задание)."""
    # Find synopsis assignment for this topic
    sa = db.query(TeacherAssignment).filter(
        TeacherAssignment.topic_id == topic_id,
        TeacherAssignment.is_synopsis == True,
        TeacherAssignment.is_supplementary == False,
    ).first()
    if not sa:
        return True
    
    sub = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.student_id == user_id,
            AssignmentSubmission.assignment_id == sa.id,
        )
        .first()
    )
    return sub is not None and sub.grade is not None


def synopsis_submitted(db: Session, user_id: int, topic_id: int) -> bool:
    sa = db.query(TeacherAssignment).filter(
        TeacherAssignment.topic_id == topic_id,
        TeacherAssignment.is_synopsis == True,
        TeacherAssignment.is_supplementary == False,
    ).first()
    if not sa:
        return True

    return (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.student_id == user_id,
            AssignmentSubmission.assignment_id == sa.id,
        )
        .first()
        is not None
    )


def topic_assignments_for_student(
    db: Session, user_id: int, topic_id: int, course_id: int
) -> list[TeacherAssignment]:
    gids = student_group_ids_for_course(db, user_id, course_id)
    if not gids:
        return []
    return (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.topic_id == topic_id,
            TeacherAssignment.course_id == course_id,
            TeacherAssignment.group_id.in_(gids),
            TeacherAssignment.is_supplementary == False,
        )
        .all()
    )


def all_assignments_graded(
    db: Session, user_id: int, assignments: list[TeacherAssignment]
) -> bool:
    if not assignments:
        return True
    for a in assignments:
        sub = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.student_id == user_id,
                AssignmentSubmission.assignment_id == a.id,
            )
            .first()
        )
        if sub is None or sub.grade is None:
            return False
    return True


def can_take_topic_test(db: Session, user_id: int, topic_id: int, course_id: int) -> tuple[bool, str]:
    """
    Возвращает (allowed, reason_code) для доступа к контрольному тесту темы.
    reason_code: ok | no_groups | video | synopsis | no_assignment | wait_grade
    """
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        return False, "video"
    gids = student_group_ids_for_course(db, user_id, course_id)
    if not gids:
        return False, "no_groups"
    if not video_requirement_met(db, user_id, topic):
        return False, "video"
    if not synopsis_submitted(db, user_id, topic_id):
        return False, "synopsis"
    assigns = topic_assignments_for_student(db, user_id, topic_id, course_id)
    if assigns and not all_assignments_graded(db, user_id, assigns):
        return False, "wait_grade"
    return True, "ok"


def topic_test_gate_message(reason: str) -> str:
    return {
        "ok": "",
        "no_groups": "topicGateNoGroups",
        "video": "topicGateVideo",
        "synopsis": "topicGateSynopsis",
        "no_assignment": "topicGateNoAssignment",
        "wait_grade": "topicGateWaitGrade",
    }.get(reason, "topicGateDefault")


def topic_flow_status(db: Session, user_id: int, topic: CourseTopic) -> dict:
    """Сводка для UI страницы темы."""
    course_id = topic.course_id
    gids = student_group_ids_for_course(db, user_id, course_id)
    video_ok = video_requirement_met(db, user_id, topic)
    syn_done = synopsis_submitted(db, user_id, topic.id)
    syn_graded = synopsis_graded(db, user_id, topic.id)
    assigns = topic_assignments_for_student(db, user_id, topic.id, course_id)
    has_hw = len(assigns) > 0
    graded_ok = all_assignments_graded(db, user_id, assigns) if assigns else True
    can_test, reason = can_take_topic_test(db, user_id, topic.id, course_id)

    return {
        "has_course_groups": len(gids) > 0,
        "video_ok": video_ok,
        "theory_unlocked": video_ok,
        "synopsis_done": syn_done,
        "synopsis_graded": syn_graded,
        "homework_exists": has_hw,
        "homework_graded": graded_ok,
        "can_take_test": False,
        "block_reason": "none",
        "topic_assignment_ids": [a.id for a in assigns],
    }
