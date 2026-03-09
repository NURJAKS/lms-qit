from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from app.models.payment import Payment
from app.schemas.course import CourseResponse, CourseModuleResponse, CourseTopicResponse

router = APIRouter(prefix="/courses", tags=["courses"])


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
):
    """Модули и темы курса (для отображения структуры)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    modules = db.query(CourseModule).filter(CourseModule.course_id == course_id).order_by(CourseModule.order_number).all()
    result = []
    for m in modules:
        topics = db.query(CourseTopic).filter(CourseTopic.module_id == m.id).order_by(CourseTopic.order_number).all()
        result.append({
            "id": m.id,
            "title": m.title,
            "order_number": m.order_number,
            "description": m.description,
            "topics": [
                {"id": t.id, "title": t.title, "order_number": t.order_number, "video_url": t.video_url, "video_duration": t.video_duration}
                for t in topics
            ],
        })
    return {"course_id": course_id, "modules": result}


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
        message=f"Курс «{course.title}» сәтті сатып алынды! Оқуды бастай аласыз.",
        link=f"/app/courses/{course_id}",
    )
    db.add(notif)
    
    # Найти все группы для этого курса и создать задачи для преподавателей
    from app.models.teacher_group import TeacherGroup
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
                    link="/app/teacher?tab=students"
                )
                db.add(teacher_notif)
    
    db.commit()
    db.refresh(enrollment)
    return {"message": "Курс сәтті сатып алынды!", "enrollment_id": enrollment.id}


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
        }
        for e in enrollments
    ]
