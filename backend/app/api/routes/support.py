import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.database import get_db
from app.models.course import Course
from app.models.notification import Notification
from app.models.support_ticket import SupportTicket
from app.models.user import User

router = APIRouter(prefix="/support", tags=["support"])


class SupportTicketCreate(BaseModel):
    message: str = Field(..., min_length=5, max_length=5000)
    course_id: int | None = None


class SupportTicketUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|resolved)$")
    staff_note: str | None = Field(None, max_length=5000)


@router.post("/tickets")
def create_support_ticket(
    body: SupportTicketCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="errorOnlyStudentsSupport")

    course = None
    if body.course_id is not None:
        course = db.query(Course).filter(Course.id == body.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="courseNotFound")

    ticket = SupportTicket(
        user_id=current_user.id,
        course_id=body.course_id,
        message=body.message.strip(),
        status="open",
    )
    db.add(ticket)
    db.flush()

    staff_users = db.query(User).filter(User.role.in_(("admin", "director", "curator"))).all()
    msg_data = {
        "student_name": current_user.full_name or current_user.email,
        "course_title": course.title if course else None,
        "message_snippet": ticket.message[:180],
    }
    msg_json = json.dumps(msg_data, ensure_ascii=False)

    for staff in staff_users:
        db.add(
            Notification(
                user_id=staff.id,
                type="support_ticket",
                title="notifNewSupportTicketTitle",
                message=msg_json,
                link="/app/admin/support",
                meta=msg_json
            )
        )

    db.commit()
    db.refresh(ticket)
    return {
        "id": ticket.id,
        "status": ticket.status,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
    }


@router.get("/tickets")
def list_support_tickets(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    status: str | None = Query(default=None, pattern="^(open|resolved)$"),
    limit: int = Query(default=50, ge=1, le=200),
):
    query = db.query(SupportTicket).order_by(SupportTicket.created_at.desc(), SupportTicket.id.desc())
    if status:
        query = query.filter(SupportTicket.status == status)
    tickets = query.limit(limit).all()
    user_ids = {t.user_id for t in tickets}
    resolver_ids = {t.resolved_by_id for t in tickets if t.resolved_by_id is not None}
    course_ids = {t.course_id for t in tickets if t.course_id is not None}

    users = {u.id: u for u in db.query(User).filter(User.id.in_(list(user_ids | resolver_ids))).all()} if (user_ids or resolver_ids) else {}
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(list(course_ids))).all()} if course_ids else {}
    return [
        {
            "id": t.id,
            "status": t.status,
            "message": t.message,
            "staff_note": t.staff_note,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
            "student": {
                "id": t.user_id,
                "full_name": (users.get(t.user_id).full_name if users.get(t.user_id) else "") or "",
                "email": (users.get(t.user_id).email if users.get(t.user_id) else "") or "",
            },
            "course": {
                "id": t.course_id,
                "title": courses.get(t.course_id).title if t.course_id and courses.get(t.course_id) else None,
            } if t.course_id else None,
            "resolved_by": {
                "id": t.resolved_by_id,
                "full_name": users.get(t.resolved_by_id).full_name if t.resolved_by_id and users.get(t.resolved_by_id) else "",
                "email": users.get(t.resolved_by_id).email if t.resolved_by_id and users.get(t.resolved_by_id) else "",
            } if t.resolved_by_id else None,
        }
        for t in tickets
    ]


@router.patch("/tickets/{ticket_id}")
def update_support_ticket(
    ticket_id: int,
    body: SupportTicketUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="errorSupportTicketNotFound")

    ticket.status = body.status
    ticket.staff_note = (body.staff_note or "").strip() or None
    if body.status == "resolved":
        ticket.resolved_by_id = current_user.id
        ticket.resolved_at = datetime.now(timezone.utc)
    else:
        ticket.resolved_by_id = None
        ticket.resolved_at = None
    db.commit()
    return {"ok": True}
