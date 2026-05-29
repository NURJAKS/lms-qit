"""Загрузка строк лидерборда: все студенты, прогресс и оценки за задания (с фильтром по курсу)."""

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.models.assignment_submission import AssignmentSubmission
from app.models.progress import StudentProgress
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User
from app.services.leaderboard_scoring import composite_rating


def _progress_subq(db: Session, course_id: int | None):
    q = (
        db.query(
            StudentProgress.user_id,
            func.avg(StudentProgress.test_score).label("avg_score"),
            func.count(distinct(StudentProgress.course_id)).label("courses_done"),
            func.count(StudentProgress.id).label("activity"),
        )
        .filter(StudentProgress.is_completed.is_(True))
    )
    if course_id is not None:
        q = q.filter(StudentProgress.course_id == course_id)
    return q.group_by(StudentProgress.user_id).subquery()


def _assign_subq(db: Session, course_id: int | None):
    q = (
        db.query(
            AssignmentSubmission.student_id.label("user_id"),
            func.avg(AssignmentSubmission.grade).label("avg_assignment"),
        )
        .join(TeacherAssignment, TeacherAssignment.id == AssignmentSubmission.assignment_id)
        .filter(AssignmentSubmission.grade.isnot(None))
    )
    if course_id is not None:
        q = q.filter(TeacherAssignment.course_id == course_id)
    return q.group_by(AssignmentSubmission.student_id).subquery()


def fetch_leaderboard_rows(db: Session, course_id: int | None = None) -> list[dict]:
    """
    Все пользователи с role=student с метриками и rating_score.
    Сортировка: rating_score DESC, points DESC, user_id ASC.
    """
    subq = _progress_subq(db, course_id)
    assign_subq = _assign_subq(db, course_id)

    rows = (
        db.query(
            User.id,
            User.full_name,
            User.email,
            User.points,
            subq.c.avg_score,
            subq.c.courses_done,
            subq.c.activity,
            assign_subq.c.avg_assignment,
        )
        .filter(User.role == "student")
        .outerjoin(subq, User.id == subq.c.user_id)
        .outerjoin(assign_subq, User.id == assign_subq.c.user_id)
        .all()
    )

    out: list[dict] = []
    for r in rows:
        avg_score = float(r.avg_score) if r.avg_score is not None else 0.0
        avg_assignment = float(r.avg_assignment) if r.avg_assignment is not None else 0.0
        courses_done = int(r.courses_done or 0)
        activity = int(r.activity or 0)
        points = int(r.points or 0)
        rating = composite_rating(avg_score, avg_assignment, courses_done, activity)
        out.append(
            {
                "user_id": r.id,
                "full_name": r.full_name or "",
                "email": r.email or "",
                "points": points,
                "avg_score": round(avg_score, 2),
                "avg_assignment": round(avg_assignment, 2),
                "courses_done": courses_done,
                "activity": activity,
                "rating_score": rating,
            }
        )

    out.sort(key=lambda x: (-x["rating_score"], -x["points"], x["user_id"]))
    return out
