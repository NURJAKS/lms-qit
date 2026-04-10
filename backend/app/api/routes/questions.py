from datetime import datetime, timezone
from typing import Annotated
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.teacher_question import TeacherQuestion, TeacherQuestionAnswer
from app.models.group_student import GroupStudent
from app.models.group_teacher import GroupTeacher
from app.models.user import User
from app.models.course import Course
from app.models.course_topic import CourseTopic
from app.models.teacher_group import TeacherGroup
from app.models.question_class_comment import TeacherQuestionClassComment

router = APIRouter(prefix="/questions", tags=["questions"])


def _question_options_len(raw: str | None) -> int:
    if not raw or not str(raw).strip():
        return 0
    try:
        v = json.loads(raw)
        return len(v) if isinstance(v, list) else 0
    except (json.JSONDecodeError, TypeError, ValueError):
        return 0


def _api_question_type_row(question_type: str | None, options_json: str | None) -> str:
    qt = (question_type or "open").lower()
    if qt in ("single_choice", "multiple_choice"):
        return "single_choice"
    if _question_options_len(options_json) >= 2:
        return "single_choice"
    return "open"


def _question_options_list(raw: str | None) -> list:
    if not raw or not str(raw).strip():
        return []
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def _question_type_detail(q: TeacherQuestion) -> str:
    opts = _question_options_list(q.options)
    qt = (q.question_type or "open").lower()
    if qt in ("single_choice", "multiple_choice"):
        return "single_choice"
    if len(opts) >= 2:
        return "single_choice"
    return "open"


def _is_question_deadline_closed(q: TeacherQuestion) -> bool:
    dl = q.deadline
    if dl is None:
        return False
    if not q.reject_submissions_after_deadline:
        return False
    now = datetime.now(timezone.utc)
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    return dl < now


class QuestionSubmitBody(BaseModel):
    answer_text: str


class QuestionClassCommentBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)


def _can_access_question_class_comments(db: Session, user: User, q: TeacherQuestion) -> bool:
    if user.role in ("admin", "director", "curator"):
        return True
    if user.role == "teacher":
        group = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
        if not group:
            return False
        if group.teacher_id == user.id:
            return True
        exists = db.query(GroupTeacher).filter(
            GroupTeacher.group_id == group.id,
            GroupTeacher.teacher_id == user.id,
        ).first()
        return exists is not None
    if user.role == "student":
        return (
            db.query(GroupStudent)
            .filter(GroupStudent.student_id == user.id, GroupStudent.group_id == q.group_id)
            .first()
            is not None
        )
    return False


@router.get("/my")
def list_my_questions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List questions for the student's groups."""
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()]
    if not group_ids:
        return []
        
    questions = (
        db.query(TeacherQuestion)
        .filter(TeacherQuestion.group_id.in_(group_ids))
        .order_by(TeacherQuestion.id.desc())
        .all()
    )
    
    if not questions:
        return []
        
    # Pre-fetch student's answers
    q_ids = [q.id for q in questions]
    answers = (
        db.query(TeacherQuestionAnswer)
        .filter(
            TeacherQuestionAnswer.question_id.in_(q_ids),
            TeacherQuestionAnswer.student_id == current_user.id
        )
        .all()
    )
    ans_map = {a.question_id: a for a in answers}
    
    # Pre-fetch courses and topics
    course_ids = list({q.course_id for q in questions})
    courses = {c.id: c.title for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    
    topic_ids = list({q.topic_id for q in questions if q.topic_id})
    topics = {t.id: t.title for t in db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all()}
    
    out = []
    for q in questions:
        ans = ans_map.get(q.id)
        out.append({
            "id": q.id,
            "text": q.question_text,
            "type": _api_question_type_row(q.question_type, q.options),
            "course_id": q.course_id,
            "course_title": courses.get(q.course_id, ""),
            "topic_id": q.topic_id,
            "topic_title": topics.get(q.topic_id) if q.topic_id else None,
            "status": "submitted" if ans else "not_submitted",
            "grade": ans.grade if ans else None,
            "teacher_comment": ans.teacher_comment if ans else None,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        })
    return out


@router.get("/{question_id}/class-comments")
def list_question_class_comments(
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if not _can_access_question_class_comments(db, current_user, q):
        raise HTTPException(status_code=403, detail={"code": "forbidden"})

    rows = (
        db.query(TeacherQuestionClassComment, User)
        .join(User, User.id == TeacherQuestionClassComment.author_id)
        .filter(TeacherQuestionClassComment.question_id == question_id)
        .order_by(TeacherQuestionClassComment.created_at.asc())
        .all()
    )
    return [
        {
            "id": c.id,
            "author_id": c.author_id,
            "author_name": (u.full_name or u.email or "") if u else "",
            "author_role": u.role if u else None,
            "text": c.text,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c, u in rows
    ]


@router.post("/{question_id}/class-comments")
def post_question_class_comment(
    question_id: int,
    body: QuestionClassCommentBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if not _can_access_question_class_comments(db, current_user, q):
        raise HTTPException(status_code=403, detail={"code": "forbidden"})
    if current_user.role == "student" and not q.allow_student_class_comments:
        raise HTTPException(status_code=403, detail={"code": "question_class_comments_disabled"})

    row = TeacherQuestionClassComment(
        question_id=question_id,
        author_id=current_user.id,
        text=body.text.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "author_id": row.author_id,
        "author_name": current_user.full_name or current_user.email or "",
        "author_role": current_user.role,
        "text": row.text,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/{question_id}")
def get_question_for_student(
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    in_group = (
        db.query(GroupStudent)
        .filter(
            GroupStudent.student_id == current_user.id,
            GroupStudent.group_id == q.group_id,
        )
        .first()
    )
    if not in_group:
        raise HTTPException(status_code=403, detail={"code": "forbidden"})
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    group_name = g.group_name if g else ""
    ans = (
        db.query(TeacherQuestionAnswer)
        .filter(
            TeacherQuestionAnswer.question_id == question_id,
            TeacherQuestionAnswer.student_id == current_user.id,
        )
        .first()
    )
    qtype = _question_type_detail(q)
    opts = _question_options_list(q.options)
    show_correct = bool(ans and ans.grade is not None and qtype == "single_choice")
    answer_out = None
    if ans:
        answer_out = {
            "id": ans.id,
            "student_id": current_user.id,
            "student_name": current_user.full_name or current_user.email or "",
            "answer_text": ans.answer_text,
            "grade": ans.grade,
            "teacher_comment": ans.teacher_comment,
            "submitted_at": ans.created_at.isoformat() if ans.created_at else None,
            "status": "submitted",
        }
    return {
        "question": {
            "id": q.id,
            "text": q.question_text,
            "type": qtype,
            "options": opts,
            "correct_option": q.correct_option if show_correct else None,
            "group_name": group_name,
            "allow_student_class_comments": bool(q.allow_student_class_comments),
        },
        "answer": answer_out,
    }


@router.post("/{question_id}/submit")
def submit_question_answer(
    question_id: int,
    body: QuestionSubmitBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    in_group = (
        db.query(GroupStudent)
        .filter(
            GroupStudent.student_id == current_user.id,
            GroupStudent.group_id == q.group_id,
        )
        .first()
    )
    if not in_group:
        raise HTTPException(status_code=403, detail={"code": "forbidden"})
    text = (body.answer_text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail={"code": "validation_error", "message": "answer_text required"})

    qtype = _question_type_detail(q)
    opts = _question_options_list(q.options)
    if qtype == "single_choice" and opts and text not in opts:
        raise HTTPException(status_code=400, detail={"code": "validation_error", "message": "invalid option"})

    existing = (
        db.query(TeacherQuestionAnswer)
        .filter(
            TeacherQuestionAnswer.question_id == question_id,
            TeacherQuestionAnswer.student_id == current_user.id,
        )
        .first()
    )

    if _is_question_deadline_closed(q):
        raise HTTPException(status_code=400, detail={"code": "question_closed"})

    if existing:
        if existing.grade is not None:
            raise HTTPException(status_code=400, detail={"code": "question_already_graded"})
        if not q.allow_student_edit_submission:
            raise HTTPException(status_code=400, detail={"code": "question_edit_not_allowed"})
        existing.answer_text = text
        db.commit()
        db.refresh(existing)
        return {"ok": True, "id": existing.id}

    row = TeacherQuestionAnswer(
        question_id=question_id,
        student_id=current_user.id,
        answer_text=text,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "id": row.id}
