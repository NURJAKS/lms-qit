from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.api.deps import get_current_user, get_current_admin_user
from app.core.database import get_db
from app.models.user import User
from app.models.progress import StudentProgress
from app.models.course import Course
from app.models.certificate import Certificate
from app.models.enrollment import CourseEnrollment
from app.models.daily_leaderboard_reward import DailyLeaderboardReward
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.services.export_service import generate_xlsx_response
from app.services.leaderboard_query import fetch_leaderboard_rows

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _leaderboard_data(db: Session, course_id: int | None, limit: int):
    ranked = fetch_leaderboard_rows(db, course_id)
    result = []
    for i, student in enumerate(ranked[:limit]):
        result.append(
            {
                "rank": i + 1,
                "user_id": student["user_id"],
                "full_name": student["full_name"],
                "email": student["email"],
                "avg_score": student["avg_score"],
                "avg_assignment": student["avg_assignment"],
                "courses_done": student["courses_done"],
                "activity": student["activity"],
                "points": student["points"],
                "rating_score": student["rating_score"],
            }
        )
    return result


@router.get("/leaderboard")
def leaderboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    course_id: int | None = Query(None),
    limit: int = 100,
):
    return _leaderboard_data(db, course_id, limit)


@router.get("/leaderboard/excel")
def leaderboard_excel(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    lang: str = Query("ru"),
):
    """Экспорт рейтинга студентов в Excel (та же формула, что у вкладки «Рейтинг»)."""
    ranked = fetch_leaderboard_rows(db, course_id=None)

    if lang == "kk":
        headers = [
            "Орын",
            "Аты-жөні",
            "Email",
            "Рейтинг баллы",
            "Тест орташа",
            "Тапсырма орташа",
            "Аяқталған курстар",
            "Белсенділік",
            "Ұпайлар",
        ]
        filename = "reiting"
    elif lang == "en":
        headers = [
            "Rank",
            "Full Name",
            "Email",
            "Rating score",
            "Avg test score",
            "Avg assignment grade",
            "Courses with progress",
            "Completed topics",
            "Points",
        ]
        filename = "leaderboard"
    else:
        headers = [
            "Место",
            "ФИО",
            "Email",
            "Итог рейтинга",
            "Средний балл (тесты)",
            "Средняя оценка (задания)",
            "Курсов с прогрессом",
            "Завершено тем",
            "Баллы",
        ]
        filename = "reiting"

    rows = []
    for i, r in enumerate(ranked):
        rows.append(
            [
                i + 1,
                r["full_name"],
                r["email"],
                r["rating_score"],
                r["avg_score"],
                r["avg_assignment"],
                r["courses_done"],
                r["activity"],
                r["points"],
            ]
        )

    return generate_xlsx_response(rows, filename, headers, sheet_name="Leaderboard")


@router.get("/leaderboard/my-last-reward")
def leaderboard_my_last_reward(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Последняя ежедневная награда текущего пользователя."""
    r = (
        db.query(DailyLeaderboardReward)
        .filter(DailyLeaderboardReward.user_id == current_user.id)
        .order_by(DailyLeaderboardReward.date.desc())
        .first()
    )
    if not r:
        return None
    return {"date": r.date.isoformat(), "rank": r.rank, "amount": r.amount}


@router.get("/leaderboard/{user_id}/top-history")
def leaderboard_user_top_history(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """История попадания юзера в топ-3 лидерборда."""
    history = (
        db.query(DailyLeaderboardReward)
        .filter(DailyLeaderboardReward.user_id == user_id, DailyLeaderboardReward.rank <= 3)
        .order_by(DailyLeaderboardReward.date.desc())
        .all()
    )
    return [
        {"date": h.date.isoformat(), "rank": h.rank, "amount": h.amount}
        for h in history
    ]



@router.get("/leaderboard/{user_id}/courses")
def leaderboard_user_courses(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Курсы студента из рейтинга (где есть завершённый прогресс)."""
    progress = (
        db.query(distinct(StudentProgress.course_id))
        .filter(StudentProgress.user_id == user_id, StudentProgress.is_completed == True)
        .all()
    )
    course_ids = [r[0] for r in progress if r[0]]
    if not course_ids:
        return []
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    return [{"course_id": c.id, "course_title": c.title} for c in courses]


@router.get("/course-stats")
def course_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    course_id: int | None = None,
):
    from app.models.course_topic import CourseTopic
    
    if course_id:
        enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course_id).count()
        completed = db.query(StudentProgress).filter(StudentProgress.course_id == course_id, StudentProgress.is_completed == True).count()
        total_topics = db.query(CourseTopic).filter(CourseTopic.course_id == course_id).count()
        return {"course_id": course_id, "enrollments": enrollments, "completed_topics": completed, "total_topics": total_topics}
    courses = db.query(Course).filter(Course.is_active == True).all()
    out = []
    for c in courses:
        enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == c.id).count()
        completed = db.query(StudentProgress).filter(StudentProgress.course_id == c.id, StudentProgress.is_completed == True).count()
        total_topics = db.query(CourseTopic).filter(CourseTopic.course_id == c.id).count()
        out.append({"course_id": c.id, "title": c.title, "enrollments": enrollments, "completed_topics": completed, "total_topics": total_topics})
    return out


@router.get("/completions-over-time")
def completions_over_time(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    days: int = Query(30, ge=1, le=365),
):
    """Завершения тем по дням за последние N дней."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    date_col = func.coalesce(StudentProgress.completed_at, StudentProgress.created_at)
    rows = (
        db.query(func.date(date_col).label("date"), func.count(StudentProgress.id).label("count"))
        .filter(StudentProgress.is_completed == True, date_col >= since)
        .group_by(func.date(date_col))
        .order_by(func.date(date_col))
        .all()
    )
    return {"data": [{"date": str(r.date), "count": r.count} for r in rows]}


@router.get("/new-users")
def new_users_over_time(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    days: int = Query(30, ge=1, le=365),
):
    """Новые пользователи по дням за последние N дней."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(func.date(User.created_at).label("date"), func.count(User.id).label("count"))
        .filter(User.created_at >= since)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
        .all()
    )
    return {"data": [{"date": str(r.date), "count": r.count} for r in rows]}


@router.get("/assignments-summary")
def assignments_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Задания: всего, на проверке, проверено."""
    total_assignments = db.query(TeacherAssignment).count()
    pending = db.query(AssignmentSubmission).filter(AssignmentSubmission.graded_at.is_(None)).count()
    graded = db.query(AssignmentSubmission).filter(AssignmentSubmission.graded_at.isnot(None)).count()
    return {
        "total_assignments": total_assignments,
        "pending": pending,
        "graded": graded,
    }
