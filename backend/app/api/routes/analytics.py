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

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _leaderboard_data(db: Session, course_id: int | None, limit: int):
    subq = db.query(
        StudentProgress.user_id,
        func.avg(StudentProgress.test_score).label("avg_score"),
        func.count(distinct(StudentProgress.course_id)).label("courses_done"),
        func.count(StudentProgress.id).label("activity"),
    ).filter(StudentProgress.is_completed == True)
    if course_id:
        subq = subq.filter(StudentProgress.course_id == course_id)
    subq = subq.group_by(StudentProgress.user_id).subquery()
    
    # Assignment grades subquery
    assign_subq = db.query(
        AssignmentSubmission.student_id.label("user_id"),
        func.avg(AssignmentSubmission.grade).label("avg_assignment"),
    ).filter(
        AssignmentSubmission.grade.isnot(None),
    ).group_by(AssignmentSubmission.student_id).subquery()
    
    # Получаем студентов с прогрессом
    q_with_progress = db.query(
        User.id, User.full_name, User.email, User.points,
        subq.c.avg_score, subq.c.courses_done, subq.c.activity,
        assign_subq.c.avg_assignment,
    ).join(
        subq, User.id == subq.c.user_id
    ).outerjoin(
        assign_subq, User.id == assign_subq.c.user_id
    )
    
    rows_with_progress = q_with_progress.all()
    
    # Получаем ID студентов с прогрессом
    student_ids_with_progress = {r.id for r in rows_with_progress}
    
    # Получаем всех студентов без прогресса
    all_students = db.query(User).filter(User.role == "student").all()
    students_without_progress = [
        s for s in all_students 
        if s.id not in student_ids_with_progress
    ]
    
    # Формируем список студентов с прогрессом
    ranked_students = []
    for r in rows_with_progress:
        score = (
            (float(r.avg_score) if r.avg_score else 0) * 0.5
            + (float(r.avg_assignment) if r.avg_assignment else 0) * 0.2
            + (r.courses_done or 0) * 10 * 0.15
            + (r.activity or 0) * 0.15
        )
        ranked_students.append({
            "score": score,
            "user_id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "points": r.points or 0,
            "avg_score": float(r.avg_score) if r.avg_score else 0,
            "avg_assignment": float(r.avg_assignment) if r.avg_assignment else 0,
            "courses_done": r.courses_done or 0,
            "activity": r.activity or 0,
        })
    
    # Добавляем студентов без прогресса с нулевыми значениями
    for s in students_without_progress:
        ranked_students.append({
            "score": 0,
            "user_id": s.id,
            "full_name": s.full_name,
            "email": s.email,
            "points": s.points or 0,
            "avg_score": 0,
            "avg_assignment": 0,
            "courses_done": 0,
            "activity": 0,
        })
    
    # Сортируем по score (студенты с нулевыми значениями будут в конце)
    ranked_students.sort(key=lambda x: x["score"], reverse=True)
    
    # Ограничиваем лимитом и добавляем ранги
    result = []
    for i, student in enumerate(ranked_students[:limit]):
        result.append({
            "rank": i + 1,
            "user_id": student["user_id"],
            "full_name": student["full_name"],
            "email": student["email"],
            "avg_score": student["avg_score"],
            "avg_assignment": student["avg_assignment"],
            "courses_done": student["courses_done"],
            "activity": student["activity"],
            "points": student["points"],
        })
    
    return result


@router.get("/leaderboard")
def leaderboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    course_id: int | None = Query(None),
    limit: int = 100,
):
    return _leaderboard_data(db, course_id, limit)


@router.get("/leaderboard/csv")
def leaderboard_csv(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    course_id: int | None = Query(None),
    limit: int = 100,
):
    import csv
    import io
    data = _leaderboard_data(db, course_id, limit)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rank", "User ID", "Full Name", "Email", "Avg Score", "Courses Done", "Activity", "Points"])
    for r in data:
        writer.writerow([r["rank"], r["user_id"], r["full_name"], r["email"], r["avg_score"], r["courses_done"], r["activity"], r.get("points", 0)])
    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()  # UTF-8 BOM для корректного отображения в Excel
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=leaderboard.csv"},
    )


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
