"""Shared rules for whether a student may submit to a teacher assignment."""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.teacher_assignment import TeacherAssignment


def is_assignment_submission_closed(a: TeacherAssignment) -> bool:
    """True if the student cannot create a new submission (same rules as teacher _is_assignment_closed)."""
    closed_at = getattr(a, "closed_at", None)
    if closed_at is not None:
        return True
    deadline = getattr(a, "deadline", None)
    if deadline is None:
        return False
    reject = getattr(a, "reject_submissions_after_deadline", True)
    if reject is False:
        return False
    now = datetime.now(timezone.utc)
    dl = deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    return dl < now


def deadline_passed_utc(deadline: datetime | None, now: datetime) -> bool:
    if deadline is None:
        return False
    d = deadline if deadline.tzinfo is not None else deadline.replace(tzinfo=timezone.utc)
    return d < now


def submission_closed_http_detail(a: TeacherAssignment) -> str:
    """Human-readable reason key for HTTP 400 when submission is blocked."""
    if getattr(a, "closed_at", None) is not None:
        return "errorAssignmentClosedTeacher"
    dl = getattr(a, "deadline", None)
    if dl is not None and getattr(a, "reject_submissions_after_deadline", True):
        return "errorAssignmentDeadlinePassed"
    return "errorAssignmentSubmissionUnavailable"


def can_student_see_item(item: any, student_id: int) -> bool:
    """True if target_student_ids is null or contains student_id."""
    raw = getattr(item, "target_student_ids", None)
    if not raw:
        return True
    import json
    try:
        ids = json.loads(raw)
        if not ids:
            return True
        return student_id in ids
    except Exception:
        return True

