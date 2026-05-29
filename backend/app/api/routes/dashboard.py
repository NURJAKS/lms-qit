from datetime import date, timedelta, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
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
from app.models.coin_transaction_log import CoinTransactionLog

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _deadline_to_iso_utc(deadline: datetime | None) -> str | None:
    if deadline is None:
        return None
    if deadline.tzinfo is None:
        return deadline.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    return deadline.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


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
    """
    Умная логика выбора тем для продолжения обучения:
    Для каждого курса студента находим 'активную' тему:
    1. Показываем самую первую тему по порядку, которая еще не завершена полностью (is_completed = False).
    2. Тема остается активной в дашборде, пока все её этапы (видео, тест и т.д.) не будут пройдены.
    3. Сортируем курсы по дате последнего обновления прогресса или дате записи на курс.
    """
    from app.models.course_module import CourseModule
    
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == current_user.id).all()
    if not enrollments:
        return []
    
    course_ids = [e.course_id for e in enrollments]
    
    # Собираем весь прогресс пользователя
    all_progress = db.query(StudentProgress).filter(StudentProgress.user_id == current_user.id).all()
    progress_by_course = {}
    for p in all_progress:
        progress_by_course.setdefault(p.course_id, {})[p.topic_id] = p
        
    result_candidates = []
    
    for cid in course_ids:
        # Получаем темы курса в правильном порядке (через модули)
        ordered_topics = (
            db.query(CourseTopic)
            .join(CourseModule, CourseModule.id == CourseTopic.module_id)
            .filter(CourseTopic.course_id == cid)
            .order_by(CourseModule.order_number, CourseTopic.order_number)
            .all()
        )
        
        if not ordered_topics:
            continue
            
        active_topic = None
        course_last_update = None
        
        # Находим последнюю дату обновления в этом курсе для сортировки
        for p in all_progress:
            if p.course_id == cid:
                if not course_last_update or (p.updated_at and p.updated_at > course_last_update):
                    course_last_update = p.updated_at
        
        # Если прогресса вообще в курсе нет, используем дату записи на курс
        if not course_last_update:
            enr = next((e for e in enrollments if e.course_id == cid), None)
            if enr:
                course_last_update = enr.enrolled_at
        
        # Ищем 'активную' тему: первая незавершенная (is_completed = False)
        for t in ordered_topics:
            p = progress_by_course.get(cid, {}).get(t.id)
            if not p or not p.is_completed:
                active_topic = t
                break
        
        if active_topic:
            p = progress_by_course.get(cid, {}).get(active_topic.id)
            duration = active_topic.video_duration or 3600
            watched = p.video_watched_seconds if p else 0
            pct = min(100, round(watched / duration * 100)) if duration else 0
            
            c = db.query(Course).filter(Course.id == cid).first()
            
            result_candidates.append({
                "topic_id": active_topic.id,
                "course_id": cid,
                "course_title": c.title if c else "",
                "course_image_url": c.image_url if c and c.image_url else None,
                "topic_title": active_topic.title,
                "video_watched_seconds": watched,
                "video_duration": duration,
                "progress_percent": pct,
                "last_update": course_last_update or datetime.min
            })
            
    # Сортируем по дате последнего обновления (сначала активные)
    result_candidates.sort(key=lambda x: x["last_update"], reverse=True)
    
    # Удаляем служебное поле и ограничиваем
    final_result = []
    for r in result_candidates:
        r.pop("last_update")
        final_result.append(r)
        
    return final_result[:6]
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


def _theory_coins_earned_today(db: Session, user_id: int) -> int:
    """Количество наград за теорию (просмотр 90%+ видео) за сегодня."""
    today = date.today()
    return (
        db.query(CoinTransactionLog)
        .filter(
            CoinTransactionLog.user_id == user_id,
            CoinTransactionLog.reason.like("theory_%"),
            func.date(CoinTransactionLog.created_at) == today,
            CoinTransactionLog.amount > 0,
        )
        .count()
    )


QUEST_DEFS = [
    {"id": "login", "title_key": "dailyQuestLogin", "target": 1, "points": 5},
    {"id": "quiz", "title_key": "dailyQuestQuiz", "target": 1, "points": 15},
    {"id": "watch", "title_key": "dailyQuestWatch", "target": 1, "points": 10},
    {"id": "topics2", "title_key": "dailyQuestTopics2", "target": 2, "points": 25},
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
    theory_today = _theory_coins_earned_today(db, current_user.id)

    result = []
    for q in QUEST_DEFS:
        qid = q["id"]
        target = q["target"]
        if qid == "login":
            progress = min(login_streak >= 1, 1) if login_streak >= 1 else 0
            completed = login_streak >= 1
        elif qid == "quiz":
            progress = min(tests_today, target)
            completed = tests_today >= target
        elif qid == "watch":
            progress = 1 if (theory_today >= 1 or topics_today >= 1) else 0
            completed = (theory_today >= 1 or topics_today >= 1)
        elif qid == "topics2":
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
    theory_today = _theory_coins_earned_today(db, current_user.id)

    completed = False
    if quest_id == "login":
        completed = login_streak >= 1
    elif quest_id == "quiz":
        completed = tests_today >= qdef["target"]
    elif quest_id == "watch":
        completed = (theory_today >= 1 or topics_today >= 1)
    elif quest_id == "topics2":
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
    
    # Преобразуем в datetime для сравнения с полями базы (наивные в SQLite)
    period_start_dt = datetime.combine(period_start, datetime.min.time())
    period_end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    previous_period_start_dt = datetime.combine(previous_period_start, datetime.min.time())
    
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
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    
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
    
    # Получаем ID заданий, которые студент уже сдал
    submitted_assignment_ids = db.query(AssignmentSubmission.assignment_id).filter(
        AssignmentSubmission.student_id == current_user.id
    ).all()
    submitted_ids = [r[0] for r in submitted_assignment_ids]

    # Получаем задания с дедлайнами, которые еще не прошли, не закрыты вручную и еще не сданы
    now = datetime.now() # Naive comparison for SQLite
    assignments = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.group_id.in_(group_ids),
            TeacherAssignment.deadline.isnot(None),
            TeacherAssignment.deadline >= now,
            TeacherAssignment.closed_at.is_(None),
            ~TeacherAssignment.id.in_(submitted_ids),
        )
        .order_by(TeacherAssignment.deadline.asc())
        .limit(limit)
        .all()
    )
    
    # Получаем курсы
    course_ids = list({a.course_id for a in assignments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    
    # submissions нам больше не нужны для фильтрации внутри цикла, 
    # так как мы отфильтровали их в основном запросе.
    # Но мы оставляем поле submitted для совместимости с фронтендом (всегда False).
    
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
        
        # В этом списке будут только не сданные задания
        submitted = False
        
        course = courses.get(a.course_id)
        result.append({
            "id": a.id,
            "title": a.title,
            "type": deadline_type,
            "dueDate": _deadline_to_iso_utc(a.deadline),
            "courseId": a.course_id,
            "courseTitle": course.title if course else "",
            "priority": priority,
            "submitted": submitted,
        })
    
    return result


def _course_progress_bar_type(category_name: str | None) -> str:
    if not category_name:
        return "other"
    n = category_name.lower()
    if any(x in n for x in ("програм", "python", "java", "web", "it", "код", "code", "develop", "әзірлеу")):
        return "programming"
    if any(x in n for x in ("дизайн", "design", "ui", "ux")):
        return "design"
    if any(x in n for x in ("маркет", "marketing", "smm")):
        return "marketing"
    return "other"


@router.get("/course-progress-bars")
def get_course_progress_bars(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Прогресс по записанным курсам для диаграммы (реальные данные из student_progress)."""
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == current_user.id).all()
    if not enrollments:
        return {"courses": [], "average_progress": 0.0, "improvement_percent": 0.0}

    course_ids = list({e.course_id for e in enrollments})
    courses = (
        db.query(Course)
        .options(joinedload(Course.category))
        .filter(Course.id.in_(course_ids))
        .all()
    )
    courses_by_id = {c.id: c for c in courses}

    out_rows: list[dict] = []
    for cid in course_ids:
        c = courses_by_id.get(cid)
        if not c:
            continue
        topics = db.query(CourseTopic).filter(CourseTopic.course_id == cid).all()
        total = len(topics)
        if total == 0:
            continue
        done_q = (
            db.query(StudentProgress)
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == cid,
                StudentProgress.is_completed == True,  # noqa: E712
            )
            .all()
        )
        done_topic_ids = {p.topic_id for p in done_q if p.topic_id}
        pct = round(min(100, (len(done_topic_ids) / total) * 100))
        cat_name = c.category.name if c.category else None
        ctype = _course_progress_bar_type(cat_name)
        out_rows.append({"name": c.title, "progress": pct, "type": ctype})

    if not out_rows:
        return {"courses": [], "average_progress": 0.0, "improvement_percent": 0.0}

    out_rows.sort(key=lambda x: x["progress"], reverse=True)
    top = out_rows[:5]
    avg = round(sum(x["progress"] for x in out_rows) / len(out_rows), 1)

    today = date.today()
    start_curr = today - timedelta(days=30)
    start_prev = today - timedelta(days=60)
    start_curr_dt = datetime.combine(start_curr, datetime.min.time())
    end_curr_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())
    start_prev_dt = datetime.combine(start_prev, datetime.min.time())

    prev_completed = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,  # noqa: E712
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= start_prev_dt,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < start_curr_dt,
        )
        .count()
    )
    curr_completed = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,  # noqa: E712
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= start_curr_dt,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) < end_curr_dt,
        )
        .count()
    )
    if prev_completed <= 0:
        improvement = 100.0 if curr_completed > 0 else 0.0
    else:
        improvement = round((curr_completed - prev_completed) / prev_completed * 100, 1)

    return {"courses": top, "average_progress": avg, "improvement_percent": improvement}


@router.get("/study-time-summary")
def get_study_time_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Суммарное время просмотра видео (video_watched_seconds) по темам; окна — по дате обновления строки."""
    rows = db.query(StudentProgress).filter(StudentProgress.user_id == current_user.id).all()
    total_min = sum((r.video_watched_seconds or 0) for r in rows) // 60

    today_d = date.today()
    week_ago = today_d - timedelta(days=7)
    month_ago = today_d - timedelta(days=30)
    prev_week_start = today_d - timedelta(days=14)
    prev_week_end = today_d - timedelta(days=8)

    def sum_minutes_window(start_d: date, end_d: date) -> int:
        s = 0
        for r in rows:
            u = r.updated_at or r.created_at
            if not u:
                continue
            ud = u.date() if isinstance(u, datetime) else u
            if start_d <= ud <= end_d:
                s += r.video_watched_seconds or 0
        return s // 60

    today_min = sum_minutes_window(today_d, today_d)
    week_min = sum_minutes_window(week_ago, today_d)
    month_min = sum_minutes_window(month_ago, today_d)
    curr_week_min = sum_minutes_window(week_ago, today_d)
    prev_week_min = sum_minutes_window(prev_week_start, prev_week_end)

    if prev_week_min <= 0:
        change = 0.0 if curr_week_min <= 0 else 100.0
    else:
        change = round((curr_week_min - prev_week_min) / prev_week_min * 100, 1)

    return {
        "total_minutes": total_min,
        "today_minutes": today_min,
        "week_minutes": week_min,
        "month_minutes": month_min,
        "change_percent": change,
        "is_positive": change >= 0,
    }


@router.get("/today-progress")
def get_today_progress_metric(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    metric: str = Query("lessons", description="lessons | assignments | tests"),
):
    """Счётчики активности за сегодня (темы, проверенные задания, тесты)."""
    today = date.today()
    yesterday = today - timedelta(days=1)
    if metric == "assignments":
        val = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.student_id == current_user.id,
                AssignmentSubmission.grade != None,  # noqa: E711
                func.date(func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at)) == today,
            )
            .count()
        )
        prev = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.student_id == current_user.id,
                AssignmentSubmission.grade != None,  # noqa: E711
                func.date(func.coalesce(AssignmentSubmission.graded_at, AssignmentSubmission.submitted_at)) == yesterday,
            )
            .count()
        )
    elif metric == "tests":
        val = _tests_passed_today(db, current_user.id)
        prev = (
            db.query(StudentProgress)
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.is_completed == True,  # noqa: E712
                StudentProgress.test_score != None,  # noqa: E711
                func.date(func.coalesce(StudentProgress.completed_at, StudentProgress.created_at)) == yesterday,
            )
            .count()
        )
    else:
        val = _topics_completed_today(db, current_user.id)
        prev = (
            db.query(StudentProgress)
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.is_completed == True,  # noqa: E712
                func.date(func.coalesce(StudentProgress.completed_at, StudentProgress.created_at)) == yesterday,
            )
            .count()
        )

    if prev <= 0:
        change = 100.0 if val > 0 else 0.0
    else:
        change = round((val - prev) / prev * 100, 1)
    return {"value": val, "change": change, "is_positive": val >= prev}
