from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.course_topic import CourseTopic
from app.models.enrollment import CourseEnrollment
from app.models.progress import StudentProgress
from app.models.topic_note import TopicNote
from app.schemas.course import CourseTopicResponse

router = APIRouter(prefix="/topics", tags=["topics"])


class TopicNoteRequest(BaseModel):
    note_text: str


def _check_enrollment(db: Session, user_id: int, course_id: int) -> None:
    e = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == user_id,
        CourseEnrollment.course_id == course_id,
    ).first()
    if not e:
        raise HTTPException(status_code=403, detail="Сначала запишитесь на курс.")


@router.get("/{topic_id}", response_model=CourseTopicResponse)
def get_topic(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user.id, topic.course_id)
    return topic


@router.get("/{topic_id}/test")
def get_topic_test(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    from app.models.test import Test
    test = db.query(Test).filter(Test.topic_id == topic_id, Test.is_final == 0).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user.id, topic.course_id)
    return {"test_id": test.id}


@router.get("/{topic_id}/access")
def check_topic_access(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Проверка: доступна ли тема (предыдущая пройдена)."""
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user.id, topic.course_id)
    # Первая тема по order_number в курсе — доступна
    first_topic = db.query(CourseTopic).filter(
        CourseTopic.course_id == topic.course_id,
    ).order_by(CourseTopic.order_number).first()
    if first_topic and first_topic.id == topic_id:
        return {"allowed": True, "reason": "first_topic"}
    # Ищем предыдущую тему по order_number
    prev_topics = db.query(CourseTopic).filter(
        CourseTopic.course_id == topic.course_id,
        CourseTopic.order_number < topic.order_number,
    ).order_by(CourseTopic.order_number.desc()).all()
    if not prev_topics:
        return {"allowed": True, "reason": "no_prev"}
    prev = prev_topics[0]
    prog = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.topic_id == prev.id,
        StudentProgress.is_completed == True,
    ).first()
    allowed = prog is not None
    return {"allowed": allowed, "reason": "prev_completed" if allowed else "prev_not_completed"}


@router.get("/{topic_id}/note")
def get_topic_note(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Получить заметку пользователя для темы (только для Premium)."""
    is_premium = getattr(current_user, "is_premium", 0) == 1
    if not is_premium:
        raise HTTPException(
            status_code=403,
            detail="Заметки доступны только для Premium пользователей. Оформите подписку."
        )
    
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user.id, topic.course_id)
    
    note = db.query(TopicNote).filter(
        TopicNote.user_id == current_user.id,
        TopicNote.topic_id == topic_id,
    ).first()
    
    if not note:
        return {"note_text": "", "exists": False}
    
    return {"note_text": note.note_text, "exists": True, "created_at": note.created_at.isoformat() if note.created_at else None, "updated_at": note.updated_at.isoformat() if note.updated_at else None}


@router.post("/{topic_id}/note")
def create_or_update_topic_note(
    topic_id: int,
    body: TopicNoteRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Создать или обновить заметку для темы (только для Premium)."""
    is_premium = getattr(current_user, "is_premium", 0) == 1
    if not is_premium:
        raise HTTPException(
            status_code=403,
            detail="Заметки доступны только для Premium пользователей. Оформите подписку."
        )
    
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user.id, topic.course_id)
    
    if not body.note_text.strip():
        raise HTTPException(status_code=400, detail="Текст заметки не может быть пустым")
    
    note = db.query(TopicNote).filter(
        TopicNote.user_id == current_user.id,
        TopicNote.topic_id == topic_id,
    ).first()
    
    if note:
        note.note_text = body.note_text.strip()
        from datetime import datetime, timezone
        note.updated_at = datetime.now(timezone.utc)
    else:
        note = TopicNote(
            user_id=current_user.id,
            topic_id=topic_id,
            note_text=body.note_text.strip(),
        )
        db.add(note)
    
    db.commit()
    db.refresh(note)
    return {"note_text": note.note_text, "created_at": note.created_at.isoformat() if note.created_at else None, "updated_at": note.updated_at.isoformat() if note.updated_at else None}


@router.delete("/{topic_id}/note")
def delete_topic_note(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить заметку для темы (только для Premium)."""
    is_premium = getattr(current_user, "is_premium", 0) == 1
    if not is_premium:
        raise HTTPException(
            status_code=403,
            detail="Заметки доступны только для Premium пользователей. Оформите подписку."
        )
    
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user.id, topic.course_id)
    
    note = db.query(TopicNote).filter(
        TopicNote.user_id == current_user.id,
        TopicNote.topic_id == topic_id,
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    db.delete(note)
    db.commit()
    return {"message": "Заметка удалена"}
