from typing import Annotated
from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.ai_chat_history import AIChatHistory
from app.models.test import Test
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.models.group_student import GroupStudent
from app.models.progress import StudentProgress
from app.services.ai_service import chat_with_openai

router = APIRouter(prefix="/ai", tags=["ai"])

# Лимиты для Free пользователей
FREE_AI_CHAT_DAILY_LIMIT = 5


class ChatRequest(BaseModel):
    message: str
    course_id: int | None = None
    test_id: int | None = None  # Если студент проходит тест
    assignment_id: int | None = None  # Если студент работает над заданием


class ChatResponse(BaseModel):
    response: str
    message_id: int | None = None


def check_active_test_or_assignment(
    db: Session,
    user_id: int,
    course_id: int | None = None,
    test_id: int | None = None,
    assignment_id: int | None = None,
) -> tuple[bool, bool, int | None, int | None]:
    """
    Проверяет, есть ли у студента активные тесты или задания, которые еще не сданы.
    Возвращает: (is_test_context, is_assignment_context, active_test_id, active_assignment_id)
    """
    active_test_id = None
    active_assignment_id = None
    is_test_context = False
    is_assignment_context = False
    
    # Если передан test_id, проверяем, что тест существует и студент на него записан
    if test_id:
        test = db.query(Test).filter(Test.id == test_id).first()
        if test:
            # Проверяем, не пройден ли уже тест
            if test.topic_id:
                progress = db.query(StudentProgress).filter(
                    StudentProgress.user_id == user_id,
                    StudentProgress.topic_id == test.topic_id,
                    StudentProgress.is_completed == True,
                ).first()
                if not progress:  # Тест еще не пройден
                    is_test_context = True
                    active_test_id = test_id
            else:
                # Если тест без topic_id, считаем его активным
                is_test_context = True
                active_test_id = test_id
    
    # Если передан assignment_id, проверяем, что задание существует и не сдано
    if assignment_id:
        assignment = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
        if assignment:
            # Проверяем, что студент в группе
            in_group = db.query(GroupStudent).filter(
                GroupStudent.student_id == user_id,
                GroupStudent.group_id == assignment.group_id,
            ).first()
            if in_group:
                # Проверяем, не сдано ли уже задание
                submission = db.query(AssignmentSubmission).filter(
                    AssignmentSubmission.assignment_id == assignment_id,
                    AssignmentSubmission.student_id == user_id,
                ).first()
                if not submission:  # Задание еще не сдано
                    is_assignment_context = True
                    active_assignment_id = assignment_id
    
    # Если не переданы конкретные ID, проверяем все активные тесты/задания студента
    if not test_id and not assignment_id:
        # Проверяем активные задания (не сданные, с дедлайном в будущем или без дедлайна)
        group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == user_id).all()]
        if group_ids:
            now = datetime.now(timezone.utc)
            active_assignments = db.query(TeacherAssignment).filter(
                TeacherAssignment.group_id.in_(group_ids),
                TeacherAssignment.deadline.isnot(None),
                TeacherAssignment.deadline >= now,
            ).all()
            
            for assignment in active_assignments:
                submission = db.query(AssignmentSubmission).filter(
                    AssignmentSubmission.assignment_id == assignment.id,
                    AssignmentSubmission.student_id == user_id,
                ).first()
                if not submission:
                    is_assignment_context = True
                    active_assignment_id = assignment.id
                    break  # Берем первое активное задание
        
        # Проверяем активные тесты (не пройденные тесты в курсах студента)
        if course_id:
            tests = db.query(Test).filter(Test.course_id == course_id).all()
            for test in tests:
                if test.topic_id:
                    progress = db.query(StudentProgress).filter(
                        StudentProgress.user_id == user_id,
                        StudentProgress.topic_id == test.topic_id,
                        StudentProgress.is_completed == True,
                    ).first()
                    if not progress:
                        is_test_context = True
                        active_test_id = test.id
                        break
    
    return (is_test_context, is_assignment_context, active_test_id, active_assignment_id)


def check_daily_ai_chat_limit(db: Session, user_id: int, is_premium: bool) -> tuple[bool, int, int]:
    """
    Проверяет дневной лимит AI-чата для пользователя.
    Возвращает: (is_allowed, used_count, limit)
    """
    if is_premium:
        return (True, 0, -1)  # -1 означает без ограничений
    
    # Подсчитываем запросы за сегодня
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = db.query(func.count(AIChatHistory.id)).filter(
        AIChatHistory.user_id == user_id,
        AIChatHistory.created_at >= today_start,
    ).scalar() or 0
    
    is_allowed = today_count < FREE_AI_CHAT_DAILY_LIMIT
    return (is_allowed, today_count, FREE_AI_CHAT_DAILY_LIMIT)


@router.get("/daily-limit")
def get_daily_limit(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Возвращает информацию о дневном лимите AI-чата."""
    is_premium = getattr(current_user, "is_premium", 0) == 1
    is_allowed, used_count, limit = check_daily_ai_chat_limit(db, current_user.id, is_premium)
    
    return {
        "is_premium": is_premium,
        "used_count": used_count,
        "limit": limit,
        "remaining": limit - used_count if limit > 0 else -1,
        "is_allowed": is_allowed,
    }


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Проверяем лимит для Free пользователей
    is_premium = getattr(current_user, "is_premium", 0) == 1
    is_allowed, used_count, limit = check_daily_ai_chat_limit(db, current_user.id, is_premium)
    
    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Дневной лимит AI-чата исчерпан ({used_count}/{limit}). Оформите Premium для неограниченного доступа."
        )
    
    context = ""
    if body.course_id:
        from app.models.course import Course
        c = db.query(Course).filter(Course.id == body.course_id).first()
        if c:
            context = c.title + ": " + (c.description or "")
    
    # Проверяем активные тесты/задания
    is_test_context, is_assignment_context, active_test_id, active_assignment_id = check_active_test_or_assignment(
        db, current_user.id, body.course_id, body.test_id, body.assignment_id
    )
    
    # Получаем ответ от AI с проверкой на подозрительные запросы
    response_text, is_suspicious = chat_with_openai(
        body.message,
        context,
        is_test_context=is_test_context,
        is_assignment_context=is_assignment_context,
    )
    
    # Сохраняем запрос с информацией о подозрительности и контексте
    record = AIChatHistory(
        user_id=current_user.id,
        course_id=body.course_id,
        message=body.message,
        response=response_text,
        is_suspicious=is_suspicious,
        test_id=active_test_id,
        assignment_id=active_assignment_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return ChatResponse(response=response_text, message_id=record.id)


@router.get("/history")
def chat_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    course_id: int | None = None,
    limit: int = 50,
):
    q = db.query(AIChatHistory).filter(AIChatHistory.user_id == current_user.id)
    if course_id is not None:
        q = q.filter(AIChatHistory.course_id == course_id)
    rows = q.order_by(AIChatHistory.created_at.desc()).limit(limit).all()
    return [{"id": r.id, "message": r.message, "response": r.response, "course_id": r.course_id, "created_at": r.created_at} for r in reversed(rows)]
