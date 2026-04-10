import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.course_topic import CourseTopic
from app.models.progress import StudentProgress
from app.models.topic_note import TopicNote
from app.models.topic_synopsis import TopicSynopsisSubmission
from app.schemas.course import CourseTopicResponse
from app.api.course_access import assert_can_access_course_materials
from app.services.topic_flow import topic_flow_status

SYNOPSIS_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".txt"}
SYNOPSIS_MAX_BYTES = 50 * 1024 * 1024

router = APIRouter(prefix="/topics", tags=["topics"])


class TopicNoteRequest(BaseModel):
    note_text: str


class TopicSynopsisBody(BaseModel):
    file_url: str = Field(..., min_length=1, max_length=500)


class TopicSynopsisNoteBody(BaseModel):
    note_text: str | None = Field(None, max_length=10000)


def _check_enrollment(db: Session, current_user: User, course_id: int) -> None:
    assert_can_access_course_materials(db, current_user, course_id)


def _theory_unlocked(db: Session, user_id: int, topic: CourseTopic) -> bool:
    """Теория (description) для видео-тем — только после 100% просмотра или завершения темы."""
    if not (topic.video_url or "").strip():
        return True
    prog = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.topic_id == topic.id,
    ).first()
    if prog and prog.is_completed:
        return True
    effective_duration = (topic.video_duration or 0) or 300
    if effective_duration <= 0:
        return True
    watched = (prog.video_watched_seconds if prog else 0) or 0
    return watched / effective_duration >= 0.99


def _sanitize_synopsis_url(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Файл не выбран")
    if len(value) > 500:
        raise HTTPException(status_code=400, detail="Слишком длинный путь к файлу")
    return value


def _get_topic_synopsis_rows(db: Session, user_id: int, topic_id: int) -> list[TopicSynopsisSubmission]:
    return (
        db.query(TopicSynopsisSubmission)
        .filter(
            TopicSynopsisSubmission.user_id == user_id,
            TopicSynopsisSubmission.topic_id == topic_id,
        )
        .order_by(TopicSynopsisSubmission.submitted_at.desc(), TopicSynopsisSubmission.id.desc())
        .all()
    )


def _extract_latest_note(rows: list[TopicSynopsisSubmission]) -> str | None:
    for row in rows:
        text = (row.note_text or "").strip()
        if text:
            return text
    return None


def _serialize_topic_synopsis_list(rows: list[TopicSynopsisSubmission]) -> dict:
    latest_note = _extract_latest_note(rows)
    # Pick the latest grade/comment if multiple rows exist
    latest_row = rows[0] if rows else None
    files = [
        {
            "id": row.id,
            "file_url": row.file_url,
            "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
        for row in rows
    ]
    return {
        "exists": len(files) > 0,
        "files": files,
        "note_text": latest_note,
        "max_files": 5,
        "grade": float(latest_row.grade) if latest_row and latest_row.grade is not None else None,
        "teacher_comment": latest_row.teacher_comment if latest_row else None,
        "graded_at": latest_row.graded_at.isoformat() if latest_row and latest_row.graded_at else None,
    }


@router.get("/{topic_id}", response_model=CourseTopicResponse)
def get_topic(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    unlocked = _theory_unlocked(db, current_user.id, topic)
    data = CourseTopicResponse.model_validate(topic)
    if unlocked:
        return data.model_copy(update={"theory_unlocked": True})
    return data.model_copy(update={"description": None, "theory_unlocked": False})


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
    _check_enrollment(db, current_user, topic.course_id)
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
    _check_enrollment(db, current_user, topic.course_id)
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


@router.get("/{topic_id}/flow-status")
def get_topic_flow_status(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Этапы цикла темы для студента: видео, конспект, домашка, тест."""
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    return topic_flow_status(db, current_user.id, topic)


@router.post("/{topic_id}/synopsis/upload")
async def upload_topic_synopsis_file(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File()] = ...,
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    if not _theory_unlocked(db, current_user.id, topic):
        raise HTTPException(
            status_code=403,
            detail="Конспект доступен после просмотра 100% видео по теме.",
        )
    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")
    ext = Path(file.filename).suffix.lower()
    if ext not in SYNOPSIS_ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Допустимые форматы: {', '.join(sorted(SYNOPSIS_ALLOWED_EXT))}",
        )
    content = await file.read()
    if len(content) > SYNOPSIS_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 50MB)")
    uploads_base = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    sub_dir = uploads_base / "topic-synopsis" / str(topic_id)
    sub_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = sub_dir / name
    dest.write_bytes(content)
    url = f"/uploads/topic-synopsis/{topic_id}/{name}"
    return {"url": url}


@router.post("/{topic_id}/synopsis")
def save_topic_synopsis(
    topic_id: int,
    body: TopicSynopsisBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    if not _theory_unlocked(db, current_user.id, topic):
        raise HTTPException(
            status_code=403,
            detail="Конспект доступен после просмотра 100% видео по теме.",
        )
    file_url = _sanitize_synopsis_url(body.file_url)
    rows = _get_topic_synopsis_rows(db, current_user.id, topic_id)
    if len(rows) >= 5:
        raise HTTPException(status_code=400, detail="Можно загрузить не более 5 файлов конспекта по теме.")
    inherited_note = _extract_latest_note(rows)
    row = TopicSynopsisSubmission(
        user_id=current_user.id,
        topic_id=topic_id,
        file_url=file_url,
        note_text=inherited_note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_topic_synopsis_list(_get_topic_synopsis_rows(db, current_user.id, topic_id))


@router.get("/{topic_id}/synopsis")
def get_my_topic_synopsis(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    rows = _get_topic_synopsis_rows(db, current_user.id, topic_id)
    return _serialize_topic_synopsis_list(rows)


@router.post("/{topic_id}/synopsis/note")
def save_topic_synopsis_note(
    topic_id: int,
    body: TopicSynopsisNoteBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    rows = _get_topic_synopsis_rows(db, current_user.id, topic_id)
    if not rows:
        raise HTTPException(status_code=400, detail="Сначала загрузите хотя бы один файл конспекта.")
    note = (body.note_text or "").strip() or None
    now = datetime.utcnow()
    for row in rows:
        row.note_text = note
        row.updated_at = now
    db.commit()
    return _serialize_topic_synopsis_list(_get_topic_synopsis_rows(db, current_user.id, topic_id))


@router.put("/{topic_id}/synopsis/{synopsis_id}")
def replace_topic_synopsis_file(
    topic_id: int,
    synopsis_id: int,
    body: TopicSynopsisBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    row = (
        db.query(TopicSynopsisSubmission)
        .filter(
            TopicSynopsisSubmission.id == synopsis_id,
            TopicSynopsisSubmission.user_id == current_user.id,
            TopicSynopsisSubmission.topic_id == topic_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Файл конспекта не найден")
    row.file_url = _sanitize_synopsis_url(body.file_url)
    row.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_topic_synopsis_list(_get_topic_synopsis_rows(db, current_user.id, topic_id))


@router.delete("/{topic_id}/synopsis/{synopsis_id}")
def delete_topic_synopsis_file(
    topic_id: int,
    synopsis_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    _check_enrollment(db, current_user, topic.course_id)
    row = (
        db.query(TopicSynopsisSubmission)
        .filter(
            TopicSynopsisSubmission.id == synopsis_id,
            TopicSynopsisSubmission.user_id == current_user.id,
            TopicSynopsisSubmission.topic_id == topic_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Файл конспекта не найден")
    db.delete(row)
    db.commit()
    return _serialize_topic_synopsis_list(_get_topic_synopsis_rows(db, current_user.id, topic_id))


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
    _check_enrollment(db, current_user, topic.course_id)
    
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
    _check_enrollment(db, current_user, topic.course_id)
    
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
    _check_enrollment(db, current_user, topic.course_id)
    
    note = db.query(TopicNote).filter(
        TopicNote.user_id == current_user.id,
        TopicNote.topic_id == topic_id,
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    db.delete(note)
    db.commit()
    return {"message": "Заметка удалена"}
