from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    is_read: bool | None = Query(None),
    limit: int = 50,
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if is_read is not None:
        q = q.filter(Notification.is_read == is_read)
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return [{"id": r.id, "type": r.type, "title": r.title, "message": r.message, "link": r.link, "is_read": r.is_read, "created_at": r.created_at} for r in rows]


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    n.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.get("/unread-count")
def unread_count(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    c = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    return {"count": c}
