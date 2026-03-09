from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.study_schedule import StudySchedule
from app.models.student_goal import StudentGoal
from app.models.enrollment import CourseEnrollment
from app.models.notification import Notification
from app.models.course import Course
from app.models.course_topic import CourseTopic

router = APIRouter(prefix="/schedule", tags=["schedule"])


class ScheduleItemCreate(BaseModel):
    course_id: int | None = None
    topic_id: int | None = None
    scheduled_date: date
    notes: str | None = None


class ScheduleItemUpdate(BaseModel):
    course_id: int | None = None
    topic_id: int | None = None
    scheduled_date: date | None = None
    notes: str | None = None
    is_completed: bool | None = None


class GoalCreate(BaseModel):
    goal_type: str
    description: str | None = None
    target_date: date | None = None


class GoalUpdate(BaseModel):
    is_achieved: bool | None = None


@router.post("/check-reminders")
def check_reminders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create notifications for schedule items today/tomorrow where reminder_sent=False."""
    today = date.today()
    tomorrow = today + timedelta(days=1)
    items = db.query(StudySchedule).filter(
        StudySchedule.user_id == current_user.id,
        StudySchedule.reminder_sent == False,
        StudySchedule.scheduled_date.in_([today, tomorrow]),
    ).all()
    created = 0
    for item in items:
        n = Notification(
            user_id=current_user.id,
            type="schedule_reminder",
            title="Напоминание",
            message=f"Запланировано на {item.scheduled_date}" + (f": {item.notes}" if item.notes else ""),
            link="/app/tasks-calendar",
        )
        db.add(n)
        item.reminder_sent = True
        created += 1
    db.commit()
    return {"created": created}


@router.get("")
def list_schedule(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    from_date: date | None = None,
    to_date: date | None = None,
):
    q = db.query(StudySchedule).filter(StudySchedule.user_id == current_user.id)
    if from_date:
        q = q.filter(StudySchedule.scheduled_date >= from_date)
    if to_date:
        q = q.filter(StudySchedule.scheduled_date <= to_date)
    rows = q.order_by(StudySchedule.scheduled_date).all()
    course_ids = [r.course_id for r in rows if r.course_id]
    topic_ids = [r.topic_id for r in rows if r.topic_id]
    courses = {c.id: c.title for c in db.query(Course).filter(Course.id.in_(course_ids)).all()} if course_ids else {}
    topics = {t.id: t.title for t in db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all()} if topic_ids else {}
    return [
        {
            "id": r.id,
            "course_id": r.course_id,
            "topic_id": r.topic_id,
            "course_title": courses.get(r.course_id) if r.course_id else None,
            "topic_title": topics.get(r.topic_id) if r.topic_id else None,
            "scheduled_date": str(r.scheduled_date),
            "is_completed": r.is_completed,
            "notes": r.notes,
        }
        for r in rows
    ]


@router.post("")
def create_schedule_item(
    body: ScheduleItemCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    is_admin = current_user.role in ("admin", "director", "curator")
    if body.course_id and not is_admin:
        e = db.query(CourseEnrollment).filter(
            CourseEnrollment.user_id == current_user.id,
            CourseEnrollment.course_id == body.course_id,
        ).first()
        if not e:
            raise HTTPException(status_code=403, detail="Сначала запишитесь на курс.")
    item = StudySchedule(
        user_id=current_user.id,
        course_id=body.course_id,
        topic_id=body.topic_id,
        scheduled_date=body.scheduled_date,
        notes=body.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "scheduled_date": str(item.scheduled_date)}


@router.patch("/{item_id}")
def update_schedule_item(
    item_id: int,
    body: ScheduleItemUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    item = db.query(StudySchedule).filter(
        StudySchedule.id == item_id,
        StudySchedule.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    is_admin = current_user.role in ("admin", "director", "curator")
    if body.course_id is not None:
        if body.course_id and not is_admin:
            e = db.query(CourseEnrollment).filter(
                CourseEnrollment.user_id == current_user.id,
                CourseEnrollment.course_id == body.course_id,
            ).first()
            if not e:
                raise HTTPException(status_code=403, detail="Сначала запишитесь на курс.")
        item.course_id = body.course_id
    
    if body.topic_id is not None:
        item.topic_id = body.topic_id
    
    if body.scheduled_date is not None:
        item.scheduled_date = body.scheduled_date
    
    if body.notes is not None:
        item.notes = body.notes
    
    if body.is_completed is not None:
        item.is_completed = body.is_completed
    
    db.commit()
    db.refresh(item)
    return {"id": item.id}


@router.delete("/{item_id}")
def delete_schedule_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    item = db.query(StudySchedule).filter(
        StudySchedule.id == item_id,
        StudySchedule.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.get("/goals")
def list_goals(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    rows = db.query(StudentGoal).filter(StudentGoal.user_id == current_user.id).all()
    return [{"id": r.id, "goal_type": r.goal_type, "description": r.description, "target_date": str(r.target_date) if r.target_date else None, "is_achieved": r.is_achieved} for r in rows]


@router.post("/goals")
def create_goal(
    body: GoalCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    g = StudentGoal(user_id=current_user.id, goal_type=body.goal_type, description=body.description, target_date=body.target_date)
    db.add(g)
    db.commit()
    db.refresh(g)
    return {"id": g.id}


@router.patch("/goals/{goal_id}")
def update_goal(
    goal_id: int,
    body: GoalUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    g = db.query(StudentGoal).filter(
        StudentGoal.id == goal_id,
        StudentGoal.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Цель не найдена")
    if body.is_achieved is not None:
        g.is_achieved = body.is_achieved
    db.commit()
    db.refresh(g)
    return {"id": g.id, "is_achieved": g.is_achieved}
