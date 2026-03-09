import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.payment import Payment
from app.models.course import Course
from app.models.enrollment import CourseEnrollment
from app.models.notification import Notification
from app.models.teacher_group import TeacherGroup
from app.models.add_student_task import AddStudentTask

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/my/pending")
def list_my_pending_payments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Список ожидающих оплаты для текущего пользователя (из одобренных заявок)."""
    rows = db.query(Payment).filter(
        Payment.user_id == current_user.id,
        Payment.status == "pending",
    ).all()
    course_ids = [r.course_id for r in rows]
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    return [
        {
            "id": r.id,
            "course_id": r.course_id,
            "course_title": getattr(courses.get(r.course_id), "title", None),
            "amount": float(r.amount),
        }
        for r in rows
    ]


@router.post("/{payment_id}/confirm")
def confirm_payment(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Simulate payment success: set completed, create enrollment."""
    payment = db.query(Payment).filter(Payment.id == payment_id, Payment.user_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    if payment.status != "pending":
        raise HTTPException(status_code=400, detail="Платёж уже обработан")
    course = db.query(Course).filter(Course.id == payment.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    existing = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == current_user.id,
        CourseEnrollment.course_id == payment.course_id,
    ).first()
    if existing:
        payment.status = "completed"
        db.commit()
        return {
            "message": "Вы уже записаны на этот курс",
            "enrollment_id": existing.id,
            "payment_id": payment.id,
            "transaction_id": f"TXN-{payment.id:08d}",
        }
    payment.status = "completed"
    enrollment = CourseEnrollment(
        user_id=current_user.id,
        course_id=payment.course_id,
        payment_confirmed=True,
        payment_amount=payment.amount,
    )
    db.add(enrollment)
    
    # Уведомление студенту
    notif = Notification(
        user_id=current_user.id,
        type="course_purchased",
        title="Курс куплен",
        message=f"Курс «{course.title}» сәтті сатып алынды! Оқуды бастай аласыз.",
        link=f"/app/courses/{payment.course_id}",
    )
    db.add(notif)
    
    # Найти все группы для этого курса и создать задачи для преподавателей
    groups = db.query(TeacherGroup).filter(
        TeacherGroup.course_id == payment.course_id
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
    return {
        "message": "Курс сәтті сатып алынды!",
        "enrollment_id": enrollment.id,
        "payment_id": payment.id,
        "transaction_id": f"TXN-{payment.id:08d}",
        "amount": float(payment.amount),
        "course_title": course.title,
    }
