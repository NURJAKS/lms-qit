import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.course import Course
from app.models.course_module import CourseModule
from app.models.course_topic import CourseTopic
from app.models.enrollment import CourseEnrollment
from app.models.notification import Notification
from app.models.group_student import GroupStudent
from app.models.teacher_group import TeacherGroup
from app.models.group_teacher import GroupTeacher
from app.models.payment import Payment
from app.models.teacher_assignment import TeacherAssignment
from app.models.study_schedule import StudySchedule
from app.models.course_feed_post import CourseFeedPost
from app.models.assignment_submission import AssignmentSubmission
from app.models.topic_synopsis import TopicSynopsisSubmission
from app.api.course_access import (
    can_view_course_structure_video_urls,
    course_has_groups,
    has_manager_assignment_for_course,
    has_course_group_membership,
    is_student_course_ready_for_content,
)
from app.schemas.course import CourseResponse, CourseModuleResponse, CourseTopicResponse

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseFeedPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    body: str | None = None
    kind: str = "text"
    link_url: str | None = Field(None, max_length=500)
    group_id: int | None = None
    active_until: datetime | None = None
    attachment_urls: list[str] | None = None


def _normalize_feed_attachment_urls(raw: list[str] | None, max_n: int = 12) -> list[str] | None:
    if not raw:
        return None
    out: list[str] = []
    for u in raw[:max_n]:
        s = (u or "").strip()
        if not s or len(s) > 900:
            continue
        if s.startswith("/uploads/") or s.startswith("https://") or s.startswith("http://"):
            out.append(s)
    return out or None


def _feed_attachments_list(post: CourseFeedPost) -> list[str]:
    v = post.attachment_urls
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v if x]
    if isinstance(v, str):
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(x) for x in parsed if x]
        except Exception:
            return []
    return []


def _teacher_can_post_feed(db: Session, user: User, course_id: int, group_id: int | None) -> bool:
    if user.role in ("admin", "director", "curator"):
        return True
    if user.role != "teacher":
        return False
    if group_id is not None:
        g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
        if not g or g.course_id != course_id:
            return False
        if g.teacher_id == user.id:
            return True
        return (
            db.query(GroupTeacher)
            .filter(GroupTeacher.group_id == group_id, GroupTeacher.teacher_id == user.id)
            .first()
            is not None
        )
    groups = db.query(TeacherGroup).filter(TeacherGroup.course_id == course_id).all()
    for g in groups:
        if g.teacher_id == user.id:
            return True
        if (
            db.query(GroupTeacher)
            .filter(GroupTeacher.group_id == g.id, GroupTeacher.teacher_id == user.id)
            .first()
        ):
            return True
    return False


@router.get("", response_model=list[CourseResponse])
def list_courses(
    db: Annotated[Session, Depends(get_db)],
    is_active: bool | None = Query(None, description="True = только активные, False = только неактивные"),
    search: str | None = Query(None, description="Поиск по названию курса"),
):
    q = db.query(Course)
    if is_active is not None:
        q = q.filter(Course.is_active == is_active)
        if is_active:
            now = datetime.now(timezone.utc)
            q = q.filter(or_(Course.published_at.is_(None), Course.published_at <= now))
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(Course.title.ilike(term))
    return q.order_by(Course.id).all()


@router.get("/search")
def search_courses_and_topics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    q: str = Query(..., min_length=1),
):
    """Поиск курсов и тем по названию."""
    term = f"%{q.strip()}%"
    courses = db.query(Course).filter(
        Course.is_active == True,
        Course.title.ilike(term),
    ).order_by(Course.id).limit(10).all()
    topics = (
        db.query(CourseTopic)
        .join(Course, CourseTopic.course_id == Course.id)
        .filter(Course.is_active == True, CourseTopic.title.ilike(term))
        .order_by(CourseTopic.id)
        .limit(10)
        .all()
    )
    return {
        "courses": [{"id": c.id, "title": c.title} for c in courses],
        "topics": [
            {"id": t.id, "title": t.title, "course_id": t.course_id}
            for t in topics
        ],
    }


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return course


@router.get("/{course_id}/topics")
def get_course_topics(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Плоский список тем курса (для формы задания)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    topics = db.query(CourseTopic).filter(CourseTopic.course_id == course_id).order_by(CourseTopic.order_number).all()
    return [{"id": t.id, "title": t.title, "module_id": t.module_id} for t in topics]


@router.get("/{course_id}/structure")
def get_course_structure(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Модули и темы курса (для отображения структуры)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    modules = db.query(CourseModule).filter(CourseModule.course_id == course_id).order_by(CourseModule.order_number).all()
    include_video_urls = can_view_course_structure_video_urls(db, current_user, course)
    result = []
    for m in modules:
        topics = db.query(CourseTopic).filter(CourseTopic.module_id == m.id).order_by(CourseTopic.order_number).all()
        result.append({
            "id": m.id,
            "title": m.title,
            "order_number": m.order_number,
            "description": m.description,
            "topics": [
                {
                    "id": t.id,
                    "title": t.title,
                    "order_number": t.order_number,
                    "video_url": t.video_url if include_video_urls else None,
                    "video_duration": t.video_duration if include_video_urls else None,
                }
                for t in topics
            ],
        })
    return {"course_id": course_id, "modules": result}


@router.get("/{course_id}/classmates")
def list_course_classmates(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Студенты в тех же учебных группах, что и текущий пользователь, для данного курса."""
    my_group_ids = [
        gs.group_id
        for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()
    ]
    if not my_group_ids:
        return []
    groups = (
        db.query(TeacherGroup)
        .filter(TeacherGroup.course_id == course_id, TeacherGroup.id.in_(my_group_ids))
        .all()
    )
    if not groups:
        return []
    group_ids = [g.id for g in groups]
    links = db.query(GroupStudent).filter(GroupStudent.group_id.in_(group_ids)).all()
    student_ids = list({ln.student_id for ln in links})
    if not student_ids:
        return []
    users = db.query(User).filter(User.id.in_(student_ids)).all()
    out = [
        {"id": u.id, "full_name": u.full_name or "", "email": u.email or ""}
        for u in users
    ]
    out.sort(key=lambda x: (x["full_name"] or x["email"]).lower())
    return out


@router.get("/{course_id}/teachers")
def list_course_teachers(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Учителя, которые преподают данный курс текущему студенту."""
    my_group_ids = [
        gs.group_id
        for gs in db.query(GroupStudent).filter(GroupStudent.student_id == current_user.id).all()
    ]
    if not my_group_ids:
        return []
    groups = (
        db.query(TeacherGroup)
        .filter(TeacherGroup.course_id == course_id, TeacherGroup.id.in_(my_group_ids))
        .all()
    )
    if not groups:
        return []
    teacher_ids = list({g.teacher_id for g in groups})
    if not teacher_ids:
        return []
    teachers = db.query(User).filter(User.id.in_(teacher_ids)).all()
    out = [
        {"id": u.id, "full_name": u.full_name or "", "email": u.email or ""}
        for u in teachers
    ]
    out.sort(key=lambda x: (x["full_name"] or x["email"]).lower())
    return out


@router.post("/{course_id}/initiate-payment")
def initiate_payment(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create pending payment for course purchase."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not course.is_active:
        raise HTTPException(status_code=400, detail="Курс пока недоступен для записи.")
    existing = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == current_user.id,
        CourseEnrollment.course_id == course_id,
    ).first()
    if existing:
        return {"message": "Вы уже записаны на этот курс", "enrollment_id": existing.id, "payment_id": None}
    payment = Payment(
        user_id=current_user.id,
        course_id=course_id,
        amount=course.price or 0,
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"payment_id": payment.id, "amount": float(payment.amount), "course_title": course.title}


@router.post("/{course_id}/enroll")
def enroll_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not course.is_active:
        raise HTTPException(status_code=400, detail="Курс пока недоступен для записи.")
    if getattr(course, "is_premium_only", False) and getattr(current_user, "is_premium", 0) != 1:
        raise HTTPException(status_code=403, detail="Курс доступен только для Premium. Оформите подписку.")
    existing = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == current_user.id,
        CourseEnrollment.course_id == course_id,
    ).first()
    if existing:
        return {"message": "Вы уже записаны на этот курс", "enrollment_id": existing.id}
    is_premium_course = getattr(course, "is_premium_only", False)
    payment_amt = Decimal("0") if is_premium_course else (course.price or 0)
    enrollment = CourseEnrollment(
        user_id=current_user.id,
        course_id=course_id,
        payment_confirmed=True,
        payment_amount=payment_amt,
    )
    db.add(enrollment)
    notif = Notification(
        user_id=current_user.id,
        type="course_purchased",
        title="Курс куплен",
        message=f"Оплата за курс «{course.title}» принята. Менеджер/куратор добавит вас в учебную группу в ближайшее время.",
        link=f"/app/courses/{course_id}",
    )
    db.add(notif)
    
    # Найти все группы для этого курса и создать задачи для преподавателей
    from app.models.add_student_task import AddStudentTask

    groups = db.query(TeacherGroup).filter(
        TeacherGroup.course_id == course_id
    ).all()
    
    # Создать задачи для преподавателей
    for group in groups:
        # Проверить, не существует ли уже задача
        existing_task = db.query(AddStudentTask).filter(
            AddStudentTask.student_id == current_user.id,
            AddStudentTask.group_id == group.id,
            AddStudentTask.status == "pending"
        ).first()
        
        if not existing_task:
            # Найти менеджера (admin/director) для создания задачи
            manager = db.query(User).filter(
                User.role.in_(["admin", "director"])
            ).first()
            
            task = AddStudentTask(
                manager_id=manager.id if manager else current_user.id,
                teacher_id=group.teacher_id,
                student_id=current_user.id,
                group_id=group.id,
                status="pending"
            )
            db.add(task)
            
            # Уведомление преподавателю
            teacher = db.query(User).filter(User.id == group.teacher_id).first()
            if teacher:
                teacher_notif = Notification(
                    user_id=group.teacher_id,
                    type="add_student_task",
                    title="Добавьте студента в группу",
                    message=f"Студент {current_user.full_name or current_user.email} оплатил курс «{course.title}». Добавьте его в группу «{group.group_name}».",
                    link="/app/teacher?tab=requests"
                )
                db.add(teacher_notif)
    
    db.commit()
    db.refresh(enrollment)
    return {"message": "Оплата принята. Доступ к материалам откроется после добавления в учебную группу.", "enrollment_id": enrollment.id}


@router.get("/{course_id}/feed")
def get_student_course_feed(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Лента курса для студента: дедлайны, расписание, посты."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    enr = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.user_id == current_user.id,
            CourseEnrollment.course_id == course_id,
        )
        .first()
    )
    if not enr:
        raise HTTPException(status_code=403, detail="Сначала запишитесь на курс.")

    gids = [
        gs.group_id
        for gs in db.query(GroupStudent).join(TeacherGroup, TeacherGroup.id == GroupStudent.group_id).filter(
            GroupStudent.student_id == current_user.id,
            TeacherGroup.course_id == course_id,
        ).all()
    ]

    now = datetime.now(timezone.utc)
    items: list[dict] = []

    if gids:
        assigns = (
            db.query(TeacherAssignment)
            .filter(
                TeacherAssignment.course_id == course_id,
                TeacherAssignment.group_id.in_(gids),
                TeacherAssignment.deadline.isnot(None),
            )
            .order_by(TeacherAssignment.deadline.asc())
            .limit(40)
            .all()
        )
        # Pre-fetch submissions to avoid N+1 overhead
        asg_ids = [a.id for a in assigns]
        subs = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.assignment_id.in_(asg_ids),
                AssignmentSubmission.student_id == current_user.id,
            )
            .all()
        )
        sub_map = {s.assignment_id: s for s in subs}

        for a in assigns:
            dl = a.deadline
            if dl is None:
                continue
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
            sub = sub_map.get(a.id)
            done = sub is not None and sub.grade is not None
            if done:
                continue
            items.append(
                {
                    "kind": "deadline",
                    "id": f"asg-{a.id}",
                    "title": a.title,
                    "body": None,
                    "link": f"/app/courses/{course_id}?tab=classwork&assignmentId={a.id}",
                    "date": dl.isoformat(),
                    "meta": {"assignment_id": a.id},
                }
            )


    today = date.today()
    sched = (
        db.query(StudySchedule)
        .filter(
            StudySchedule.user_id == current_user.id,
            StudySchedule.course_id == course_id,
            StudySchedule.scheduled_date >= today,
        )
        .order_by(StudySchedule.scheduled_date.asc())
        .limit(15)
        .all()
    )
    for r in sched:
        items.append(
            {
                "kind": "schedule",
                "id": f"sch-{r.id}",
                "title": (r.notes or "")[:200] or "Событие в расписании",
                "body": r.notes,
                "link": f"/app/courses/{course_id}",
                "date": str(r.scheduled_date),
                "meta": {"schedule_id": r.id},
            }
        )

    post_q = db.query(CourseFeedPost).filter(CourseFeedPost.course_id == course_id)
    if gids:
        post_q = post_q.filter(
            or_(CourseFeedPost.group_id.is_(None), CourseFeedPost.group_id.in_(gids))
        )
    else:
        post_q = post_q.filter(CourseFeedPost.group_id.is_(None))
    posts = post_q.order_by(CourseFeedPost.created_at.desc()).limit(50).all()
    for p in posts:
        if p.active_until:
            au = p.active_until
            if au.tzinfo is None:
                au = au.replace(tzinfo=timezone.utc)
            if au < now:
                continue
        items.append(
            {
                "kind": "post",
                "post_kind": p.kind,
                "id": f"post-{p.id}",
                "title": p.title,
                "body": p.body,
                "link": p.link_url,
                "attachment_urls": _feed_attachments_list(p),
                "date": p.created_at.isoformat() if p.created_at else None,
                "meta": {"post_id": p.id, "group_id": p.group_id},
            }
        )

    # 4. Недавно проверенные работы (Задания)
    graded_assigns = (
        db.query(AssignmentSubmission)
        .join(TeacherAssignment, TeacherAssignment.id == AssignmentSubmission.assignment_id)
        .filter(
            AssignmentSubmission.student_id == current_user.id,
            TeacherAssignment.course_id == course_id,
            AssignmentSubmission.grade.isnot(None),
        )
        .order_by(AssignmentSubmission.graded_at.desc())
        .limit(10)
        .all()
    )
    for gs in graded_assigns:
        items.append({
            "kind": "graded",
            "id": f"gr-asg-{gs.id}",
            "title": f"Оценено: {gs.assignment.title}",
            "body": f"Ваша работа проверена. Оценка: {gs.grade}",
            "link": f"/app/courses/{course_id}?tab=classwork&assignmentId={gs.assignment_id}",
            "date": gs.graded_at.isoformat() if gs.graded_at else None,
            "meta": {"submission_id": gs.id}
        })

    # 5. Недавно проверенные работы (Конспекты)
    graded_syn = (
        db.query(TopicSynopsisSubmission)
        .join(CourseTopic, CourseTopic.id == TopicSynopsisSubmission.topic_id)
        .filter(
            TopicSynopsisSubmission.user_id == current_user.id,
            CourseTopic.course_id == course_id,
            TopicSynopsisSubmission.grade.isnot(None),
        )
        .order_by(TopicSynopsisSubmission.graded_at.desc())
        .limit(10)
        .all()
    )
    for gs in graded_syn:
        items.append({
            "kind": "graded",
            "id": f"gr-syn-{gs.id}",
            "title": f"Проверено: Конспект ({gs.topic.title})",
            "body": "Ваш конспект проверен учителем.",
            "link": f"/app/courses/{course_id}/topic/{gs.topic_id}",
            "date": gs.graded_at.isoformat() if gs.graded_at else None,
            "meta": {"synopsis_id": gs.id}
        })

    def sort_key(it: dict):
        d = it.get("date") or ""
        return d

    items.sort(key=sort_key)
    return {"items": items}


@router.post("/{course_id}/feed/posts")
def create_course_feed_post(
    course_id: int,
    body: CourseFeedPostCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not _teacher_can_post_feed(db, current_user, course_id, body.group_id):
        raise HTTPException(status_code=403, detail="Нет прав публиковать в ленте этого курса")
    kind = (body.kind or "text").strip().lower()
    if kind not in ("text", "survey", "event", "recommendation"):
        kind = "text"
    if body.group_id is not None:
        g = db.query(TeacherGroup).filter(TeacherGroup.id == body.group_id).first()
        if not g or g.course_id != course_id:
            raise HTTPException(status_code=400, detail="Группа не относится к этому курсу")
    att = _normalize_feed_attachment_urls(body.attachment_urls)
    row = CourseFeedPost(
        author_id=current_user.id,
        course_id=course_id,
        group_id=body.group_id,
        kind=kind,
        title=body.title.strip(),
        body=(body.body or "").strip() or None,
        link_url=(body.link_url or "").strip() or None,
        attachment_urls=att,
        active_until=body.active_until,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "created_at": row.created_at.isoformat() if row.created_at else None}


@router.delete("/{course_id}/feed/posts/{post_id}")
def delete_course_feed_post(
    course_id: int,
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить пост ленты (опрос, событие и т.д.): admin, director, curator, учитель с доступом к курсу/группе."""
    post = (
        db.query(CourseFeedPost)
        .filter(CourseFeedPost.id == post_id, CourseFeedPost.course_id == course_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if not _teacher_can_post_feed(db, current_user, course_id, post.group_id):
        raise HTTPException(status_code=403, detail="Нет прав удалять эту запись")
    db.delete(post)
    db.commit()
    return {"ok": True}


@router.get("/my/enrollments")
def my_enrollments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Оптимизированный запрос с JOIN для загрузки курсов вместе с enrollments
    # Это устраняет N+1 проблему и уменьшает количество запросов к БД с 2 до 1
    enrollments = (
        db.query(CourseEnrollment)
        .options(joinedload(CourseEnrollment.course))
        .filter(CourseEnrollment.user_id == current_user.id)
        .all()
    )
    return [
        {
            "enrollment_id": e.id,
            "course_id": e.course_id,
            "course": e.course,  # Курс уже загружен через joinedload
            "enrolled_at": e.enrolled_at,
            "payment_confirmed": e.payment_confirmed,
            "course_has_groups": course_has_groups(db, e.course_id),
            "manager_assigned": has_manager_assignment_for_course(db, current_user.id, e.course_id),
            "in_course_group": has_course_group_membership(db, current_user.id, e.course_id),
            "ready_for_content": is_student_course_ready_for_content(db, current_user.id, e.course_id),
        }
        for e in enrollments
    ]
