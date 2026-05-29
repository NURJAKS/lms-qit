"""Activity logging for admin visibility."""
from sqlalchemy.orm import Session

from app.models.activity_log import UserActivityLog


def log_activity(
    db: Session,
    user_id: int | None,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: dict | None = None,
):
    log_activity_no_commit(db, user_id, action, entity_type, entity_id, details)
    db.commit()


def log_activity_no_commit(
    db: Session,
    user_id: int | None,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: dict | None = None,
):
    log = UserActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(log)
