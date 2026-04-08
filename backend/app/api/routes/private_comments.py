from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.assignment_submission import AssignmentSubmission
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.teacher_material import TeacherMaterial
from app.models.assignment_private_comment import AssignmentPrivateComment
from app.models.material_private_comment import MaterialPrivateComment
from app.models.user import User

router = APIRouter(prefix="/private-comments", tags=["private-comments"])


TargetType = Literal["assignment", "material"]


class PrivateCommentCreateBody(BaseModel):
    target_type: TargetType
    target_id: int = Field(..., gt=0)
    text: str = Field(..., min_length=1, max_length=20000)


def _assignment_private_thread_entries(
    assignment: TeacherAssignment,
    submission: AssignmentSubmission | None,
    student_user: User | None,
    assignment_teacher_user: User | None,
    teacher_comment_author_user: User | None,
) -> list[dict]:
    """Student note (student_private_comment) then teacher feedback (teacher_comment)."""
    if not submission:
        return []
    out: list[dict] = []
    teacher_display_user = teacher_comment_author_user or assignment_teacher_user
    teacher_name = (teacher_display_user.full_name or teacher_display_user.email) if teacher_display_user else None
    student_name = (student_user.full_name or student_user.email) if student_user else None
    sid = submission.id
    spc = getattr(submission, "student_private_comment", None)
    if spc and str(spc).strip():
        out.append(
            {
                "id": sid * 2,
                "target_type": "assignment",
                "target_id": assignment.id,
                "author_role": "student",
                "author_id": submission.student_id,
                "author_name": student_name,
                "text": str(spc).strip(),
                "created_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            }
        )
    tc = submission.teacher_comment
    if tc and str(tc).strip():
        out.append(
            {
                "id": sid * 2 + 1,
                "target_type": "assignment",
                "target_id": assignment.id,
                "author_role": "teacher",
                "author_id": teacher_display_user.id if teacher_display_user else assignment.teacher_id,
                "author_name": teacher_name,
                "text": str(tc).strip(),
                "created_at": submission.graded_at.isoformat() if submission.graded_at else None,
            }
        )
    return out


@router.get("")
def list_private_comments(
    target_type: TargetType = Query(...),
    target_id: int = Query(..., gt=0),
    student_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Private comments for:
      - assignment: student_private_comment (student) + teacher_comment (teacher feedback), per submission
      - material: stored in material_private_comments table
    """

    if target_type == "assignment":
        assignment = db.query(TeacherAssignment).filter(TeacherAssignment.id == target_id).first()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        assignment_teacher_user = db.query(User).filter(User.id == assignment.teacher_id).first()
        
        # Decide which student we're looking at
        target_student_id = None
        if current_user.role == "student":
            target_student_id = current_user.id
            in_group = (
                db.query(GroupStudent)
                .filter(GroupStudent.student_id == current_user.id, GroupStudent.group_id == assignment.group_id)
                .first()
                is not None
            )
            if not in_group:
                raise HTTPException(status_code=403, detail="Forbidden")
        else:
            # Teacher/curator/admin
            if current_user.role in ("teacher", "curator") and current_user.id != assignment.teacher_id:
                raise HTTPException(status_code=403, detail="Forbidden")
            target_student_id = student_id

        # 1. Fetch old-style comments (submission notes)
        out = []
        if target_student_id:
            submission = (
                db.query(AssignmentSubmission)
                .filter(AssignmentSubmission.assignment_id == target_id, AssignmentSubmission.student_id == target_student_id)
                .first()
            )
            student_user = db.query(User).filter(User.id == target_student_id).first()
            teacher_comment_author_user = (
                db.query(User).filter(User.id == submission.teacher_comment_author_id).first()
                if submission and submission.teacher_comment_author_id
                else None
            )
            out.extend(
                _assignment_private_thread_entries(
                    assignment,
                    submission,
                    student_user,
                    assignment_teacher_user,
                    teacher_comment_author_user,
                )
            )
        else:
            # Teacher viewing ALL threads (not common for this endpoint but handled)
            rows = (
                db.query(AssignmentSubmission, User)
                .join(User, User.id == AssignmentSubmission.student_id)
                .filter(AssignmentSubmission.assignment_id == target_id)
                .all()
            )
            for submission, student_user in rows:
                teacher_comment_author_user = (
                    db.query(User).filter(User.id == submission.teacher_comment_author_id).first()
                    if submission.teacher_comment_author_id
                    else None
                )
                for entry in _assignment_private_thread_entries(
                    assignment,
                    submission,
                    student_user,
                    assignment_teacher_user,
                    teacher_comment_author_user,
                ):
                    entry["student_id"] = submission.student_id
                    out.append(entry)

        # 2. Fetch new-style comments from AssignmentPrivateComment table
        q = db.query(AssignmentPrivateComment).filter(AssignmentPrivateComment.assignment_id == target_id)
        if target_student_id:
            q = q.filter(AssignmentPrivateComment.student_id == target_student_id)
        
        new_comments = q.all()
        for c in new_comments:
            # Use 1,000,000 offset for IDs to avoid collisions with old simple IDs if needed
            out.append({
                "id": c.id + 1000000,
                "target_type": "assignment",
                "target_id": c.assignment_id,
                "author_role": db.query(User).filter(User.id == c.author_id).first().role if c.author_id else None,
                "author_id": c.author_id,
                "author_name": db.query(User).filter(User.id == c.author_id).first().full_name if c.author_id else None,
                "text": c.text,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "student_id": c.student_id
            })

        out.sort(key=lambda x: x["created_at"] if x["created_at"] else "")
        return out

    # material
    material = db.query(TeacherMaterial).filter(TeacherMaterial.id == target_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if current_user.role == "student":
        allowed = (
            db.query(GroupStudent)
            .filter(GroupStudent.student_id == current_user.id, GroupStudent.group_id == material.group_id)
            .first()
            is not None
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if current_user.role in ("teacher", "curator") and current_user.id != material.teacher_id:
            raise HTTPException(status_code=403, detail="Forbidden")

    rows = (
        db.query(MaterialPrivateComment)
        .filter(MaterialPrivateComment.material_id == target_id)
        .order_by(MaterialPrivateComment.created_at.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "target_type": "material",
            "target_id": target_id,
            "author_role": db.query(User).filter(User.id == r.author_id).first().role if r.author_id else None,
            "author_id": r.author_id,
            "author_name": db.query(User).filter(User.id == r.author_id).first().full_name if r.author_id else None,
            "text": r.text,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("")
def create_private_comment(
    body: PrivateCommentCreateBody = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a private comment:
      - assignment: updates current student's student_private_comment (not teacher grading feedback)
      - material: creates a MaterialPrivateComment row
    """

    if body.target_type == "assignment":
        if current_user.role != "student":
            raise HTTPException(status_code=403, detail="Only students can create assignment private comments")

        assignment = db.query(TeacherAssignment).filter(TeacherAssignment.id == body.target_id).first()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        in_group = (
            db.query(GroupStudent)
            .filter(GroupStudent.student_id == current_user.id, GroupStudent.group_id == assignment.group_id)
            .first()
            is not None
        )
        if not in_group:
            raise HTTPException(status_code=403, detail="Forbidden")

        # Do not require submission to post a comment
        target_student_id = current_user.id
        
        c = AssignmentPrivateComment(
            assignment_id=body.target_id,
            student_id=target_student_id,
            author_id=current_user.id,
            text=body.text,
        )
        db.add(c)
        db.commit()
        db.refresh(c)

        return {"ok": True, "id": c.id}

    # material
    if body.target_type == "material":
        material = db.query(TeacherMaterial).filter(TeacherMaterial.id == body.target_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")

        if current_user.role == "student":
            allowed = (
                db.query(GroupStudent)
                .filter(GroupStudent.student_id == current_user.id, GroupStudent.group_id == material.group_id)
                .first()
                is not None
            )
            if not allowed:
                raise HTTPException(status_code=403, detail="Forbidden")
        else:
            if current_user.role in ("teacher", "curator") and current_user.id != material.teacher_id:
                raise HTTPException(status_code=403, detail="Forbidden")

        c = MaterialPrivateComment(
            material_id=body.target_id,
            author_id=current_user.id,
            text=body.text,
        )
        db.add(c)
        db.commit()
        db.refresh(c)
        return {"ok": True, "id": c.id}

    raise HTTPException(status_code=400, detail="Invalid target_type")

