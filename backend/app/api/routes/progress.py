from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.progress import StudentProgress
from app.models.enrollment import CourseEnrollment
from app.services.coins import add_coins, has_received_coins_for_reason

router = APIRouter(prefix="/progress", tags=["progress"])

# Лимиты для Free пользователей (в секундах)
FREE_DAILY_VIDEO_WATCH_LIMIT = 2 * 60 * 60  # 2 часа = 7200 секунд


class VideoProgressUpdate(BaseModel):
    topic_id: int
    video_watched_seconds: int


def _check_enrollment(db: Session, user_id: int, course_id: int) -> None:
    e = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == user_id,
        CourseEnrollment.course_id == course_id,
    ).first()
    if not e:
        raise HTTPException(status_code=403, detail="Сначала запишитесь на курс.")


def check_daily_video_watch_limit(db: Session, user_id: int, is_premium: bool, additional_seconds: int = 0) -> tuple[bool, int, int]:
    """
    Проверяет дневной лимит времени просмотра видео для пользователя.
    Возвращает: (is_allowed, used_seconds, limit_seconds)
    additional_seconds - дополнительные секунды, которые пользователь хочет добавить
    """
    if is_premium:
        return (True, 0, -1)  # -1 означает без ограничений
    
    # Подсчитываем время просмотра за сегодня
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Суммируем все video_watched_seconds за сегодня
    # Используем максимальное значение для каждой темы (так как прогресс обновляется)
    progress_today = db.query(
        StudentProgress.topic_id,
        func.max(StudentProgress.video_watched_seconds).label("max_watched")
    ).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.created_at >= today_start,
    ).group_by(StudentProgress.topic_id).all()
    
    used_seconds = sum(p.max_watched or 0 for p in progress_today)
    
    # Проверяем, не превысит ли добавление новых секунд лимит
    total_after_add = used_seconds + additional_seconds
    is_allowed = total_after_add <= FREE_DAILY_VIDEO_WATCH_LIMIT
    
    return (is_allowed, used_seconds, FREE_DAILY_VIDEO_WATCH_LIMIT)


@router.get("/daily-video-limit")
def get_daily_video_limit(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Возвращает информацию о дневном лимите времени просмотра видео."""
    is_premium = getattr(current_user, "is_premium", 0) == 1
    is_allowed, used_seconds, limit_seconds = check_daily_video_watch_limit(db, current_user.id, is_premium)
    
    return {
        "is_premium": is_premium,
        "used_seconds": used_seconds,
        "limit_seconds": limit_seconds,
        "remaining_seconds": limit_seconds - used_seconds if limit_seconds > 0 else -1,
        "is_allowed": is_allowed,
    }


@router.post("/video")
def update_video_progress(
    body: VideoProgressUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Проверяем лимит для Free пользователей
    is_premium = getattr(current_user, "is_premium", 0) == 1
    
    # Получаем тему для проверки существования и получения данных
    from app.models.course_topic import CourseTopic
    topic = db.query(CourseTopic).filter(CourseTopic.id == body.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    # Получаем текущий прогресс по теме
    prog = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.topic_id == body.topic_id,
    ).first()
    
    # Вычисляем дополнительные секунды, которые будут добавлены
    current_watched = prog.video_watched_seconds if prog else 0
    additional_seconds = max(0, body.video_watched_seconds - current_watched)
    
    if not is_premium and additional_seconds > 0:
        is_allowed, used_seconds, limit_seconds = check_daily_video_watch_limit(
            db, current_user.id, is_premium, additional_seconds
        )
        if not is_allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Дневной лимит времени просмотра исчерпан ({used_seconds // 60} мин / {limit_seconds // 60} мин). Оформите Premium для неограниченного доступа."
            )
    
    if not prog:
        _check_enrollment(db, current_user.id, topic.course_id)
        prog = StudentProgress(
            user_id=current_user.id,
            course_id=topic.course_id,
            topic_id=body.topic_id,
            video_watched_seconds=body.video_watched_seconds,
        )
        db.add(prog)
    else:
        prog.video_watched_seconds = max(prog.video_watched_seconds or 0, body.video_watched_seconds)
    
    # Начисление coins за просмотр теории (90%+ видео), один раз за тему
    if topic.video_duration and topic.video_duration > 0:
        watched_percent = (body.video_watched_seconds / topic.video_duration) * 100
        if watched_percent >= 90:
            theory_reason = f"theory_{body.topic_id}"
            if not has_received_coins_for_reason(db, current_user.id, theory_reason):
                add_coins(db, current_user.id, 25, theory_reason)
    
    db.commit()
    db.refresh(prog)
    return {"video_watched_seconds": prog.video_watched_seconds}


@router.get("/course/{course_id}")
def get_course_progress(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    _check_enrollment(db, current_user.id, course_id)
    items = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.course_id == course_id,
    ).all()
    return [{"topic_id": p.topic_id, "is_completed": p.is_completed, "test_score": float(p.test_score) if p.test_score else None, "video_watched_seconds": p.video_watched_seconds} for p in items]


@router.get("/me")
def my_progress(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    items = db.query(StudentProgress).filter(StudentProgress.user_id == current_user.id).all()
    return [{"course_id": p.course_id, "topic_id": p.topic_id, "is_completed": p.is_completed, "test_score": float(p.test_score) if p.test_score else None} for p in items]
