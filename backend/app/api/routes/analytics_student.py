"""
Student Insights — аналитика для студента.
5 эндпоинтов: слабые темы, сравнение, навыки, прогноз, план обучения.
Все данные — из реальной БД, без mock'ов.
"""

from datetime import datetime, timedelta, timezone, date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.progress import StudentProgress
from app.models.enrollment import CourseEnrollment
from app.models.course import Course
from app.models.course_topic import CourseTopic
from app.models.course_module import CourseModule

router = APIRouter(prefix="/analytics/student-insights", tags=["student-insights"])

# ---------------------------------------------------------------------------
# Маппинг курсов на RPG-навыки
# ---------------------------------------------------------------------------
SKILL_MAP = {
    "python": {"name_ru": "Логика", "name_kk": "Логика", "name_en": "Logic", "icon": "brain", "color": "#3B82F6"},
    "web": {"name_ru": "Креативность", "name_kk": "Шығармашылық", "name_en": "Creativity", "icon": "palette", "color": "#8B5CF6"},
    "html": {"name_ru": "Креативность", "name_kk": "Шығармашылық", "name_en": "Creativity", "icon": "palette", "color": "#8B5CF6"},
    "css": {"name_ru": "Дизайн", "name_kk": "Дизайн", "name_en": "Design", "icon": "paintbrush", "color": "#EC4899"},
    "javascript": {"name_ru": "Инженерия", "name_kk": "Инженерия", "name_en": "Engineering", "icon": "wrench", "color": "#F59E0B"},
    "react": {"name_ru": "Архитектура", "name_kk": "Архитектура", "name_en": "Architecture", "icon": "building", "color": "#06B6D4"},
    "data": {"name_ru": "Аналитика", "name_kk": "Аналитика", "name_en": "Analytics", "icon": "bar-chart", "color": "#10B981"},
    "mobile": {"name_ru": "Мобильность", "name_kk": "Мобильділік", "name_en": "Mobility", "icon": "smartphone", "color": "#6366F1"},
    "security": {"name_ru": "Защита", "name_kk": "Қорғаныс", "name_en": "Defense", "icon": "shield", "color": "#EF4444"},
    "default": {"name_ru": "Знание", "name_kk": "Білім", "name_en": "Knowledge", "icon": "book", "color": "#14B8A6"},
}


def _match_skill(course_title: str) -> dict:
    """Определяет навык RPG на основе заголовка курса."""
    title_lower = (course_title or "").lower()
    for keyword, skill in SKILL_MAP.items():
        if keyword == "default":
            continue
        if keyword in title_lower:
            return skill
    return SKILL_MAP["default"]


# ---------------------------------------------------------------------------
# 1. Анализ слабых тем
# ---------------------------------------------------------------------------
@router.get("/weak-topics")
def get_weak_topics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Темы, где test_score < 60%. Только реальные данные из student_progress."""

    rows = (
        db.query(StudentProgress, CourseTopic, Course)
        .join(CourseTopic, StudentProgress.topic_id == CourseTopic.id)
        .join(Course, StudentProgress.course_id == Course.id)
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score.isnot(None),
            StudentProgress.test_score < 60,
        )
        .order_by(StudentProgress.test_score.asc())
        .all()
    )

    return [
        {
            "topic_id": sp.topic_id,
            "topic_title": topic.title,
            "course_id": sp.course_id,
            "course_title": course.title,
            "test_score": float(sp.test_score) if sp.test_score else 0,
            "attempts_count": sp.attempts_count or 1,
        }
        for sp, topic, course in rows
    ]


# ---------------------------------------------------------------------------
# 2. Сравнение с другими студентами
# ---------------------------------------------------------------------------
@router.get("/comparison")
def get_comparison(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Percentile, распределение баллов, мой средний vs общий."""

    # Средний балл текущего студента
    my_avg_row = (
        db.query(func.avg(StudentProgress.test_score))
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score.isnot(None),
        )
        .scalar()
    )
    my_avg = round(float(my_avg_row), 1) if my_avg_row else 0

    # Средний балл ВСЕХ студентов (по каждому студенту — свой avg)
    student_avgs_sq = (
        db.query(
            StudentProgress.user_id,
            func.avg(StudentProgress.test_score).label("avg_score"),
        )
        .join(User, StudentProgress.user_id == User.id)
        .filter(
            User.role == "student",
            StudentProgress.is_completed == True,
            StudentProgress.test_score.isnot(None),
        )
        .group_by(StudentProgress.user_id)
        .subquery()
    )

    all_avgs = db.query(student_avgs_sq.c.avg_score).all()
    all_scores = [float(r[0]) for r in all_avgs if r[0] is not None]
    total_students = len(all_scores)

    global_avg = round(sum(all_scores) / total_students, 1) if total_students else 0

    # Percentile — % студентов с баллом ниже моего
    if total_students > 0 and my_avg > 0:
        lower_count = len([s for s in all_scores if s < my_avg])
        percentile = round((lower_count / total_students) * 100)
    else:
        percentile = 0

    # Распределение по диапазонам (для графика)
    ranges = [
        {"label": "0–20", "min": 0, "max": 20},
        {"label": "20–40", "min": 20, "max": 40},
        {"label": "40–60", "min": 40, "max": 60},
        {"label": "60–80", "min": 60, "max": 80},
        {"label": "80–100", "min": 80, "max": 101},
    ]
    distribution = []
    for r in ranges:
        count = len([s for s in all_scores if r["min"] <= s < r["max"]])
        is_my = r["min"] <= my_avg < r["max"] if my_avg > 0 else False
        distribution.append({
            "range": r["label"],
            "count": count,
            "is_my_range": is_my,
        })

    # Мой балл по курсам
    my_courses = (
        db.query(
            Course.title,
            func.avg(StudentProgress.test_score).label("avg_score"),
            func.count(StudentProgress.id).label("topics_done"),
        )
        .join(Course, StudentProgress.course_id == Course.id)
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score.isnot(None),
        )
        .group_by(Course.title)
        .all()
    )

    courses_comparison = [
        {
            "course_title": c.title,
            "my_avg": round(float(c.avg_score), 1) if c.avg_score else 0,
            "topics_done": c.topics_done,
        }
        for c in my_courses
    ]

    return {
        "my_avg": my_avg,
        "global_avg": global_avg,
        "percentile": percentile,
        "total_students": total_students,
        "distribution": distribution,
        "courses": courses_comparison,
    }


# ---------------------------------------------------------------------------
# 3. Прокачка навыков (RPG Skill Tree)
# ---------------------------------------------------------------------------
@router.get("/skill-tree")
def get_skill_tree(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """RPG-маппинг: курсы → навыки с уровнями."""

    enrollments = (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.user_id == current_user.id)
        .all()
    )
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return {"hero_level": 1, "total_xp": 0, "skills": []}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()

    skills = []
    total_xp = 0

    for course in courses:
        # Общее число тем в курсе
        total_topics = (
            db.query(func.count(CourseTopic.id))
            .filter(CourseTopic.course_id == course.id)
            .scalar()
        ) or 0

        if total_topics == 0:
            continue

        # Завершённые темы
        completed = (
            db.query(func.count(StudentProgress.id))
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == course.id,
                StudentProgress.is_completed == True,
            )
            .scalar()
        ) or 0

        # Средний балл по курсу
        avg_score_row = (
            db.query(func.avg(StudentProgress.test_score))
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == course.id,
                StudentProgress.is_completed == True,
                StudentProgress.test_score.isnot(None),
            )
            .scalar()
        )
        avg_score = float(avg_score_row) if avg_score_row else 0

        progress_pct = round((completed / total_topics) * 100) if total_topics else 0
        # Уровень навыка: 1-100, зависит от прогресса и среднего балла
        # level = progress * 0.6 + avg_score * 0.4  (взвешенный)
        level = round(progress_pct * 0.6 + avg_score * 0.4)
        xp = completed * 100 + round(avg_score * completed)

        total_xp += xp

        skill_meta = _match_skill(course.title)
        skills.append({
            "course_id": course.id,
            "course_title": course.title,
            "skill_name": skill_meta["name_ru"],
            "skill_name_kk": skill_meta["name_kk"],
            "skill_name_en": skill_meta["name_en"],
            "icon": skill_meta["icon"],
            "color": skill_meta["color"],
            "level": min(level, 100),
            "max_level": 100,
            "xp": xp,
            "progress_pct": progress_pct,
            "avg_score": round(avg_score, 1),
            "completed_topics": completed,
            "total_topics": total_topics,
        })

    # Уровень героя: средний уровень навыков
    hero_level = round(sum(s["level"] for s in skills) / len(skills)) if skills else 1

    return {
        "hero_level": max(1, hero_level),
        "total_xp": total_xp,
        "skills": sorted(skills, key=lambda s: s["level"], reverse=True),
    }


# ---------------------------------------------------------------------------
# 4. Прогноз успеха
# ---------------------------------------------------------------------------
@router.get("/success-forecast")
def get_success_forecast(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Прогноз завершения каждого курса на основе текущего темпа."""

    enrollments = (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.user_id == current_user.id)
        .all()
    )
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return {"courses": [], "overall_status": "no_data"}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    now = datetime.now(timezone.utc)
    two_weeks_ago = now - timedelta(days=14)

    results = []

    for course in courses:
        total_topics = (
            db.query(func.count(CourseTopic.id))
            .filter(CourseTopic.course_id == course.id)
            .scalar()
        ) or 0

        if total_topics == 0:
            continue

        completed_topics = (
            db.query(func.count(StudentProgress.id))
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == course.id,
                StudentProgress.is_completed == True,
            )
            .scalar()
        ) or 0

        remaining = total_topics - completed_topics

        # Темп за последние 14 дней
        recent_completed = (
            db.query(func.count(StudentProgress.id))
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == course.id,
                StudentProgress.is_completed == True,
                func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= two_weeks_ago,
            )
            .scalar()
        ) or 0

        pace_per_week = round(recent_completed / 2, 1)  # 14 дней = 2 недели

        # Прогноз дней
        if remaining == 0:
            estimated_days = 0
            status = "completed"
        elif pace_per_week > 0:
            estimated_days = round(remaining / (pace_per_week / 7))
            if estimated_days <= 30:
                status = "excellent"
            elif estimated_days <= 90:
                status = "good"
            else:
                status = "slow"
        else:
            estimated_days = -1  # невозможно спрогнозировать
            status = "inactive"

        # Средний балл
        avg_score_row = (
            db.query(func.avg(StudentProgress.test_score))
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == course.id,
                StudentProgress.is_completed == True,
                StudentProgress.test_score.isnot(None),
            )
            .scalar()
        )
        avg_score = round(float(avg_score_row), 1) if avg_score_row else 0

        progress_pct = round((completed_topics / total_topics) * 100) if total_topics else 0

        results.append({
            "course_id": course.id,
            "course_title": course.title,
            "total_topics": total_topics,
            "completed_topics": completed_topics,
            "remaining_topics": remaining,
            "progress_pct": progress_pct,
            "pace_per_week": pace_per_week,
            "estimated_days": estimated_days,
            "avg_score": avg_score,
            "status": status,
        })

    # Общий статус
    if not results:
        overall = "no_data"
    elif all(r["status"] == "completed" for r in results):
        overall = "all_completed"
    elif any(r["status"] == "inactive" for r in results):
        overall = "needs_attention"
    elif any(r["status"] == "slow" for r in results):
        overall = "moderate"
    else:
        overall = "on_track"

    return {
        "courses": results,
        "overall_status": overall,
    }


# ---------------------------------------------------------------------------
# 5. Персональный план обучения
# ---------------------------------------------------------------------------
@router.get("/study-plan")
def get_study_plan(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Персональные рекомендации: повтор слабых тем + следующие шаги."""

    enrollments = (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.user_id == current_user.id)
        .all()
    )
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return {"daily_goal_topics": 1, "recommendations": []}

    recommendations = []

    # 1. Слабые темы — повторить (приоритет high)
    weak_rows = (
        db.query(StudentProgress, CourseTopic, Course)
        .join(CourseTopic, StudentProgress.topic_id == CourseTopic.id)
        .join(Course, StudentProgress.course_id == Course.id)
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,
            StudentProgress.test_score.isnot(None),
            StudentProgress.test_score < 60,
        )
        .order_by(StudentProgress.test_score.asc())
        .limit(5)
        .all()
    )

    for sp, topic, course in weak_rows:
        recommendations.append({
            "type": "review",
            "topic_id": sp.topic_id,
            "course_id": sp.course_id,
            "topic_title": topic.title,
            "course_title": course.title,
            "priority": "high",
            "reason": f"Балл {float(sp.test_score):.0f}% — рекомендуется повторить",
            "reason_kk": f"Балл {float(sp.test_score):.0f}% — қайталау ұсынылады",
            "reason_en": f"Score {float(sp.test_score):.0f}% — review recommended",
            "score": float(sp.test_score) if sp.test_score else 0,
        })

    # 2. Следующие незавершённые темы — продолжить (приоритет medium)
    for course_id in course_ids:
        # Получить порядок тем
        modules = (
            db.query(CourseModule)
            .filter(CourseModule.course_id == course_id)
            .order_by(CourseModule.order_number)
            .all()
        )
        course_obj = db.query(Course).filter(Course.id == course_id).first()
        if not course_obj:
            continue

        completed_ids = set()
        completed_rows = (
            db.query(StudentProgress.topic_id)
            .filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.course_id == course_id,
                StudentProgress.is_completed == True,
            )
            .all()
        )
        completed_ids = {r[0] for r in completed_rows if r[0]}

        found_next = False
        for module in modules:
            topics = (
                db.query(CourseTopic)
                .filter(CourseTopic.module_id == module.id)
                .order_by(CourseTopic.order_number)
                .all()
            )
            for topic in topics:
                if topic.id not in completed_ids and not found_next:
                    recommendations.append({
                        "type": "continue",
                        "topic_id": topic.id,
                        "course_id": course_id,
                        "topic_title": topic.title,
                        "course_title": course_obj.title,
                        "priority": "medium",
                        "reason": "Следующая тема по порядку",
                        "reason_kk": "Кезектегі тақырып",
                        "reason_en": "Next topic in order",
                        "score": None,
                    })
                    found_next = True
                    break
            if found_next:
                break

    # 3. Ежедневная цель на основе темпа
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    recent_count = (
        db.query(func.count(StudentProgress.id))
        .filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,
            func.coalesce(StudentProgress.completed_at, StudentProgress.created_at) >= week_ago,
        )
        .scalar()
    ) or 0

    current_pace = recent_count / 7
    daily_goal = max(1, round(current_pace * 1.2))  # +20% от текущего темпа

    # Сортировка: сначала high, потом medium
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 2))

    return {
        "daily_goal_topics": daily_goal,
        "current_pace_per_day": round(current_pace, 1),
        "recommendations": recommendations,
    }
