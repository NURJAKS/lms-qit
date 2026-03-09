"""Студенческий API для заданий."""
import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.models.teacher_material import TeacherMaterial
from app.models.course import Course
from app.models.notification import Notification

router = APIRouter(prefix="/assignments", tags=["assignments"])

ALLOWED_SUBMISSION_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".pdf", ".doc", ".docx", ".txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class SubmitBody(BaseModel):
    submission_text: str | None = None
    file_url: str | None = None
    file_urls: list[str] | None = None


@router.post("/submissions/upload")
async def upload_submission_file(
    assignment_id: int = Query(...),
    file: Annotated[UploadFile, File()] = ...,
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    """Загрузить файл для сдачи задания."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    in_group = db.query(GroupStudent).filter(
        GroupStudent.student_id == current_user.id,
        GroupStudent.group_id == a.group_id,
    ).first()
    if not in_group:
        raise HTTPException(status_code=403, detail="Вы не в группе этого задания")
    existing = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже сдали это задание")
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_SUBMISSION_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Только: {', '.join(ALLOWED_SUBMISSION_EXTENSIONS)}",
        )
    uploads_base = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    sub_dir = uploads_base / "submissions" / str(assignment_id)
    sub_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = sub_dir / name
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 50MB)")
    dest.write_bytes(content)
    url = f"/uploads/submissions/{assignment_id}/{name}"
    return {"url": url}


@router.get("/my")
def list_my_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Список заданий студента (через группы)."""
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()]
    if not group_ids:
        return []
    assignments = db.query(TeacherAssignment).filter(TeacherAssignment.group_id.in_(group_ids)).order_by(TeacherAssignment.id.desc()).all()
    course_ids = list({a.course_id for a in assignments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    submissions_by_assignment = {}
    for s in db.query(AssignmentSubmission).filter(
        AssignmentSubmission.student_id == current_user.id,
        AssignmentSubmission.assignment_id.in_([a.id for a in assignments]),
    ).all():
        submissions_by_assignment[s.assignment_id] = s
    topics = {}
    if assignments:
        from app.models.course_topic import CourseTopic
        topic_ids = [a.topic_id for a in assignments if getattr(a, "topic_id", None)]
        if topic_ids:
            for t in db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all():
                topics[t.id] = t.title
    out = []
    for a in assignments:
        sub = submissions_by_assignment.get(a.id)
        out.append({
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "course_id": a.course_id,
            "course_title": courses[a.course_id].title if a.course_id in courses else "",
            "topic_id": getattr(a, "topic_id", None),
            "topic_title": topics.get(getattr(a, "topic_id", 0)) if getattr(a, "topic_id", None) else None,
            "max_points": getattr(a, "max_points", 100),
            "attachment_urls": json.loads(a.attachment_urls) if getattr(a, "attachment_urls", None) else [],
            "attachment_links": json.loads(a.attachment_links) if getattr(a, "attachment_links", None) else [],
            "video_urls": json.loads(a.video_urls) if getattr(a, "video_urls", None) else [],
            "test_id": getattr(a, "test_id", None),
            "deadline": a.deadline.isoformat() if a.deadline else None,
            "submitted": sub is not None,
            "grade": float(sub.grade) if sub and sub.grade else None,
            "teacher_comment": sub.teacher_comment if sub else None,
        })
    return out


@router.post("/{assignment_id}/submit")
def submit_assignment(
    assignment_id: int,
    body: SubmitBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Сдать задание."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    in_group = db.query(GroupStudent).filter(
        GroupStudent.student_id == current_user.id,
        GroupStudent.group_id == a.group_id,
    ).first()
    if not in_group:
        raise HTTPException(status_code=403, detail="Вы не в группе этого задания")
    existing = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже сдали это задание")
    file_urls_json = None
    if body.file_urls:
        if len(body.file_urls) > 5:
            raise HTTPException(status_code=400, detail="Максимум 5 файлов")
        file_urls_json = json.dumps(body.file_urls)
    sub = AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submission_text=body.submission_text or None,
        file_url=body.file_url,
        file_urls=file_urls_json,
    )
    db.add(sub)
    notif = Notification(
        user_id=a.teacher_id,
        type="assignment_submitted",
        title="Проверьте задание",
        message=f"Студент {current_user.full_name or current_user.email} сдал задание «{a.title}».",
        link=f"/app/teacher/assignment/{assignment_id}",
    )
    db.add(notif)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "message": "Тапсырма сәтті жіберілді"}


@router.get("/my/submissions")
def list_my_submissions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Мои сдачи с оценками."""
    rows = db.query(AssignmentSubmission).filter(AssignmentSubmission.student_id == current_user.id).order_by(AssignmentSubmission.submitted_at.desc()).all()
    assignment_ids = list({r.assignment_id for r in rows})
    assignments = {a.id: a for a in db.query(TeacherAssignment).filter(TeacherAssignment.id.in_(assignment_ids)).all()}
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_([a.course_id for a in assignments.values()])).all()}
    import json
    return [
        {
            "id": r.id,
            "assignment_id": r.assignment_id,
            "assignment_title": assignments.get(r.assignment_id).title if r.assignment_id in assignments else "",
            "course_title": courses.get(assignments.get(r.assignment_id).course_id).title if r.assignment_id in assignments and assignments[r.assignment_id].course_id in courses else "",
            "submission_text": r.submission_text,
            "file_url": r.file_url,
            "file_urls": json.loads(r.file_urls) if r.file_urls else [],
            "grade": float(r.grade) if r.grade else None,
            "teacher_comment": r.teacher_comment,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "graded_at": r.graded_at.isoformat() if r.graded_at else None,
        }
        for r in rows
    ]


@router.get("/my-materials")
def list_my_materials(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Список материалов студента (через группы)."""
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()]
    if not group_ids:
        return []
    materials = db.query(TeacherMaterial).filter(TeacherMaterial.group_id.in_(group_ids)).order_by(TeacherMaterial.id.desc()).all()
    course_ids = list({m.course_id for m in materials})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    return [
        {
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "course_id": m.course_id,
            "course_title": courses[m.course_id].title if m.course_id in courses else "",
            "topic_id": m.topic_id,
            "video_urls": json.loads(m.video_urls) if m.video_urls else [],
            "image_urls": json.loads(m.image_urls) if m.image_urls else [],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in materials
    ]
