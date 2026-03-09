"""Dashboard API: stats, continue-watching, daily quests."""
from datetime import date, timedelta, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.course import Course
from app.models.course_topic import CourseTopic
from app.models.enrollment import CourseEnrollment
from app.models.progress import StudentProgress
from app.models.study_schedule import StudySchedule
from app.models.certificate import Certificate
from app.models.activity_log import UserActivityLog
from app.models.assignment_submission import AssignmentSubmission
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.services.coins import add_coins, has_received_coins_for_reason

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Статистика для дашборда: курсов завершено, очки, общий прогресс %."""
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == current_user.id).all()
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return {
            "courses_completed": 0,
            "points": current_user.points or 0,
            "progress_percent": 0,
            "total_courses": 0,
        }
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    topics_by_course = {}
    for c in courses:
        topics = db.query(CourseTopic).filter(CourseTopic.course_id == c.id).all()
        topics_by_course[c.id] = len(topics)
    certs = db.query(Certificate).filter(
        Certificate.user_id == current_user.id,
        Certificate.course_id.in_(course_ids),
    ).all()
    courses_completed = len(certs)
    total_topics = sum(topics_by_course.values())
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.course_id.in_(course_ids),
        StudentProgress.is_completed == True,
    ).all()
    completed_topics = len({p.topic_id for p in progress_rows if p.topic_id})
    progress_percent = round((completed_topics / total_topics * 100) if total_topics else 0, 1)
    return {
        "courses_completed": courses_completed,
        "points": current_user.points or 0,
        "progress_percent": progress_percent,
        "total_courses": len(course_ids),
    }


@router.get("/continue-watching")
def get_continue_watching(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Темы с просмотром видео (video_watched_seconds > 0), не завершённые."""
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.video_watched_seconds > 0,
        StudentProgress.is_completed == False,
    ).order_by(StudentProgress.created_at.desc()).limit(6).all()
    topic_ids = [p.topic_id for p in progress_rows if p.topic_id]
    if not topic_ids:
        return []
    topics = db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all()
    topics_by_id = {t.id: t for t in topics}
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_({t.course_id for t in topics})).all()}
    result = []
    for p in progress_rows:
        if p.topic_id not in topics_by_id:
            continue
        t = topics_by_id[p.topic_id]
        duration = t.video_duration or 3600
        watched = p.video_watched_seconds or 0
        pct = min(100, round(watched / duration * 100)) if duration else 0
        c = courses.get(t.course_id)
        result.append({
            "topic_id": t.id,
            "course_id": t.course_id,
            "course_title": c.title if c else "",
            "course_image_url": c.image_url if c and c.image_url else None,
            "topic_title": t.title,
            "video_watched_seconds": watched,
            "video_duration": duration,
            "progress_percent": pct,
        })
    return result


@router.get("/events")
def get_upcoming_events(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = 7,
):
    """Ближайшие события из расписания."""
    today = date.today()
    end = today + timedelta(days=days)
    rows = db.query(StudySchedule).filter(
        StudySchedule.user_id == current_user.id,
        StudySchedule.scheduled_date >= today,
        StudySchedule.scheduled_date <= end,
    ).order_by(StudySchedule.scheduled_date).limit(10).all()
    course_ids = [r.course_id for r in rows if r.course_id]
    topic_ids = [r.topic_id for r in rows if r.topic_id]
    courses = {c.id: c.title for c in db.query(Course).filter(Course.id.in_(course_ids)).all()} if course_ids else {}
    topics = {t.id: t.title for t in db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all()} if topic_ids else {}
    return [
        {
            "id": r.id,
            "scheduled_date": str(r.scheduled_date),
            "notes": r.notes,
            "course_title": courses.get(r.course_id) if r.course_id else None,
            "topic_title": topics.get(r.topic_id) if r.topic_id else None,
            "is_completed": r.is_completed,
        }
        for r in rows
    ]


def _login_streak_days(db: Session, user_id: int) -> int:
    """Количество дней подряд с логином (макс 7)."""
    today = date.today()
    today_str = today.isoformat()
    rows = (
        db.query(func.date(UserActivityLog.created_at).label("d"))
        .filter(UserActivityLog.user_id == user_id, UserActivityLog.action == "login")
        .distinct()
        .order_by(func.date(UserActivityLog.created_at).desc())
        .limit(10)
        .all()
    )
    dates = [r[0] if isinstance(r[0], str) else (r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0])) for r in rows if r[0]]
    if not dates or dates[0] != today_str:
        return 0
    streak = 0
    for i, d in enumerate(dates):
        expected = (today - timedelta(days=i)).isoformat()
        if d != expected:
            break
        streak += 1
    return streak


def _topics_completed_today(db: Session, user_id: int) -> int:
    """Темы завершённые сегодня."""
    today = date.today()
    return (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            func.date(func.coalesce(StudentProgress.completed_at, StudentProgress.created_at)) == today,
        )
        .count()
    )


def _tests_passed_today(db: Session, user_id: int) -> int:
    """Темы/тесты сданные сегодня (is_completed + test_score)."""
    today = date.today()
    return (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score != None,
            func.date(func.coalesce(StudentProgress.completed_at, StudentProgress.created_at)) == today,
        )
        .count()
    )


QUEST_DEFS = [
    {"id": "login", "title_key": "dailyQuestLogin", "target": 5, "points": 5},
    {"id": "quiz", "title_key": "dailyQuestQuiz", "target": 3, "points": 15},
    {"id": "watch", "title_key": "dailyQuestWatch", "target": 1, "points": 10},
    {"id": "topics5", "title_key": "dailyQuestTopics5", "target": 5, "points": 25},
    {"id": "final_test", "title_key": "dailyQuestFinalTest", "target": 1, "points": 50},
]


@router.get("/daily-quests")
def get_daily_quests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Ежедневные задания с прогрессом и статусом claimed."""
    today_str = date.today().isoformat()
    login_streak = _login_streak_days(db, current_user.id)
    topics_today = _topics_completed_today(db, current_user.id)
    tests_today = _tests_passed_today(db, current_user.id)

    result = []
    for q in QUEST_DEFS:
        qid = q["id"]
        target = q["target"]
        if qid == "login":
            progress = min(login_streak, target)
            completed = login_streak >= target
        elif qid == "quiz":
            progress = min(tests_today, target)
            completed = tests_today >= target
        elif qid == "watch":
            progress = 1 if topics_today >= 1 else 0
            completed = topics_today >= 1
        elif qid == "topics5":
            progress = min(topics_today, target)
            completed = topics_today >= target
        elif qid == "final_test":
            today = date.today()
            certs_today = (
                db.query(Certificate)
                .filter(
                    Certificate.user_id == current_user.id,
                    func.date(Certificate.issued_at) == today,
                )
                .count()
            )
            progress = min(1, certs_today)
            completed = certs_today >= 1
        else:
            progress = 0
            completed = False

        reason = f"daily_quest_{qid}_{today_str}"
        claimed = has_received_coins_for_reason(db, current_user.id, reason)

        result.append({
            "id": qid,
            "title_key": q["title_key"],
            "title": q.get("title", ""),
            "progress": progress,
            "target": target,
            "points": q["points"],
            "completed": completed,
            "claimed": claimed,
        })
    return result


@router.post("/daily-quests/{quest_id}/claim")
def claim_daily_quest(
    quest_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Получить награду за выполненное задание (раз в день)."""
    qdef = next((q for q in QUEST_DEFS if q["id"] == quest_id), None)
    if not qdef:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    today_str = date.today().isoformat()
    reason = f"daily_quest_{quest_id}_{today_str}"
    if has_received_coins_for_reason(db, current_user.id, reason):
        raise HTTPException(status_code=400, detail="Награда уже получена сегодня")

    login_streak = _login_streak_days(db, current_user.id)
    topics_today = _topics_completed_today(db, current_user.id)
    tests_today = _tests_passed_today(db, current_user.id)

    completed = False
    if quest_id == "login":
        completed = login_streak >= qdef["target"]
    elif quest_id == "quiz":
        completed = tests_today >= qdef["target"]
    elif quest_id == "watch":
        completed = topics_today >= 1
    elif quest_id == "topics5":
        completed = topics_today >= qdef["target"]
    elif quest_id == "final_test":
        today = date.today()
        certs_today = (
            db.query(Certificate)
            .filter(
                Certificate.user_id == current_user.id,
                func.date(Certificate.issued_at) == today,
            )
            .count()
        )
        completed = certs_today >= 1

    if not completed:
        raise HTTPException(status_code=400, detail="Задание ещё не выполнено")

    add_coins(db, current_user.id, qdef["points"], reason)
    db.commit()
    return {"claimed": True, "points": qdef["points"]}


@router.get("/learning-activity-sources")
def get_learning_activity_sources(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    period: str = "30_days",  # "30_days" or "7_days"
):
    """Статистика активности обучения по категориям: уроки, задания, тесты, сертификаты."""
    
    # Определяем период
    if period == "7_days":
        days = 7
    else:
        days = 30
    
    today = date.today()
    period_start = today - timedelta(days=days)
    previous_period_start = period_start - timedelta(days=days)
    
    # Преобразуем в datetime для сравнения с timezone-aware полями
    period_start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    period_end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    previous_period_start_dt = datetime.combine(previous_period_start, datetime.min.time(), tzinfo=timezone.utc)
    
    user_id = current_user.id
    
    # Lessons (завершенные темы) - за период
    lessons_current = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= period_start_dt,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < period_end_dt,
        )
        .count()
    )
    
    lessons_previous = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= previous_period_start_dt,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < period_start_dt,
        )
        .count()
    )
    
    # Assignments (проверенные задания) - за период
    assignments_current = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.student_id == user_id,
            AssignmentSubmission.grade != None,
            func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at) >= period_start_dt,
            func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at) < period_end_dt,
        )
        .count()
    )
    
    assignments_previous = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.student_id == user_id,
            AssignmentSubmission.grade != None,
            func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at) >= previous_period_start_dt,
            func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at) < period_start_dt,
        )
        .count()
    )
    
    # Tests (пройденные тесты с оценкой) - за период
    tests_current = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score != None,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= period_start_dt,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < period_end_dt,
        )
        .count()
    )
    
    tests_previous = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score != None,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= previous_period_start_dt,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < period_start_dt,
        )
        .count()
    )
    
    # Certificates (полученные сертификаты) - за период
    certificates_current = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user_id,
            Certificate.issued_at >= period_start_dt,
            Certificate.issued_at < period_end_dt,
        )
        .count()
    )
    
    certificates_previous = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user_id,
            Certificate.issued_at >= previous_period_start_dt,
            Certificate.issued_at < period_start_dt,
        )
        .count()
    )
    
    # Функция для определения изменения
    def get_change(current: int, previous: int) -> str:
        if previous == 0:
            return "up" if current > 0 else "down"
        return "up" if current >= previous else "down"
    
    # Функция для расчета процента изменения
    def get_change_percent(current: int, previous: int) -> float:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)
    
    categories = [
        {
            "name": "lessons",
            "label": "Уроки",
            "value": lessons_current,
            "change": get_change(lessons_current, lessons_previous),
        },
        {
            "name": "assignments",
            "label": "Задания",
            "value": assignments_current,
            "change": get_change(assignments_current, assignments_previous),
        },
        {
            "name": "tests",
            "label": "Тесты",
            "value": tests_current,
            "change": get_change(tests_current, tests_previous),
        },
        {
            "name": "certificates",
            "label": "Сертификаты",
            "value": certificates_current,
            "change": get_change(certificates_current, certificates_previous),
        },
    ]
    
    total = sum(c["value"] for c in categories)
    total_previous = lessons_previous + assignments_previous + tests_previous + certificates_previous
    change_percent = get_change_percent(total, total_previous)
    
    # Если данных нет, возвращаем структуру с нулями (не mock данные)
    # Это реальные данные из базы - просто их нет за выбранный период
    return {
        "period": period,
        "total": total,
        "change_percent": change_percent,
        "categories": categories,
    }


@router.get("/weekly-activity")
def get_weekly_activity(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    period: str = "weekly",  # "weekly" or "monthly"
):
    """Недельная активность по категориям: курсы, задания, тесты."""
    
    # Определяем период
    if period == "monthly":
        days = 30
    else:
        days = 7
    
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    
    user_id = current_user.id
    
    # Получаем активность по дням
    day_activity: dict[date, dict[str, int]] = {}
    for i in range(days):
        d = start_date + timedelta(days=i)
        day_activity[d] = {"courses": 0, "assignments": 0, "tests": 0}
    
    # Курсы (завершенные темы)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.is_completed == True,
        func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= start_dt,
        func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < end_dt,
    ).all()
    
    for p in progress_rows:
        dt = p.completed_at or p.created_at
        if dt:
            d = dt.date()
            if d in day_activity:
                day_activity[d]["courses"] += 1
    
    # Задания (проверенные)
    assignment_rows = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.student_id == user_id,
        AssignmentSubmission.grade != None,
        func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at) >= start_dt,
        func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at) < end_dt,
    ).all()
    
    for a in assignment_rows:
        dt = a.graded_at or a.submitted_at
        if dt:
            d = dt.date()
            if d in day_activity:
                day_activity[d]["assignments"] += 1
    
    # Тесты (пройденные с оценкой)
    test_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.is_completed == True,
        StudentProgress.test_score != None,
        func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= start_dt,
        func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < end_dt,
    ).all()
    
    for t in test_rows:
        dt = t.completed_at or t.created_at
        if dt:
            d = dt.date()
            if d in day_activity:
                day_activity[d]["tests"] += 1
    
    # Формируем результат в формате для виджета
    categories = ["courses", "assignments", "tests"]
    result = []
    
    for cat in categories:
        days_list = []
        for i in range(days):
            d = start_date + timedelta(days=i)
            count = day_activity[d][cat]
            if count > 2:
                level = "high"
            elif count > 0:
                level = "medium"
            else:
                level = "none"
            days_list.append(level)
        
        result.append({
            "category": cat,
            "days": days_list,
        })
    
    return result


@router.get("/achievements")
def get_recent_achievements(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 10,
):
    """Недавние достижения пользователя."""
    
    user_id = current_user.id
    achievements = []
    
    # 1. Первая победа - первый завершенный курс
    first_cert = (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id)
        .order_by(Certificate.issued_at.asc())
        .first()
    )
    if first_cert:
        achievements.append({
            "id": 1,
            "title_key": "achievementFirstWin",
            "description_key": "achievementFirstWinDesc",
            "icon": "trophy",
            "date": first_cert.issued_at.isoformat() if first_cert.issued_at else first_cert.created_at.isoformat(),
            "color": "#FFD700",
        })
    
    # 2. Неделя активности - 7 дней подряд активности
    active_dates = _get_active_dates(db, user_id, days=30)
    today = date.today()
    streak = 0
    d = today
    while d in active_dates:
        streak += 1
        d -= timedelta(days=1)
    
    if streak >= 7:
        # Находим дату начала недели активности
        week_start = today - timedelta(days=6)
        achievements.append({
            "id": 2,
            "title_key": "achievementActivityWeek",
            "description_key": "achievementActivityWeekDesc",
            "icon": "award",
            "date": datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc).isoformat(),
            "color": "#8B5CF6",
        })
    
    # 3. Отличник - 100% на тесте
    perfect_test = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == user_id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score == 100,
        )
        .order_by(func.coalesce(StudentProgress.completed_at, StudentProgress.created_at).desc())
        .first()
    )
    if perfect_test:
        dt = perfect_test.completed_at or perfect_test.created_at
        achievements.append({
            "id": 3,
            "title_key": "achievementExcellent",
            "description_key": "achievementExcellentDesc",
            "icon": "star",
            "date": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
            "color": "#FF4181",
        })
    
    # 4. Мастер практики - выполнено 50 заданий
    assignments_count = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.student_id == user_id,
            AssignmentSubmission.grade != None,
        )
        .count()
    )
    if assignments_count >= 50:
        last_assignment = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.student_id == user_id,
                AssignmentSubmission.grade != None,
            )
            .order_by(func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at).desc())
            .first()
        )
        if last_assignment:
            dt = last_assignment.graded_at or last_assignment.submitted_at
            achievements.append({
                "id": 4,
                "title_key": "achievementPracticeMaster",
                "description_key": "achievementPracticeMasterDesc",
                "icon": "medal",
                "date": dt.isoformat() if dt else datetime.now(timezone.utc).isoformat(),
                "color": "#3B82F6",
            })
    
    # Сортируем по дате (новые первыми) и ограничиваем
    achievements.sort(key=lambda x: x["date"], reverse=True)
    return achievements[:limit]


def _get_active_dates(db: Session, user_id: int, days: int = 365) -> set[date]:
    """Получить множество дат с активностью за последние N дней."""
    today = date.today()
    start = today - timedelta(days=days)
    
    active_dates = set()
    
    # Активность из прогресса
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.is_completed == True,
    ).all()
    
    for p in progress_rows:
        dt = p.completed_at or p.created_at
        if dt:
            d = dt.date()
            if d >= start:
                active_dates.add(d)
    
    # Активность из логов
    logs = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == user_id,
        UserActivityLog.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
    ).all()
    
    for log in logs:
        if log.created_at:
            d = log.created_at.date()
            if d >= start:
                active_dates.add(d)
    
    return active_dates


@router.get("/deadlines")
def get_upcoming_deadlines(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 10,
):
    """Предстоящие дедлайны из заданий студента."""
    
    # Получаем группы студента
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()]
    if not group_ids:
        return []
    
    # Получаем задания с дедлайнами, которые еще не прошли
    now = datetime.now(timezone.utc)
    assignments = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.group_id.in_(group_ids),
            TeacherAssignment.deadline.isnot(None),
            TeacherAssignment.deadline >= now,
        )
        .order_by(TeacherAssignment.deadline.asc())
        .limit(limit)
        .all()
    )
    
    # Получаем курсы
    course_ids = list({a.course_id for a in assignments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    
    # Получаем информацию о сдаче заданий
    assignment_ids = [a.id for a in assignments]
    submissions = {
        s.assignment_id: s
        for s in db.query(AssignmentSubmission).filter(
            AssignmentSubmission.student_id == current_user.id,
            AssignmentSubmission.assignment_id.in_(assignment_ids),
        ).all()
    }
    
    result = []
    for a in assignments:
        # Определяем приоритет на основе времени до дедлайна
        days_until_deadline = (a.deadline - now).days
        if days_until_deadline <= 1:
            priority = "high"
        elif days_until_deadline <= 3:
            priority = "high"
        elif days_until_deadline <= 7:
            priority = "medium"
        else:
            priority = "low"
        
        # Определяем тип: если есть test_id, то это тест, иначе задание
        deadline_type = "test" if a.test_id else "assignment"
        
        # Проверяем, сдано ли задание
        submitted = a.id in submissions
        
        course = courses.get(a.course_id)
        result.append({
            "id": a.id,
            "title": a.title,
            "type": deadline_type,
            "dueDate": a.deadline.isoformat(),
            "courseTitle": course.title if course else "",
            "priority": priority,
            "submitted": submitted,
        })
    
    return result
