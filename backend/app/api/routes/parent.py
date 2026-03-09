from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.progress import StudentProgress
from app.models.enrollment import CourseEnrollment
from app.models.course import Course
from app.models.course_topic import CourseTopic
from app.models.certificate import Certificate
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from sqlalchemy import func, distinct

router = APIRouter(prefix="/parent", tags=["parent"])


def _is_parent_or_admin(user: User) -> bool:
    return user.role in ("parent", "admin", "director", "curator")


def _get_child_or_403(student_id: int, current_user: User, db: Session) -> User:
    """Return child if parent has access; raise 403/404 otherwise."""
    if not _is_parent_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Доступ только для родителей")
    child = db.query(User).filter(User.id == student_id, User.parent_id == current_user.id).first()
    if not child and current_user.role not in ("admin", "director", "curator"):
        raise HTTPException(status_code=404, detail="Ребёнок не найден")
    if not child:
        child = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not child:
        raise HTTPException(status_code=404, detail="Студент не найден")
    return child


@router.get("/children")
def list_children(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not _is_parent_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Доступ только для родителей")
    children = db.query(User).filter(User.parent_id == current_user.id, User.role == "student").all()
    return [{"id": c.id, "full_name": c.full_name, "email": c.email} for c in children]


@router.get("/children/{student_id}/progress")
def child_progress(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not _is_parent_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Доступ только для родителей")
    child = db.query(User).filter(User.id == student_id, User.parent_id == current_user.id).first()
    if not child and current_user.role not in ("admin", "director", "curator"):
        raise HTTPException(status_code=404, detail="Ребёнок не найден")
    if not child:
        child = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not child:
        raise HTTPException(status_code=404, detail="Студент не найден")
    progress = db.query(StudentProgress).filter(StudentProgress.user_id == child.id).all()
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == child.id).all()
    course_ids = list({e.course_id for e in enrollments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    out = []
    for p in progress:
        c = courses.get(p.course_id)
        out.append({
            "course_id": p.course_id,
            "course_title": c.title if c else "",
            "topic_id": p.topic_id,
            "is_completed": p.is_completed,
            "test_score": float(p.test_score) if p.test_score else None,
        })
    return {
        "student": {"id": child.id, "full_name": child.full_name, "email": child.email},
        "progress": out,
    }


@router.get("/children/{student_id}/assignments")
def child_assignments(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Список заданий ребёнка (от учителя) с статусами сдачи."""
    child = _get_child_or_403(student_id, current_user, db)
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == child.id).all()]
    if not group_ids:
        return {"student": {"id": child.id, "full_name": child.full_name, "email": child.email}, "assignments": []}
    assignments = db.query(TeacherAssignment).filter(TeacherAssignment.group_id.in_(group_ids)).order_by(TeacherAssignment.id.desc()).all()
    course_ids = list({a.course_id for a in assignments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    submissions_by_assignment = {}
    for s in db.query(AssignmentSubmission).filter(
        AssignmentSubmission.student_id == child.id,
        AssignmentSubmission.assignment_id.in_([a.id for a in assignments]),
    ).all():
        submissions_by_assignment[s.assignment_id] = s
    out = []
    for a in assignments:
        sub = submissions_by_assignment.get(a.id)
        out.append({
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "course_id": a.course_id,
            "course_title": courses[a.course_id].title if a.course_id in courses else "",
            "deadline": a.deadline.isoformat() if a.deadline else None,
            "submitted": sub is not None,
            "grade": float(sub.grade) if sub and sub.grade else None,
            "teacher_comment": sub.teacher_comment if sub else None,
        })
    return {
        "student": {"id": child.id, "full_name": child.full_name, "email": child.email},
        "assignments": out,
    }


@router.get("/children/{student_id}/report")
def child_report(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Detailed report: courses enrolled, progress per course, certificates, overall stats."""
    if not _is_parent_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Доступ только для родителей")
    child = db.query(User).filter(User.id == student_id, User.parent_id == current_user.id).first()
    if not child and current_user.role not in ("admin", "director", "curator"):
        raise HTTPException(status_code=404, detail="Ребёнок не найден")
    if not child:
        child = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not child:
        raise HTTPException(status_code=404, detail="Студент не найден")

    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == child.id).all()
    course_ids = list({e.course_id for e in enrollments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    all_topics = db.query(CourseTopic).filter(CourseTopic.course_id.in_(course_ids)).all()
    topics_by_course = {}
    topic_by_id = {t.id: t for t in all_topics}
    for t in all_topics:
        topics_by_course.setdefault(t.course_id, []).append(t)
    progress_rows = db.query(StudentProgress).filter(StudentProgress.user_id == child.id).all()
    certs = db.query(Certificate).filter(Certificate.user_id == child.id).all()
    certs_by_course = {c.course_id: c for c in certs}

    courses_report = []
    all_scores = []
    total_topics_done = 0

    for course_id in course_ids:
        course = courses.get(course_id)
        topics = topics_by_course.get(course_id, [])
        total_topics = len(topics)
        completed_progress = [p for p in progress_rows if p.course_id == course_id and p.is_completed]
        completed_topic_ids = {p.topic_id for p in completed_progress if p.topic_id}
        topics_completed = len(completed_topic_ids)
        completed_topic_titles = [topic_by_id[tid].title for tid in completed_topic_ids if tid in topic_by_id]
        total_topics_done += topics_completed
        completion_pct = round((topics_completed / total_topics * 100) if total_topics else 0, 1)
        test_scores = [float(p.test_score) for p in completed_progress if p.test_score is not None]
        all_scores.extend(test_scores)
        avg_score = round(sum(test_scores) / len(test_scores), 1) if test_scores else None
        cert = certs_by_course.get(course_id)
        courses_report.append({
            "course_id": course_id,
            "course_title": course.title if course else "",
            "progress_percent": completion_pct,
            "topics_completed": topics_completed,
            "completed_topic_titles": completed_topic_titles,
            "total_topics": total_topics,
            "test_scores": test_scores,
            "avg_test_score": avg_score,
            "certificate": {
                "id": cert.id,
                "final_score": float(cert.final_score) if cert and cert.final_score else None,
                "issued_at": cert.issued_at.isoformat() if cert and cert.issued_at else None,
            } if cert else None,
        })

    overall_avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None
    
    # Дополнительные метрики: время обучения, оценки за задания
    total_video_seconds = sum(p.video_watched_seconds or 0 for p in progress_rows)
    total_study_hours = round(total_video_seconds / 3600, 1)
    
    # Оценки за задания от учителя
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == child.id).all()]
    assignment_grades = []
    if group_ids:
        submissions = db.query(AssignmentSubmission).filter(
            AssignmentSubmission.student_id == child.id,
            AssignmentSubmission.grade.isnot(None),
        ).all()
        assignment_grades = [float(s.grade) for s in submissions]
    
    assignment_avg = round(sum(assignment_grades) / len(assignment_grades), 1) if assignment_grades else None
    
    # Позиция в рейтинге (если есть прогресс)
    
    rank = None
    if progress_rows:
        subq = db.query(
            StudentProgress.user_id,
            func.avg(StudentProgress.test_score).label("avg_score"),
            func.count(distinct(StudentProgress.course_id)).label("courses_done"),
            func.count(StudentProgress.id).label("activity"),
        ).filter(StudentProgress.is_completed == True).group_by(StudentProgress.user_id).subquery()
        
        assign_subq = db.query(
            AssignmentSubmission.student_id.label("user_id"),
            func.avg(AssignmentSubmission.grade).label("avg_assignment"),
        ).filter(AssignmentSubmission.grade.isnot(None)).group_by(AssignmentSubmission.student_id).subquery()
        
        all_ranked = db.query(
            User.id,
            (
                func.coalesce(subq.c.avg_score, 0) * 0.5
                + func.coalesce(assign_subq.c.avg_assignment, 0) * 0.2
                + func.coalesce(subq.c.courses_done, 0) * 10 * 0.15
                + func.coalesce(subq.c.activity, 0) * 0.15
            ).label("score")
        ).join(subq, User.id == subq.c.user_id).outerjoin(
            assign_subq, User.id == assign_subq.c.user_id
        ).order_by(
            (
                func.coalesce(subq.c.avg_score, 0) * 0.5
                + func.coalesce(assign_subq.c.avg_assignment, 0) * 0.2
                + func.coalesce(subq.c.courses_done, 0) * 10 * 0.15
                + func.coalesce(subq.c.activity, 0) * 0.15
            ).desc()
        ).all()
        
        for idx, r in enumerate(all_ranked):
            if r.id == child.id:
                rank = idx + 1
                break
    
    return {
        "student": {"id": child.id, "full_name": child.full_name, "email": child.email},
        "courses": courses_report,
        "certificates": [
            {"course_id": c.course_id, "course_title": courses.get(c.course_id).title if courses.get(c.course_id) else "", "final_score": float(c.final_score) if c.final_score else None}
            for c in certs
        ],
        "overall_stats": {
            "avg_score": overall_avg_score,
            "total_topics_completed": total_topics_done,
            "courses_enrolled": len(course_ids),
            "certificates_count": len(certs),
            "total_study_hours": total_study_hours,
            "assignment_avg_score": assignment_avg,
            "assignments_count": len(assignment_grades),
            "rank": rank,
            "points": child.points or 0,
        },
    }


@router.get("/children/leaderboard")
def children_leaderboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Рейтинг детей родителя с их позициями в общем рейтинге."""
    if not _is_parent_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Доступ только для родителей")
    
    # Получаем всех детей родителя
    children = db.query(User).filter(User.parent_id == current_user.id, User.role == "student").all()
    if not children:
        return []
    
    child_ids = [c.id for c in children]
    
    # Получаем данные для рейтинга (аналогично analytics.py)
    subq = db.query(
        StudentProgress.user_id,
        func.avg(StudentProgress.test_score).label("avg_score"),
        func.count(distinct(StudentProgress.course_id)).label("courses_done"),
        func.count(StudentProgress.id).label("activity"),
    ).filter(StudentProgress.is_completed == True).group_by(StudentProgress.user_id).subquery()
    
    assign_subq = db.query(
        AssignmentSubmission.student_id.label("user_id"),
        func.avg(AssignmentSubmission.grade).label("avg_assignment"),
    ).filter(AssignmentSubmission.grade.isnot(None)).group_by(AssignmentSubmission.student_id).subquery()
    
    # Получаем полный рейтинг для расчета позиций
    all_users_q = db.query(
        User.id, User.full_name, User.email, User.points,
        subq.c.avg_score, subq.c.courses_done, subq.c.activity,
        assign_subq.c.avg_assignment,
    ).join(subq, User.id == subq.c.user_id).outerjoin(
        assign_subq, User.id == assign_subq.c.user_id
    ).order_by(
        (
            func.coalesce(subq.c.avg_score, 0) * 0.5
            + func.coalesce(assign_subq.c.avg_assignment, 0) * 0.2
            + func.coalesce(subq.c.courses_done, 0) * 10 * 0.15
            + func.coalesce(subq.c.activity, 0) * 0.15
        ).desc()
    )
    
    all_rows = all_users_q.all()
    all_ranked = [
        {"rank": i + 1, "user_id": r.id, "full_name": r.full_name, "email": r.email,
         "avg_score": float(r.avg_score) if r.avg_score else 0,
         "avg_assignment": float(r.avg_assignment) if r.avg_assignment else 0,
         "courses_done": r.courses_done or 0, "activity": r.activity or 0,
         "points": r.points or 0}
        for i, r in enumerate(all_rows)
    ]
    
    # Фильтруем только детей родителя
    children_ranked = [r for r in all_ranked if r["user_id"] in child_ids]
    
    return children_ranked


@router.get("/children/leaderboard/csv")
def children_leaderboard_csv(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Экспорт рейтинга детей родителя в CSV."""
    import csv
    import io
    
    if not _is_parent_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Доступ только для родителей")
    
    # Получаем всех детей родителя
    children = db.query(User).filter(User.parent_id == current_user.id, User.role == "student").all()
    child_ids = [c.id for c in children] if children else []
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rank", "User ID", "Full Name", "Email", "Avg Score", "Courses Done", "Activity", "Points"])
    
    if child_ids:
        # Получаем данные для рейтинга (аналогично analytics.py)
        subq = db.query(
            StudentProgress.user_id,
            func.avg(StudentProgress.test_score).label("avg_score"),
            func.count(distinct(StudentProgress.course_id)).label("courses_done"),
            func.count(StudentProgress.id).label("activity"),
        ).filter(StudentProgress.is_completed == True).group_by(StudentProgress.user_id).subquery()
        
        assign_subq = db.query(
            AssignmentSubmission.student_id.label("user_id"),
            func.avg(AssignmentSubmission.grade).label("avg_assignment"),
        ).filter(AssignmentSubmission.grade.isnot(None)).group_by(AssignmentSubmission.student_id).subquery()
        
        # Получаем полный рейтинг для расчета позиций
        all_users_q = db.query(
            User.id, User.full_name, User.email, User.points,
            subq.c.avg_score, subq.c.courses_done, subq.c.activity,
            assign_subq.c.avg_assignment,
        ).join(subq, User.id == subq.c.user_id).outerjoin(
            assign_subq, User.id == assign_subq.c.user_id
        ).order_by(
            (
                func.coalesce(subq.c.avg_score, 0) * 0.5
                + func.coalesce(assign_subq.c.avg_assignment, 0) * 0.2
                + func.coalesce(subq.c.courses_done, 0) * 10 * 0.15
                + func.coalesce(subq.c.activity, 0) * 0.15
            ).desc()
        )
        
        all_rows = all_users_q.all()
        all_ranked = [
            {"rank": i + 1, "user_id": r.id, "full_name": r.full_name, "email": r.email,
             "avg_score": float(r.avg_score) if r.avg_score else 0,
             "avg_assignment": float(r.avg_assignment) if r.avg_assignment else 0,
             "courses_done": r.courses_done or 0, "activity": r.activity or 0,
             "points": r.points or 0}
            for i, r in enumerate(all_rows)
        ]
        
        # Фильтруем только детей родителя
        children_ranked = [r for r in all_ranked if r["user_id"] in child_ids]
        
        for r in children_ranked:
            writer.writerow([
                r["rank"], r["user_id"], r["full_name"], r["email"],
                r["avg_score"], r["courses_done"], r["activity"], r["points"]
            ])
    
    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()  # UTF-8 BOM для корректного отображения в Excel
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=children-leaderboard.csv"},
    )
