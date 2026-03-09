import re
import secrets
import string
from datetime import datetime, timezone, date
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.course import Course
from app.models.course_application import CourseApplication
from app.models.enrollment import CourseEnrollment
from app.models.notification import Notification
from app.models.payment import Payment
from app.services.email_sender import send_course_purchase_email

router = APIRouter(prefix="/applications", tags=["applications"])


def _generate_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class SubmitApplicationRequest(BaseModel):
    email: EmailStr
    full_name: str
    phone: str = ""
    city: str = ""
    # Доп. данные студента
    student_birth_date: Optional[date] = None
    student_age: Optional[int] = None
    student_iin: str = ""
    course_id: int
    parent_email: str = ""
    parent_full_name: str = ""
    parent_phone: str = ""
    parent_city: str = ""
    # Доп. данные родителя
    parent_birth_date: Optional[date] = None
    parent_age: Optional[int] = None
    parent_iin: str = ""


class SubmitApplicationResponse(BaseModel):
    message: str
    temp_login: str
    temp_password: str
    parent_temp_login: str | None = None
    parent_temp_password: str | None = None


class PayApplicationResponse(BaseModel):
    message: str
    confirmation_token: str
    course_title: str
    student_name: str
    student_email: str


class PayApplicationRequest(BaseModel):
    email: EmailStr
    full_name: str
    phone: str = ""
    city: str = ""
    # Доп. данные студента
    student_birth_date: Optional[date] = None
    student_age: Optional[int] = None
    student_iin: str = ""
    course_id: int
    parent_email: str = ""
    parent_full_name: str = ""
    parent_phone: str = ""
    parent_city: str = ""
    # Доп. данные родителя
    parent_birth_date: Optional[date] = None
    parent_age: Optional[int] = None
    parent_iin: str = ""
    payment_method: Literal[
        "kaspi",
        "halyk",
        "card",
        "eurasian",
        "tinkoff",
        "jusan",
        "forte",
    ] = "card"


@router.post("/pay", response_model=PayApplicationResponse)
def pay_application(
    body: PayApplicationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Публичный эндпоинт: оплата курса без авторизации. MVP: симуляция оплаты.
    Возвращает confirmation_token — студент должен подтвердить покупку по ссылке из email."""
    course = db.query(Course).filter(Course.id == body.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not course.is_active:
        raise HTTPException(status_code=400, detail="Курс пока недоступен для записи.")

    if body.parent_email.strip():
        email_re = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
        if not email_re.match(body.parent_email.strip()):
            raise HTTPException(status_code=400, detail="Некорректный email родителя.")

    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user and getattr(existing_user, "is_approved", True):
        raise HTTPException(
            status_code=400,
            detail="У вас уже есть аккаунт. Войдите в систему и купите курс из личного кабинета.",
        )

    if existing_user:
        user = existing_user
        temp_password = _generate_password()
        user.password_hash = get_password_hash(temp_password)
        if body.city:
            user.address = body.city
        if body.student_birth_date:
            user.birth_date = body.student_birth_date
        user.is_approved = True
        existing_paid = db.query(CourseApplication).filter(
            CourseApplication.user_id == user.id,
            CourseApplication.course_id == body.course_id,
            CourseApplication.status == "paid",
        ).first()
        if existing_paid:
            raise HTTPException(status_code=400, detail="Вы уже оплатили этот курс.")
    else:
        temp_password = _generate_password()
        user = User(
            email=body.email,
            password_hash=get_password_hash(temp_password),
            full_name=body.full_name,
            role="student",
            phone=body.phone or None,
            address=body.city or None,
            birth_date=body.student_birth_date,
            is_approved=True,
        )
        db.add(user)
        db.flush()

    parent_user: User | None = None

    if body.parent_email.strip():
        if body.parent_email.lower() != body.email.lower():
            existing_parent = db.query(User).filter(User.email == body.parent_email).first()
            if existing_parent:
                if existing_parent.role == "parent":
                    parent_user = existing_parent
                    parent_temp_password = _generate_password()
                    parent_user.password_hash = get_password_hash(parent_temp_password)
                    parent_user.full_name = body.parent_full_name or parent_user.full_name
                    parent_user.phone = body.parent_phone or parent_user.phone
                    parent_user.address = body.parent_city or parent_user.address
                else:
                    parent_user = existing_parent if existing_parent.role == "parent" else None
            else:
                parent_temp_password = _generate_password()
                parent_user = User(
                    email=body.parent_email,
                    password_hash=get_password_hash(parent_temp_password),
                    full_name=body.parent_full_name or "Родитель",
                    role="parent",
                    phone=body.parent_phone or None,
                    address=body.parent_city or None,
                    is_approved=True,
                )
                db.add(parent_user)
                db.flush()

    if parent_user:
        user.parent_id = parent_user.id

    confirmation_token = secrets.token_urlsafe(48)

    app = CourseApplication(
        user_id=user.id,
        course_id=body.course_id,
        status="pending_confirmation",
        email=body.email,
        full_name=body.full_name,
        phone=body.phone or None,
        city=body.city or None,
        student_birth_date=body.student_birth_date,
        student_age=body.student_age,
        student_iin=body.student_iin or None,
        parent_email=body.parent_email or None,
        parent_full_name=body.parent_full_name or None,
        parent_phone=body.parent_phone or None,
        parent_city=body.parent_city or None,
        parent_birth_date=body.parent_birth_date,
        parent_age=body.parent_age,
        parent_iin=body.parent_iin or None,
        confirmation_token=confirmation_token,
    )
    db.add(app)
    db.flush()

    amount = float(course.price or 0)
    payment = Payment(
        user_id=user.id,
        course_id=body.course_id,
        amount=amount,
        status="pending_confirmation",
        payment_method=body.payment_method,
        application_id=app.id,
    )
    db.add(payment)

    managers = db.query(User).filter(User.role.in_(["admin", "director", "curator"])).all()
    for m in managers:
        n = Notification(
            user_id=m.id,
            type="new_application",
            title="Студент оплатил курс (ожидает подтверждения)",
            message=f"{body.full_name} ({body.email}) оплатил курс «{course.title}». Ожидает подтверждения по email.",
            link="/app/admin/applications",
        )
        db.add(n)

    db.commit()

    return PayApplicationResponse(
        message="Оплата принята. Подтвердите покупку по ссылке, отправленной на ваш email.",
        confirmation_token=confirmation_token,
        course_title=course.title,
        student_name=body.full_name,
        student_email=body.email,
    )


class ConfirmPurchaseResponse(BaseModel):
    message: str
    temp_login: str
    temp_password: str
    parent_temp_login: str | None = None
    parent_temp_password: str | None = None
    course_title: str
    student_name: str


@router.get("/confirm/{token}", response_model=ConfirmPurchaseResponse)
def confirm_purchase(
    token: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Публичный эндпоинт: студент подтверждает покупку по ссылке из email."""
    app = db.query(CourseApplication).filter(
        CourseApplication.confirmation_token == token,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Ссылка для подтверждения недействительна.")

    if app.confirmed_at is not None:
        user = db.query(User).filter(User.id == app.user_id).first()
        course = db.query(Course).filter(Course.id == app.course_id).first()
        parent_user = db.query(User).filter(User.id == user.parent_id).first() if user and user.parent_id else None
        raise HTTPException(
            status_code=400,
            detail="Покупка уже подтверждена. Войдите в систему с логином и паролем из письма.",
        )

    user = db.query(User).filter(User.id == app.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")
    course = db.query(Course).filter(Course.id == app.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден.")

    temp_password = _generate_password()
    user.password_hash = get_password_hash(temp_password)

    app.status = "paid"
    app.confirmed_at = datetime.now(timezone.utc)

    payment = db.query(Payment).filter(
        Payment.application_id == app.id,
    ).first()
    if payment:
        payment.status = "completed"

    amount = float(course.price or 0)
    existing_enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == user.id,
        CourseEnrollment.course_id == app.course_id,
    ).first()
    if not existing_enrollment:
        enrollment = CourseEnrollment(
            user_id=user.id,
            course_id=app.course_id,
            payment_confirmed=True,
            payment_amount=amount,
        )
        db.add(enrollment)

    parent_temp_login: str | None = None
    parent_temp_password: str | None = None
    parent_user = db.query(User).filter(User.id == user.parent_id).first() if user.parent_id else None
    if parent_user and parent_user.role == "parent":
        parent_temp_password = _generate_password()
        parent_user.password_hash = get_password_hash(parent_temp_password)
        parent_temp_login = parent_user.email

    db.commit()

    try:
        # Get user language preference (default to 'ru' if not set)
        user_lang = getattr(user, "language", "ru") or "ru"
        if user_lang not in ["ru", "kk", "en"]:
            user_lang = "ru"
        send_course_purchase_email(
            to_email=user.email,
            student_name=user.full_name,
            course_title=course.title,
            temp_login=user.email,
            temp_password=temp_password,
            lang=user_lang,
        )
    except Exception:
        pass

    return ConfirmPurchaseResponse(
        message="Поздравляем! Вы добавлены на курс. Удачи в обучении!",
        temp_login=user.email,
        temp_password=temp_password,
        parent_temp_login=parent_temp_login,
        parent_temp_password=parent_temp_password,
        course_title=course.title,
        student_name=user.full_name,
    )


@router.post("/submit", response_model=SubmitApplicationResponse)
def submit_application(
    body: SubmitApplicationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Публичный эндпоинт: заявка на покупку курса без авторизации."""
    course = db.query(Course).filter(Course.id == body.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if not course.is_active:
        raise HTTPException(status_code=400, detail="Курс пока недоступен для записи.")

    if body.parent_email.strip():
        email_re = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
        if not email_re.match(body.parent_email.strip()):
            raise HTTPException(status_code=400, detail="Некорректный email родителя.")

    existing_user = db.query(User).filter(User.email == body.email).first()

    if existing_user and getattr(existing_user, "is_approved", True):
        raise HTTPException(
            status_code=400,
            detail="У вас уже есть аккаунт. Войдите в систему и купите курс из личного кабинета.",
        )

    if existing_user:
        user = existing_user
        temp_password = _generate_password()
        user.password_hash = get_password_hash(temp_password)
        if body.city:
            user.address = body.city
        existing_app = db.query(CourseApplication).filter(
            CourseApplication.user_id == user.id,
            CourseApplication.course_id == body.course_id,
            CourseApplication.status == "pending",
        ).first()
        if existing_app:
            raise HTTPException(status_code=400, detail="Заявка на этот курс уже отправлена.")
    else:
        temp_password = _generate_password()
        user = User(
            email=body.email,
            password_hash=get_password_hash(temp_password),
            full_name=body.full_name,
            role="student",
            phone=body.phone or None,
            address=body.city or None,
            is_approved=False,
        )
        db.add(user)
        db.flush()

    # Find or create parent user
    parent_temp_login: str | None = None
    parent_temp_password: str | None = None
    parent_user: User | None = None

    if body.parent_email.strip():
        # Skip creating parent if same as student email
        if body.parent_email.lower() != body.email.lower():
            existing_parent = db.query(User).filter(User.email == body.parent_email).first()
            if existing_parent:
                if existing_parent.role == "parent":
                    parent_user = existing_parent
                    parent_temp_password = _generate_password()
                    parent_user.password_hash = get_password_hash(parent_temp_password)
                    parent_user.full_name = body.parent_full_name or parent_user.full_name
                    parent_user.phone = body.parent_phone or parent_user.phone
                    parent_user.address = body.parent_city or parent_user.address
                    parent_temp_login = parent_user.email
                else:
                    # Email belongs to non-parent user; don't create parent, just link if they're parent
                    parent_user = existing_parent if existing_parent.role == "parent" else None
            else:
                parent_temp_password = _generate_password()
                parent_user = User(
                    email=body.parent_email,
                    password_hash=get_password_hash(parent_temp_password),
                    full_name=body.parent_full_name or "Родитель",
                    role="parent",
                    phone=body.parent_phone or None,
                    address=body.parent_city or None,
                    is_approved=True,
                )
                db.add(parent_user)
                db.flush()
                parent_temp_login = parent_user.email

    if parent_user:
        user.parent_id = parent_user.id

    app = CourseApplication(
        user_id=user.id,
        course_id=body.course_id,
        status="pending",
        email=body.email,
        full_name=body.full_name,
        phone=body.phone or None,
        city=body.city or None,
        student_birth_date=body.student_birth_date,
        student_age=body.student_age,
        student_iin=body.student_iin or None,
        parent_email=body.parent_email or None,
        parent_full_name=body.parent_full_name or None,
        parent_phone=body.parent_phone or None,
        parent_city=body.parent_city or None,
        parent_birth_date=body.parent_birth_date,
        parent_age=body.parent_age,
        parent_iin=body.parent_iin or None,
    )
    db.add(app)

    # Уведомляем менеджеров (admin, director, curator)
    managers = db.query(User).filter(User.role.in_(["admin", "director", "curator"])).all()
    for m in managers:
        n = Notification(
            user_id=m.id,
            type="new_application",
            title="Новая заявка на курс",
            message=f"от {body.full_name} ({body.email}) на курс «{course.title}»",
            link="/app/admin/applications",
        )
        db.add(n)

    db.commit()
    db.refresh(app)

    return SubmitApplicationResponse(
        message="Менеджер свяжется с вами.",
        temp_login=body.email,
        temp_password=temp_password,
        parent_temp_login=parent_temp_login,
        parent_temp_password=parent_temp_password,
    )
