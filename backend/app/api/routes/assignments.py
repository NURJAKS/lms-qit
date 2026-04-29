"""Студенческий API для заданий."""
import json
import uuid
from pathlib import Path
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.models.assignment_submission_grade import AssignmentSubmissionGrade
from app.models.teacher_assignment_rubric import TeacherAssignmentRubric
from app.models.teacher_material import TeacherMaterial
from app.models.course import Course
from app.models.notification import Notification
from app.models.assignment_class_comment import AssignmentClassComment
from app.models.teacher_group import TeacherGroup
from app.models.group_teacher import GroupTeacher
from app.api.routes.teacher import _rubric_row_to_api, _deadline_to_iso_utc
from app.api.assignment_access import (
    deadline_passed_utc,
    is_assignment_submission_closed,
    submission_closed_http_detail,
    can_student_see_item,
)
from app.services.topic_flow import video_requirement_met
from app.models.course_topic import CourseTopic

router = APIRouter(prefix="/assignments", tags=["assignments"])

ALLOWED_SUBMISSION_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".pdf", ".doc", ".docx", ".txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _submission_file_urls(sub: AssignmentSubmission | None) -> list[str]:
    if not sub:
        return []
    urls: list[str] = []
    if getattr(sub, "file_url", None):
        urls.append(sub.file_url)
    raw = getattr(sub, "file_urls", None)
    if raw:
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(parsed, list):
                urls.extend(str(u) for u in parsed if u)
        except (json.JSONDecodeError, TypeError):
            pass
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _assignment_json_list(raw: str | None) -> list:
    """Parse TeacherAssignment JSON array columns; bad legacy data must not break /assignments/my."""
    if not raw or not str(raw).strip():
        return []
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


class SubmitBody(BaseModel):
    submission_text: str | None = None
    file_url: str | None = None
    file_urls: list[str] | None = None


class ClassCommentBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)


def _can_access_assignment_class_comments(db: Session, user: User, a: TeacherAssignment) -> bool:
    if user.role in ("admin", "director", "curator"):
        return True
    if user.role == "teacher":
        # Check if primary teacher or in group_teachers
        group = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
        if not group:
            return False
        if group.teacher_id == user.id:
            return True
        exists = db.query(GroupTeacher).filter(
            GroupTeacher.group_id == group.id,
            GroupTeacher.teacher_id == user.id
        ).first()
        return exists is not None
    if user.role == "student":
        return (
            db.query(GroupStudent)
            .filter(GroupStudent.student_id == user.id, GroupStudent.group_id == a.group_id)
            .first()
            is not None
        )
    return False


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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    in_group = db.query(GroupStudent).filter(
        GroupStudent.student_id == current_user.id,
        GroupStudent.group_id == a.group_id,
    ).first()
    if not in_group:
        raise HTTPException(status_code=403, detail="errorNotYourGroup")
    existing = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="errorAlreadySubmitted")
    now = datetime.now(timezone.utc)
    if is_assignment_submission_closed(a):
        raise HTTPException(status_code=400, detail=submission_closed_http_detail(a))
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="errorFileNotSelected")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_SUBMISSION_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="errorInvalidFileType",
        )
    uploads_base = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    sub_dir = uploads_base / "submissions" / str(assignment_id)
    sub_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = sub_dir / name
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="errorFileTooLarge")
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
    aid_list = [a.id for a in assignments]
    teacher_ids = list({a.teacher_id for a in assignments})
    teachers = {u.id: u for u in db.query(User).filter(User.id.in_(teacher_ids)).all()} if teacher_ids else {}

    # Performance optimization: pre-fetch topic objects to check gating
    topic_objs = {}
    if topic_ids:
        for t in db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all():
            topic_objs[t.id] = t

    rubrics_by_assignment: dict[int, list[dict]] = {}
    if aid_list:
        for row in db.query(TeacherAssignmentRubric).filter(TeacherAssignmentRubric.assignment_id.in_(aid_list)).all():
            rubrics_by_assignment.setdefault(row.assignment_id, []).append(_rubric_row_to_api(row))

    sub_ids = [s.id for s in submissions_by_assignment.values() if s is not None]
    rubric_grades_by_sub: dict[int, list[dict]] = {}
    if sub_ids:
        for sg in db.query(AssignmentSubmissionGrade).filter(AssignmentSubmissionGrade.submission_id.in_(sub_ids)).all():
            rubric_grades_by_sub.setdefault(sg.submission_id, []).append(
                {"criterion_id": sg.criterion_id, "points": float(sg.points)}
            )

    from sqlalchemy import func as sa_func
    cc_counts: dict[int, int] = {}
    if aid_list:
        for aid, cnt in (
            db.query(AssignmentClassComment.assignment_id, sa_func.count(AssignmentClassComment.id))
            .filter(AssignmentClassComment.assignment_id.in_(aid_list))
            .group_by(AssignmentClassComment.assignment_id)
            .all()
        ):
            cc_counts[aid] = cnt

    comment_author_ids = list({s.teacher_comment_author_id for s in submissions_by_assignment.values() if s and s.teacher_comment_author_id})
    comment_authors = {u.id: u for u in db.query(User).filter(User.id.in_(comment_author_ids)).all()} if comment_author_ids else {}

    now = datetime.now(timezone.utc)
    out = []
    for a in assignments:
        if not can_student_see_item(a, current_user.id):
            continue
        sub = submissions_by_assignment.get(a.id)
        closed = is_assignment_submission_closed(a)
        passed = deadline_passed_utc(a.deadline, now)
        manually_closed = getattr(a, "closed_at", None) is not None
        tu = teachers.get(a.teacher_id)
        teacher_name = (tu.full_name or tu.email or "") if tu else ""
        
        comment_author_name = None
        if sub and sub.teacher_comment_author_id:
            cau = comment_authors.get(sub.teacher_comment_author_id)
            if cau:
                comment_author_name = cau.full_name or cau.email or ""

        rubric = rubrics_by_assignment.get(a.id, [])
        rgrades = rubric_grades_by_sub.get(sub.id, []) if sub else []
        out.append({
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "course_id": a.course_id,
            "course_title": courses[a.course_id].title if a.course_id in courses else "",
            "created_at": a.created_at.isoformat() if getattr(a, "created_at", None) else None,
            "topic_id": getattr(a, "topic_id", None),
            "topic_title": topics.get(getattr(a, "topic_id", 0)) if getattr(a, "topic_id", None) else None,
            "max_points": getattr(a, "max_points", 100),
            "teacher_name": teacher_name,
            "teacher_comment_author_name": comment_author_name,
            "rubric": rubric,
            "rubric_grades": rgrades,
            "attachment_urls": _assignment_json_list(getattr(a, "attachment_urls", None)),
            "attachment_links": _assignment_json_list(getattr(a, "attachment_links", None)),
            "video_urls": _assignment_json_list(getattr(a, "video_urls", None)),
            "test_id": getattr(a, "test_id", None),
            "deadline": _deadline_to_iso_utc(a.deadline),
            "closed": closed,
            "deadline_passed": passed,
            "manually_closed": manually_closed,
            "reject_submissions_after_deadline": bool(getattr(a, "reject_submissions_after_deadline", True)),
            "submitted": sub is not None,
            "submitted_at": sub.submitted_at.isoformat() if sub and getattr(sub, "submitted_at", None) else None,
            "graded_at": sub.graded_at.isoformat() if sub and getattr(sub, "graded_at", None) else None,
            "grade": float(sub.grade) if sub and sub.grade is not None else None,
            "teacher_comment": sub.teacher_comment if sub else None,
            "submission_text": (sub.submission_text if sub else None),
            "submission_file_urls": _submission_file_urls(sub),
            "class_comments_count": cc_counts.get(a.id, 0),
            "allow_student_class_comments": bool(getattr(a, "allow_student_class_comments", True)),
            "is_synopsis": bool(getattr(a, "is_synopsis", False)),
            "is_supplementary": bool(getattr(a, "is_supplementary", False)),
            "is_locked": (
                a.topic_id is not None 
                and a.topic_id in topic_objs 
                and not video_requirement_met(db, current_user.id, topic_objs[a.topic_id])
            ) if getattr(a, "topic_id", None) is not None else False,

        })
    return out


@router.get("/my-supplementary")
def list_my_supplementary_materials(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    course_id: int = Query(..., description="ID курса для дополнительных материалов"),
):
    """Список дополнительных материалов и заданий студента (is_supplementary=True), сгруппированных по темам."""
    from app.models.course_topic import CourseTopic

    group_ids = [
        gs.group_id
        for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()
    ]
    if not group_ids:
        return {"topics": [], "assignments": [], "materials": []}

    # Supplementary assignments
    supp_assignments = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.group_id.in_(group_ids),
            TeacherAssignment.course_id == course_id,
            TeacherAssignment.is_supplementary == True,
        )
        .order_by(TeacherAssignment.id.desc())
        .all()
    )

    # Supplementary materials
    supp_materials = (
        db.query(TeacherMaterial)
        .filter(
            TeacherMaterial.group_id.in_(group_ids),
            TeacherMaterial.course_id == course_id,
            TeacherMaterial.is_supplementary == True,
        )
        .order_by(TeacherMaterial.id.desc())
        .all()
    )

    # Course topics for structure
    topics = (
        db.query(CourseTopic)
        .filter(CourseTopic.course_id == course_id)
        .order_by(CourseTopic.order_number)
        .all()
    )

    topics_out = [{"id": t.id, "title": t.title, "order_number": t.order_number} for t in topics]

    assignments_out = [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "topic_id": a.topic_id,
            "attachment_urls": _assignment_json_list(getattr(a, "attachment_urls", None)),
            "attachment_links": _assignment_json_list(getattr(a, "attachment_links", None)),
            "video_urls": _assignment_json_list(getattr(a, "video_urls", None)),
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "is_synopsis": bool(getattr(a, "is_synopsis", False)),
        }
        for a in supp_assignments if can_student_see_item(a, current_user.id)
    ]

    materials_out = [
        {
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "topic_id": m.topic_id,
            "video_urls": _assignment_json_list(getattr(m, "video_urls", None)),
            "image_urls": _assignment_json_list(getattr(m, "image_urls", None)),
            "attachment_urls": _assignment_json_list(getattr(m, "attachment_urls", None)),
            "attachment_links": _assignment_json_list(getattr(m, "attachment_links", None)),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in supp_materials if can_student_see_item(m, current_user.id)
    ]

    return {"topics": topics_out, "assignments": assignments_out, "materials": materials_out}



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
    return [
        {
            "id": r.id,
            "assignment_id": r.assignment_id,
            "assignment_title": assignments.get(r.assignment_id).title if r.assignment_id in assignments else "",
            "course_title": courses.get(assignments.get(r.assignment_id).course_id).title if r.assignment_id in assignments and assignments[r.assignment_id].course_id in courses else "",
            "submission_text": r.submission_text,
            "file_url": r.file_url,
            "file_urls": _assignment_json_list(getattr(r, "file_urls", None)),
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

    topic_ids = [m.topic_id for m in materials if m.topic_id]
    topic_objs = {}
    if topic_ids:
        for t in db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all():
            topic_objs[t.id] = t

    return [
        {
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "course_id": m.course_id,
            "course_title": courses[m.course_id].title if m.course_id in courses else "",
            "topic_id": m.topic_id,
            "video_urls": _assignment_json_list(getattr(m, "video_urls", None)),
            "image_urls": _assignment_json_list(getattr(m, "image_urls", None)),
            "attachment_urls": _assignment_json_list(getattr(m, "attachment_urls", None)),
            "attachment_links": _assignment_json_list(getattr(m, "attachment_links", None)),
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "is_supplementary": bool(getattr(m, "is_supplementary", False)),
            "is_locked": False,
        }
        for m in materials if can_student_see_item(m, current_user.id)
    ]


@router.get("/{assignment_id}/class-comments")
def list_assignment_class_comments(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    if not _can_access_assignment_class_comments(db, current_user, a):
        raise HTTPException(status_code=403, detail="errorNoAccess")

    rows = (
        db.query(AssignmentClassComment, User)
        .join(User, User.id == AssignmentClassComment.author_id)
        .filter(AssignmentClassComment.assignment_id == assignment_id)
        .order_by(AssignmentClassComment.created_at.asc())
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


@router.post("/{assignment_id}/class-comments")
def post_assignment_class_comment(
    assignment_id: int,
    body: ClassCommentBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    if not _can_access_assignment_class_comments(db, current_user, a):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    if current_user.role == "student" and not bool(getattr(a, "allow_student_class_comments", True)):
        raise HTTPException(status_code=403, detail={"code": "assignment_class_comments_disabled"})

    row = AssignmentClassComment(assignment_id=assignment_id, author_id=current_user.id, text=body.text.strip())
    db.add(row)
    db.commit()
    db.refresh(row)

    # Invalidate frontend queries if needed (handled by React Query onSuccess)
    return {
        "id": row.id,
        "author_id": row.author_id,
        "author_name": (current_user.full_name or current_user.email or ""),
        "author_role": current_user.role,
        "text": row.text,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


# Backward-compatible alias expected by some student UIs.
# Returns only the current student's assignments (through their groups).
@router.get("")
def list_student_assignments_alias(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return list_my_assignments(db=db, current_user=current_user)


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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    if is_assignment_submission_closed(a):
        raise HTTPException(status_code=400, detail=submission_closed_http_detail(a))
    in_group = db.query(GroupStudent).filter(
        GroupStudent.student_id == current_user.id,
        GroupStudent.group_id == a.group_id,
    ).first()
    if not in_group:
        raise HTTPException(status_code=403, detail="errorNotYourGroup")
    existing = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="errorAlreadySubmitted")
    text_ok = bool(body.submission_text and str(body.submission_text).strip())
    has_files = bool(body.file_url) or bool(body.file_urls and len(body.file_urls) > 0)
    if not text_ok and not has_files:
        raise HTTPException(status_code=400, detail="errorAnswerEmpty")
    file_urls_json = None
    if body.file_urls:
        if len(body.file_urls) > 5:
            raise HTTPException(status_code=400, detail="errorMaxFiles")
        file_urls_json = json.dumps(body.file_urls)
    sub = AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submission_text=(body.submission_text.strip() if body.submission_text else None) or None,
        file_url=body.file_url,
        file_urls=file_urls_json,
    )
    db.add(sub)
    notif = Notification(
        user_id=a.teacher_id,
        type="assignment_submitted",
        title="notifReviewTaskTitle",
        message="notifReviewTaskBody",
        link=f"/app/teacher/view-answers/{assignment_id}",
    )
    db.add(notif)
    
    # If this is a primary synopsis, mark topic as completed ONLY IF there is no test for this topic
    if a.is_synopsis and not a.is_supplementary and a.topic_id:
        from app.models.test import Test
        from app.models.progress import StudentProgress
        
        # Check if topic has a test
        topic_has_test = db.query(Test).filter(Test.topic_id == a.topic_id).first() is not None
        
        if not topic_has_test:
            prog = db.query(StudentProgress).filter(
                StudentProgress.user_id == current_user.id,
                StudentProgress.topic_id == a.topic_id
            ).first()
            if not prog:
                prog = StudentProgress(
                    user_id=current_user.id,
                    course_id=a.course_id,
                    topic_id=a.topic_id,
                    is_completed=True,
                    completed_at=func.now()
                )
                db.add(prog)
            else:
                prog.is_completed = True
                prog.completed_at = func.now()

    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "message": "msgAssignmentSubmitted"}


@router.post("/{assignment_id}/unsubmit")
def unsubmit_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Unsubmit an assignment (deletes the student's submission).

    Note: Re-submission is still blocked by the due date/closed assignment logic in submit endpoint.
    """
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    submission = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.assignment_id == assignment_id, AssignmentSubmission.student_id == current_user.id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="errorRecordNotFound")

    # Avoid breaking already-graded work.
    if submission.graded_at is not None or submission.grade is not None:
        raise HTTPException(status_code=400, detail="unsubmitErrorGraded")

    if is_assignment_submission_closed(a):
        raise HTTPException(
            status_code=400,
            detail="errorUnsubmitForbidden",
        )

    db.delete(submission)
    db.commit()
    return {"ok": True, "message": "msgSubmissionRemoved"}
