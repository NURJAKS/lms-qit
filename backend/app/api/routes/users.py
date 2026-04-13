from datetime import date, datetime, timedelta, timezone
import json
import logging
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.activity_log import UserActivityLog
from app.models.certificate import Certificate
from app.models.coin_transaction_log import CoinTransactionLog
from app.models.course import Course
from app.models.course_topic import CourseTopic
from app.models.enrollment import CourseEnrollment
from app.models.progress import StudentProgress
from app.models.user import User
from app.models.student_profile import StudentProfile
from app.schemas.student_profile import StudentProfileMergedResponse, StudentProfileUpdate
from app.models.teacher_group import TeacherGroup
from app.models.group_student import GroupStudent
from app.api.course_access import has_any_ready_course_access
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

_GENDERS = ["Мужской", "Женский", "Другое"]
_KINSHIP_DEGREES = ["Отец", "Мать", "Опекун", "Другое"]
_EDU_PROCESS_ROLES = ["Законный представитель", "Опекун"]


class ParentLinkRequest(BaseModel):
    student_id: int


def _ensure_parent_profile_fields(db: Session, user: User) -> bool:
    """
    Fill missing parent personal fields with fake values.
    Returns True if any field was updated.
    """
    if user.role != "parent":
        return False

    changed = False

    if not user.birth_date:
        # 30-55 y.o. deterministic-ish by user.id
        base = date(1985, 6, 15)
        delta_days = (user.id * 137) % (25 * 365)
        user.birth_date = base.replace(year=base.year - (delta_days // 365))
        changed = True

    if not getattr(user, "gender", None):
        user.gender = _GENDERS[user.id % len(_GENDERS)]
        changed = True

    if not getattr(user, "identity_card", None):
        user.identity_card = f"KZ{(user.id * 1000007) % 10_000_000:07d}"
        changed = True

    if not user.phone:
        user.phone = f"+7 701 {(user.id * 37) % 900:03d} {(user.id * 91) % 9000:04d}"
        changed = True

    if not user.address:
        user.address = f"г. Алматы, ул. Абая, д. {(user.id % 120) + 1}, кв. {(user.id % 80) + 1}"
        changed = True

    if not getattr(user, "email_work", None):
        local = f"parent{user.id}"
        user.email_work = f"{local}@company.kz"
        changed = True

    if not getattr(user, "phone_work", None):
        user.phone_work = f"+7 727 {(user.id * 53) % 900:03d} {(user.id * 19) % 9000:04d}"
        changed = True

    if not getattr(user, "work_place", None):
        workplaces = ["Qazaq IT Academy", "KazTech Group", "Almaty Logistics", "EduSoft KZ", "Baiterek Service"]
        user.work_place = workplaces[user.id % len(workplaces)]
        changed = True

    if not getattr(user, "position", None):
        positions = ["Менеджер", "Инженер", "Бухгалтер", "HR специалист", "Руководитель отдела"]
        user.position = positions[user.id % len(positions)]
        changed = True

    if not getattr(user, "kinship_degree", None):
        user.kinship_degree = _KINSHIP_DEGREES[user.id % len(_KINSHIP_DEGREES)]
        changed = True

    if not getattr(user, "educational_process_role", None):
        user.educational_process_role = _EDU_PROCESS_ROLES[user.id % len(_EDU_PROCESS_ROLES)]
        changed = True

    # Default user status if missing.
    # This prevents profile preview showing "--" for parents.
    if getattr(user, "status", None) is None:
        user.status = "Активный"
        changed = True

    return changed



def _get_last_login_dt(db: Session, user_id: int):
    row = (
        db.query(UserActivityLog)
        .filter(UserActivityLog.user_id == user_id, UserActivityLog.action == "login")
        .order_by(UserActivityLog.created_at.desc())
        .first()
    )
    return row.created_at if row else None


def _ensure_student_profile(db: Session, user: User) -> StudentProfile | None:
    sp = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if sp:
        if sp.status in (None, "", "Отчислен"):
            sp.status = "Активный"
            db.commit()
            db.refresh(sp)
    return sp


def _ensure_admin_profile_fields(db: Session, user: User) -> None:
    """Ensure admin profile fields are normalized (no fake generation)."""
    if user.role not in ("admin", "director"):
        return

    dirty = False
    if getattr(user, "status", None) is None:
        user.status = "Активный"
        dirty = True
    
    if dirty:
        db.commit()
        db.refresh(user)


def _ensure_curator_profile_fields(db: Session, user: User) -> None:
    """Ensure curator profile fields are normalized."""
    if user.role != "teacher":
        return

    dirty = False
    if getattr(user, "status", None) is None:
        user.status = "Активный"
        dirty = True

    if dirty:
        db.commit()
        db.refresh(user)


@router.get("/me/student-profile", response_model=StudentProfileMergedResponse)
def get_my_student_profile(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Доступно только для студентов")
    sp = _ensure_student_profile(db, current_user)
    last_login = _get_last_login_dt(db, current_user.id)
    return StudentProfileMergedResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        photo_url=current_user.photo_url,
        phone=current_user.phone,
        birth_date=current_user.birth_date,
        address=current_user.address,
        city=current_user.city,
        created_at=current_user.created_at,
        gender=sp.gender,
        nationality=sp.nationality,
        identity_card=sp.identity_card,
        iin=sp.iin,
        phone_alternative=sp.phone_alternative,
        postal_code=sp.postal_code,
        country=sp.country,
        student_id_card_number=sp.student_id_card_number,
        specialty=sp.specialty,
        course=sp.course,
        group=sp.group,
        study_form=sp.study_form,
        admission_date=sp.admission_date,
        graduation_date_planned=sp.graduation_date_planned,
        status=sp.status,
        interface_language=sp.interface_language,
        timezone=sp.timezone,
        last_login=last_login,
    )


@router.patch("/me/student-profile", response_model=StudentProfileMergedResponse)
def update_my_student_profile(
    data: StudentProfileUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Доступно только для студентов")
    sp = _ensure_student_profile(db, current_user)
    patch = data.model_dump(exclude_unset=True)
    if "status" in patch:
        patch["status"] = "Активный"
    for k, v in patch.items():
        if hasattr(sp, k):
            setattr(sp, k, v)
    db.commit()
    db.refresh(sp)
    last_login = _get_last_login_dt(db, current_user.id)
    return StudentProfileMergedResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        photo_url=current_user.photo_url,
        phone=current_user.phone,
        birth_date=current_user.birth_date,
        address=current_user.address,
        city=current_user.city,
        created_at=current_user.created_at,
        gender=sp.gender,
        nationality=sp.nationality,
        identity_card=sp.identity_card,
        iin=sp.iin,
        phone_alternative=sp.phone_alternative,
        postal_code=sp.postal_code,
        country=sp.country,
        student_id_card_number=sp.student_id_card_number,
        specialty=sp.specialty,
        course=sp.course,
        group=sp.group,
        study_form=sp.study_form,
        admission_date=sp.admission_date,
        graduation_date_planned=sp.graduation_date_planned,
        status=sp.status,
        interface_language=sp.interface_language,
        timezone=sp.timezone,
        last_login=last_login,
    )

@router.get("/me", response_model=UserResponse)
def get_me(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    data = UserResponse.model_validate(current_user).model_dump()
    if current_user.role == "student":
        data["has_group_access"] = has_any_ready_course_access(db, current_user.id)
    else:
        data["has_group_access"] = True
    return data


@router.post("/me/photo", response_model=UserResponse)
async def upload_photo(
    file: Annotated[UploadFile, File()],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Accept multipart image file, save to uploads/avatars/{user_id}.{ext}, update user.photo_url."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Только изображения: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}",
        )
    # Используем тот же путь, что и main.py (backend/uploads)
    uploads_base = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    avatars_dir = uploads_base / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    dest = avatars_dir / f"{current_user.id}{ext}"
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 5MB)")
    dest.write_bytes(content)
    photo_url = f"/uploads/avatars/{current_user.id}{ext}"
    current_user.photo_url = photo_url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.photo_url is not None:
        current_user.photo_url = data.photo_url
    if data.description is not None:
        current_user.description = data.description
    if data.phone is not None:
        current_user.phone = data.phone
    if data.birth_date is not None:
        current_user.birth_date = data.birth_date
    if data.city is not None:
        current_user.city = data.city
    if data.address is not None:
        current_user.address = data.address
    # Teacher profile fields (optional; stored on users)
    if getattr(data, "gender", None) is not None:
        current_user.gender = data.gender
    if getattr(data, "identity_card", None) is not None:
        current_user.identity_card = data.identity_card
    if getattr(data, "iin", None) is not None:
        current_user.iin = data.iin
    # Curator profile fields (teacher role)
    if getattr(data, "curated_courses", None) is not None:
        current_user.curated_courses = data.curated_courses
    if getattr(data, "consultation_schedule", None) is not None:
        current_user.consultation_schedule = data.consultation_schedule
    if getattr(data, "consultation_location", None) is not None:
        current_user.consultation_location = data.consultation_location
    if getattr(data, "can_view_performance", None) is not None:
        current_user.can_view_performance = data.can_view_performance
    if getattr(data, "can_message_students", None) is not None:
        current_user.can_message_students = data.can_message_students
    if getattr(data, "can_view_attendance", None) is not None:
        current_user.can_view_attendance = data.can_view_attendance
    if getattr(data, "can_call_parent_teacher_meetings", None) is not None:
        current_user.can_call_parent_teacher_meetings = data.can_call_parent_teacher_meetings
    if getattr(data, "can_create_group_announcements", None) is not None:
        current_user.can_create_group_announcements = data.can_create_group_announcements
    # Parent profile fields (optional; stored on users)
    if getattr(data, "work_place", None) is not None:
        current_user.work_place = data.work_place
    if getattr(data, "kinship_degree", None) is not None:
        current_user.kinship_degree = data.kinship_degree
    if getattr(data, "educational_process_role", None) is not None:
        current_user.educational_process_role = data.educational_process_role
    if getattr(data, "education", None) is not None:
        current_user.education = data.education
    if getattr(data, "academic_degree", None) is not None:
        current_user.academic_degree = data.academic_degree
    if getattr(data, "email_work", None) is not None:
        current_user.email_work = data.email_work
    if getattr(data, "phone_work", None) is not None:
        current_user.phone_work = data.phone_work
    if getattr(data, "office", None) is not None:
        current_user.office = data.office
    if getattr(data, "reception_hours", None) is not None:
        current_user.reception_hours = data.reception_hours
    if getattr(data, "employee_number", None) is not None:
        current_user.employee_number = data.employee_number
    if getattr(data, "position", None) is not None:
        current_user.position = data.position
    if getattr(data, "department", None) is not None:
        current_user.department = data.department
    if getattr(data, "hire_date", None) is not None:
        current_user.hire_date = data.hire_date
    if getattr(data, "employment_status", None) is not None:
        current_user.employment_status = data.employment_status
    if getattr(data, "academic_interests", None) is not None:
        current_user.academic_interests = data.academic_interests
    if getattr(data, "teaching_hours", None) is not None:
        current_user.teaching_hours = data.teaching_hours
    if getattr(data, "subjects_taught", None) is not None:
        current_user.subjects_taught = data.subjects_taught
    if getattr(data, "student_counts", None) is not None:
        current_user.student_counts = data.student_counts
    if getattr(data, "status", None) is not None:
        current_user.status = data.status
    if getattr(data, "interface_language", None) is not None:
        current_user.interface_language = data.interface_language
    if data.password is not None and data.password.strip():
        current_user.password_hash = get_password_hash(data.password)
    # Admin profile fields (optional; stored on users)
    if getattr(data, "education_level", None) is not None:
        current_user.education_level = data.education_level
    if getattr(data, "email_personal", None) is not None:
        current_user.email_personal = data.email_personal
    if getattr(data, "system_role", None) is not None:
        current_user.system_role = data.system_role
    if getattr(data, "permissions", None) is not None:
        current_user.permissions = data.permissions
    if getattr(data, "areas_of_responsibility", None) is not None:
        current_user.areas_of_responsibility = data.areas_of_responsibility
    if getattr(data, "can_create_users", None) is not None:
        current_user.can_create_users = data.can_create_users
    if getattr(data, "can_delete_users", None) is not None:
        current_user.can_delete_users = data.can_delete_users
    if getattr(data, "can_edit_courses", None) is not None:
        current_user.can_edit_courses = data.can_edit_courses
    if getattr(data, "can_view_analytics", None) is not None:
        current_user.can_view_analytics = data.can_view_analytics
    if getattr(data, "can_configure_system", None) is not None:
        current_user.can_configure_system = data.can_configure_system
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/parent-link")
def link_parent_to_student(
    payload: ParentLinkRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Link current parent account to a student by student_id.
    Supports multiple children per parent.
    """
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Доступно только для родителей")
    student_id = payload.student_id
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")

    if student.parent_id == current_user.id:
        return {"ok": True, "student_id": student_id, "message": "Студент уже привязан"}

    if student.parent_id is not None:
        raise HTTPException(status_code=400, detail="У этого студента уже есть привязанный родитель")

    student.parent_id = current_user.id
    db.commit()
    return {"ok": True, "student_id": student_id}


CERTIFICATE_IMAGE_URL = "/uploads/certificates/certification-template.png"


def _certificate_display_url(url: str | None) -> str | None:
    """Используем изображение вместо PDF для сертификатов."""
    if not url:
        return None
    if ".pdf" in url.lower():
        return CERTIFICATE_IMAGE_URL
    return url


@router.get("/me/certificates")
def get_my_certificates(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    is_premium = getattr(current_user, "is_premium", 0) == 1
    certs = db.query(Certificate).filter(Certificate.user_id == current_user.id).all()
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_([c.course_id for c in certs])).all()}
    out = []
    for c in certs:
        course = courses.get(c.course_id)
        out.append({
            "id": c.id,
            "course_id": c.course_id,
            "course_title": course.title if course else "",
            "certificate_url": _certificate_display_url(c.certificate_url),
            "final_score": float(c.final_score) if c.final_score else None,
            "issued_at": (c.issued_at.isoformat() if hasattr(c.issued_at, "isoformat") else c.issued_at) if c.issued_at else None,
            "can_download_pdf": is_premium,  # PDF экспорт только для Premium
        })
    return out


@router.get("/me/certificates/{cert_id}/pdf")
def download_certificate_pdf(
    cert_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Скачать сертификат в формате PDF (только для Premium пользователей)."""
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    is_premium = getattr(current_user, "is_premium", 0) == 1
    if not is_premium:
        raise HTTPException(
            status_code=403,
            detail="PDF экспорт сертификатов доступен только для Premium пользователей. Оформите подписку."
        )
    
    cert = db.query(Certificate).filter(
        Certificate.id == cert_id,
        Certificate.user_id == current_user.id,
    ).first()
    
    if not cert:
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    
    course = db.query(Course).filter(Course.id == cert.course_id).first()
    course_title = course.title if course else "Курс"
    user_name = current_user.full_name or current_user.email
    
    # Если есть оригинальный PDF URL и это локальный файл, пытаемся его вернуть
    if cert.certificate_url and cert.certificate_url.lower().endswith(".pdf"):
        # Проверяем, является ли это локальным путем
        if cert.certificate_url.startswith("/uploads/"):
            pdf_path = Path(__file__).resolve().parent.parent.parent / cert.certificate_url.lstrip("/")
            if pdf_path.exists() and pdf_path.is_file():
                with open(pdf_path, "rb") as f:
                    pdf_content = f.read()
                return Response(
                    content=pdf_content,
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f'attachment; filename="certificate_{cert_id}.pdf"'
                    }
                )
    
    # Генерируем PDF используя reportlab
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Фон (светло-серый)
    p.setFillColor(colors.HexColor("#F5F5F5"))
    p.rect(0, 0, width, height, fill=1)
    
    # Рамка
    p.setStrokeColor(colors.HexColor("#2C3E50"))
    p.setLineWidth(3)
    margin = 2 * cm
    p.rect(margin, margin, width - 2 * margin, height - 2 * margin, fill=0)
    
    # Заголовок
    p.setFillColor(colors.HexColor("#2C3E50"))
    p.setFont("Helvetica-Bold", 36)
    title_text = "СЕРТИФИКАТ"
    title_width = p.stringWidth(title_text, "Helvetica-Bold", 36)
    p.drawString((width - title_width) / 2, height - 5 * cm, title_text)
    
    # Текст о завершении курса
    p.setFont("Helvetica", 18)
    completion_text = f"Настоящим подтверждается, что"
    completion_width = p.stringWidth(completion_text, "Helvetica", 18)
    p.drawString((width - completion_width) / 2, height - 8 * cm, completion_text)
    
    # Имя пользователя
    p.setFont("Helvetica-Bold", 24)
    name_text = user_name
    name_width = p.stringWidth(name_text, "Helvetica-Bold", 24)
    p.drawString((width - name_width) / 2, height - 10 * cm, name_text)
    
    # Текст о курсе
    p.setFont("Helvetica", 18)
    course_text = f"успешно завершил(а) курс"
    course_width = p.stringWidth(course_text, "Helvetica", 18)
    p.drawString((width - course_width) / 2, height - 12 * cm, course_text)
    
    # Название курса
    p.setFont("Helvetica-Bold", 22)
    course_title_width = p.stringWidth(course_title, "Helvetica-Bold", 22)
    # Если название слишком длинное, разбиваем на строки
    if course_title_width > width - 4 * margin:
        words = course_title.split()
        lines = []
        current_line = []
        for word in words:
            test_line = " ".join(current_line + [word])
            if p.stringWidth(test_line, "Helvetica-Bold", 22) <= width - 4 * margin:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
        if current_line:
            lines.append(" ".join(current_line))
        
        y_pos = height - 13.5 * cm
        for line in lines:
            line_width = p.stringWidth(line, "Helvetica-Bold", 22)
            p.drawString((width - line_width) / 2, y_pos, line)
            y_pos -= 1.2 * cm
    else:
        p.drawString((width - course_title_width) / 2, height - 13.5 * cm, course_title)
    
    # Оценка (если есть)
    if cert.final_score:
        p.setFont("Helvetica", 16)
        score_text = f"Финальная оценка: {float(cert.final_score):.1f}%"
        score_width = p.stringWidth(score_text, "Helvetica", 16)
        p.drawString((width - score_width) / 2, height - 16 * cm, score_text)
    
    # Дата выдачи
    p.setFont("Helvetica", 14)
    issued_date = cert.issued_at.strftime("%d.%m.%Y") if cert.issued_at else datetime.now().strftime("%d.%m.%Y")
    date_text = f"Дата выдачи: {issued_date}"
    date_width = p.stringWidth(date_text, "Helvetica", 14)
    p.drawString((width - date_width) / 2, 4 * cm, date_text)
    
    # ID сертификата
    p.setFont("Helvetica", 10)
    cert_id_text = f"ID сертификата: {cert_id}"
    p.drawString(margin + 0.5 * cm, margin + 0.5 * cm, cert_id_text)
    
    p.showPage()
    p.save()
    buffer.seek(0)
    pdf_content = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="certificate_{cert_id}.pdf"'
        }
    )


@router.get("/me/progress-detail")
def get_my_progress_detail(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Детальный прогресс по каждому курсу для профиля."""
    return _build_progress_detail(db, current_user.id)


def _get_active_dates(db: Session, user_id: int, days: int = 60) -> set[date]:
    """Returns set of dates when user had activity (progress completion or login)."""
    today = date.today()
    start = today - timedelta(days=days)
    active = set[date]()

    # From StudentProgress: completed_at or created_at (when is_completed)
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.is_completed == True,
    ).all()
    for p in progress_rows:
        dt = p.completed_at or p.created_at
        if dt and dt.date() >= start:
            active.add(dt.date())

    # From UserActivityLog (login, etc.)
    logs = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == user_id,
        UserActivityLog.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
    ).all()
    for log in logs:
        if log.created_at:
            active.add(log.created_at.date())

    return active


@router.get("/me/streak")
def get_my_streak(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Learning streak: consecutive days with activity (counting backwards from today)."""
    active_dates = _get_active_dates(db, current_user.id, days=365)
    today = date.today()
    streak = 0
    d = today
    while d in active_dates:
        streak += 1
        d -= timedelta(days=1)
    return {"streak": streak}


@router.get("/me/activity-heatmap")
def get_my_activity_heatmap(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = Query(14, ge=7, le=90),
):
    """Activity heatmap: per-day activity count for last N days."""
    today = date.today()
    start = today - timedelta(days=days)
    out: list[dict] = []

    # Aggregate by date: progress completions + video seconds
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
    ).all()

    day_data: dict[date, dict] = {}
    for d in (start + timedelta(days=i) for i in range(days + 1)):
        day_data[d] = {"date": str(d), "count": 0, "minutes": 0}

    for p in progress_rows:
        dt = p.completed_at or p.created_at
        if not dt:
            continue
        d = dt.date()
        if d < start:
            continue
        if d not in day_data:
            day_data[d] = {"date": str(d), "count": 0, "minutes": 0}
        if p.is_completed:
            day_data[d]["count"] += 1
        day_data[d]["minutes"] += (p.video_watched_seconds or 0) // 60

    logs = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == current_user.id,
        UserActivityLog.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
    ).all()
    for log in logs:
        if log.created_at:
            d = log.created_at.date()
            if d in day_data:
                day_data[d]["count"] += 1

    for d in sorted(day_data.keys()):
        out.append(day_data[d])
    return {"days": out}


@router.get("/me/coin-history")
def get_my_coin_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(10, ge=1, le=50),
):
    """Last N coin transactions (earned/spent)."""
    rows = db.query(CoinTransactionLog).filter(
        CoinTransactionLog.user_id == current_user.id,
    ).order_by(CoinTransactionLog.created_at.desc()).limit(limit).all()

    reason_labels = {
        "login": "Ежедневный вход",
        "test_": "Тест",
        "topic_": "Тема",
        "assignment_": "Задание",
        "ai_challenge_": "AI Challenge",
        "shop_item_": "Покупка",
    }

    def label_for(reason: str) -> str:
        for prefix, label in reason_labels.items():
            if reason.startswith(prefix):
                return label
        return reason

    return [
        {
            "id": r.id,
            "amount": r.amount,
            "reason": r.reason,
            "label": label_for(r.reason),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/me/profile-extended")
def get_my_profile_extended(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Расширенный профиль с данными по роли: курсы, сертификаты, родитель, дети, преподаватель и т.д."""
    user = current_user
    if _ensure_parent_profile_fields(db, user):
        db.commit()
        db.refresh(user)
    if user.role == "teacher":
        _ensure_curator_profile_fields(db, user)
    if user.role in ("admin", "director"):
        _ensure_admin_profile_fields(db, user)
    out = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "photo_url": user.photo_url,
        "description": user.description,
        "phone": user.phone,
        "birth_date": user.birth_date.isoformat() if user.birth_date else None,
        "city": user.city,
        "address": user.address,
        "parent_id": user.parent_id,
        "created_at": user.created_at.isoformat() if user.created_at else None,

        # Teacher profile fields (present when role == "teacher")
        "gender": getattr(user, "gender", None),
        "identity_card": getattr(user, "identity_card", None),
        "iin": getattr(user, "iin", None),
        # Curator profile fields (teacher role)
        "curated_courses": getattr(user, "curated_courses", None),
        "consultation_schedule": getattr(user, "consultation_schedule", None),
        "consultation_location": getattr(user, "consultation_location", None),
        "can_view_performance": getattr(user, "can_view_performance", None),
        "can_message_students": getattr(user, "can_message_students", None),
        "can_view_attendance": getattr(user, "can_view_attendance", None),
        "can_call_parent_teacher_meetings": getattr(user, "can_call_parent_teacher_meetings", None),
        "can_create_group_announcements": getattr(user, "can_create_group_announcements", None),
        # Parent profile fields
        "work_place": getattr(user, "work_place", None),
        "kinship_degree": getattr(user, "kinship_degree", None),
        "educational_process_role": getattr(user, "educational_process_role", None),
        "education": getattr(user, "education", None),
        "academic_degree": getattr(user, "academic_degree", None),
        "email_work": getattr(user, "email_work", None),
        "phone_work": getattr(user, "phone_work", None),
        "office": getattr(user, "office", None),
        "reception_hours": getattr(user, "reception_hours", None),
        "employee_number": getattr(user, "employee_number", None),
        "position": getattr(user, "position", None),
        "department": getattr(user, "department", None),
        "hire_date": user.hire_date.isoformat() if getattr(user, "hire_date", None) else None,
        "employment_status": getattr(user, "employment_status", None),
        "academic_interests": getattr(user, "academic_interests", None),
        "teaching_hours": getattr(user, "teaching_hours", None),
        "subjects_taught": getattr(user, "subjects_taught", None),
        "student_counts": getattr(user, "student_counts", None),
        "status": getattr(user, "status", None),
        "interface_language": getattr(user, "interface_language", None),

        # Admin profile fields
        "education_level": getattr(user, "education_level", None),
        "email_personal": getattr(user, "email_personal", None),
        "system_role": getattr(user, "system_role", None),
        "permissions": getattr(user, "permissions", None),
        "areas_of_responsibility": getattr(user, "areas_of_responsibility", None),
        "can_create_users": getattr(user, "can_create_users", None),
        "can_delete_users": getattr(user, "can_delete_users", None),
        "can_edit_courses": getattr(user, "can_edit_courses", None),
        "can_view_analytics": getattr(user, "can_view_analytics", None),
        "can_configure_system": getattr(user, "can_configure_system", None),
    }
    if user.role == "student":
        parent = db.query(User).filter(User.id == user.parent_id).first() if user.parent_id else None
        out["parent"] = {"id": parent.id, "full_name": parent.full_name, "email": parent.email} if parent else None
        enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user.id).all()
        course_ids = [e.course_id for e in enrollments]
        courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
        out["enrollments"] = [{"course_id": e.course_id, "course_title": courses.get(e.course_id).title if courses.get(e.course_id) else ""} for e in enrollments]
        certs = db.query(Certificate).filter(Certificate.user_id == user.id).all()
        out["certificates"] = [{"id": c.id, "course_id": c.course_id, "final_score": float(c.final_score) if c.final_score else None} for c in certs]
        gs = db.query(GroupStudent).filter(GroupStudent.student_id == user.id).first()
        teacher = None
        if gs:
            tg = db.query(TeacherGroup).filter(TeacherGroup.id == gs.group_id).first()
            if tg:
                teacher = db.query(User).filter(User.id == tg.teacher_id).first()
        out["teacher"] = {"id": teacher.id, "full_name": teacher.full_name, "email": teacher.email} if teacher else None
    elif user.role == "parent":
        children = db.query(User).filter(User.parent_id == user.id).all()
        out["children"] = [{"id": c.id, "full_name": c.full_name, "email": c.email, "role": c.role} for c in children]
    elif user.role == "teacher":
        groups = db.query(TeacherGroup).filter(TeacherGroup.teacher_id == user.id).all()
        out["groups"] = [{"id": g.id, "name": g.group_name} for g in groups]
        student_ids = []
        for g in groups:
            for gs in db.query(GroupStudent).filter(GroupStudent.group_id == g.id).all():
                student_ids.append(gs.student_id)
        students = {s.id: s for s in db.query(User).filter(User.id.in_(set(student_ids))).all()}
        out["students_count"] = len(students)
    return out


def _build_profile_extended(db: Session, user: User) -> dict:
    """Строит расширенный профиль для пользователя (используется для me и для profile-public)."""
    if _ensure_parent_profile_fields(db, user):
        db.commit()
        db.refresh(user)
    if user.role == "teacher":
        _ensure_curator_profile_fields(db, user)
    if user.role in ("admin", "director"):
        _ensure_admin_profile_fields(db, user)
    out = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "photo_url": user.photo_url,
        "description": user.description,
        "phone": user.phone,
        "birth_date": (user.birth_date.isoformat() if hasattr(user.birth_date, "isoformat") else user.birth_date) if user.birth_date else None,
        "city": user.city,
        "address": user.address,
        "parent_id": user.parent_id,
        "created_at": (user.created_at.isoformat() if hasattr(user.created_at, "isoformat") else user.created_at) if user.created_at else None,
        "points": user.points or 0,

        # Teacher profile fields (present when role == "teacher")
        "gender": getattr(user, "gender", None),
        "identity_card": getattr(user, "identity_card", None),
        "iin": getattr(user, "iin", None),
        # Curator profile fields (teacher role)
        "curated_courses": getattr(user, "curated_courses", None),
        "consultation_schedule": getattr(user, "consultation_schedule", None),
        "consultation_location": getattr(user, "consultation_location", None),
        "can_view_performance": getattr(user, "can_view_performance", None),
        "can_message_students": getattr(user, "can_message_students", None),
        "can_view_attendance": getattr(user, "can_view_attendance", None),
        "can_call_parent_teacher_meetings": getattr(user, "can_call_parent_teacher_meetings", None),
        "can_create_group_announcements": getattr(user, "can_create_group_announcements", None),
        # Parent profile fields
        "work_place": getattr(user, "work_place", None),
        "kinship_degree": getattr(user, "kinship_degree", None),
        "educational_process_role": getattr(user, "educational_process_role", None),
        "education": getattr(user, "education", None),
        "academic_degree": getattr(user, "academic_degree", None),
        "email_work": getattr(user, "email_work", None),
        "phone_work": getattr(user, "phone_work", None),
        "office": getattr(user, "office", None),
        "reception_hours": getattr(user, "reception_hours", None),
        "employee_number": getattr(user, "employee_number", None),
        "position": getattr(user, "position", None),
        "department": getattr(user, "department", None),
        "hire_date": (user.hire_date.isoformat() if hasattr(user.hire_date, "isoformat") else getattr(user, "hire_date", None)) if getattr(user, "hire_date", None) else None,
        "employment_status": getattr(user, "employment_status", None),
        "academic_interests": getattr(user, "academic_interests", None),
        "teaching_hours": getattr(user, "teaching_hours", None),
        "subjects_taught": getattr(user, "subjects_taught", None),
        "student_counts": getattr(user, "student_counts", None),
        "status": getattr(user, "status", None),
        "interface_language": getattr(user, "interface_language", None),

        # Admin profile fields
        "education_level": getattr(user, "education_level", None),
        "email_personal": getattr(user, "email_personal", None),
        "system_role": getattr(user, "system_role", None),
        "permissions": getattr(user, "permissions", None),
        "areas_of_responsibility": getattr(user, "areas_of_responsibility", None),
        "can_create_users": getattr(user, "can_create_users", None),
        "can_delete_users": getattr(user, "can_delete_users", None),
        "can_edit_courses": getattr(user, "can_edit_courses", None),
        "can_view_analytics": getattr(user, "can_view_analytics", None),
        "can_configure_system": getattr(user, "can_configure_system", None),
    }
    if user.role == "student":
        parent = db.query(User).filter(User.id == user.parent_id).first() if user.parent_id else None
        out["parent"] = {"id": parent.id, "full_name": parent.full_name, "email": parent.email} if parent else None
        enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user.id).all()
        course_ids = [e.course_id for e in enrollments]
        courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
        out["enrollments"] = [{"course_id": e.course_id, "course_title": courses.get(e.course_id).title if courses.get(e.course_id) else ""} for e in enrollments]
        certs = db.query(Certificate).filter(Certificate.user_id == user.id).all()
        out["certificates"] = [{"id": c.id, "course_id": c.course_id, "final_score": float(c.final_score) if c.final_score else None} for c in certs]
        gs = db.query(GroupStudent).filter(GroupStudent.student_id == user.id).first()
        teacher = None
        if gs:
            tg = db.query(TeacherGroup).filter(TeacherGroup.id == gs.group_id).first()
            if tg:
                teacher = db.query(User).filter(User.id == tg.teacher_id).first()
        out["teacher"] = {"id": teacher.id, "full_name": teacher.full_name, "email": teacher.email} if teacher else None
    elif user.role == "parent":
        children = db.query(User).filter(User.parent_id == user.id).all()
        out["children"] = [{"id": c.id, "full_name": c.full_name, "email": c.email, "role": c.role} for c in children]
    elif user.role == "teacher":
        groups = db.query(TeacherGroup).filter(TeacherGroup.teacher_id == user.id).all()
        out["groups"] = [{"id": g.id, "name": g.group_name} for g in groups]
        student_ids = []
        for g in groups:
            for gs in db.query(GroupStudent).filter(GroupStudent.group_id == g.id).all():
                student_ids.append(gs.student_id)
        students = {s.id: s for s in db.query(User).filter(User.id.in_(set(student_ids))).all()}
        out["students_count"] = len(students)
    return out


def _build_progress_detail(db: Session, user_id: int) -> dict:
    """Детальный прогресс по курсам для пользователя."""
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user_id).all()
    course_ids = list({e.course_id for e in enrollments})
    if not course_ids:
        return {"courses": []}

    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    all_topics = db.query(CourseTopic).filter(CourseTopic.course_id.in_(course_ids)).all()
    topics_by_course: dict[int, list] = {}
    topic_by_id = {t.id: t for t in all_topics}
    for t in all_topics:
        topics_by_course.setdefault(t.course_id, []).append(t)
    progress_rows = db.query(StudentProgress).filter(StudentProgress.user_id == user_id).all()
    certs = db.query(Certificate).filter(Certificate.user_id == user_id).all()
    certs_by_course = {c.course_id: c for c in certs}

    courses_report = []
    for course_id in course_ids:
        course = courses.get(course_id)
        topics = topics_by_course.get(course_id, [])
        total_topics = len(topics)
        completed_progress = [p for p in progress_rows if p.course_id == course_id and p.is_completed]
        course_progress_rows = [p for p in progress_rows if p.course_id == course_id]
        completed_topic_ids = {p.topic_id for p in completed_progress if p.topic_id}
        topics_completed = len(completed_topic_ids)
        completed_topic_titles = [topic_by_id[tid].title for tid in completed_topic_ids if tid in topic_by_id]
        completion_pct = round((topics_completed / total_topics * 100) if total_topics else 0, 1)
        test_scores = [float(p.test_score) for p in completed_progress if p.test_score is not None]
        avg_score = round(sum(test_scores) / len(test_scores), 1) if test_scores else None
        video_seconds = sum(p.video_watched_seconds or 0 for p in course_progress_rows)
        cert = certs_by_course.get(course_id)
        courses_report.append({
            "course_id": course_id,
            "course_title": course.title if course else "",
            "progress_percent": completion_pct,
            "topics_completed": topics_completed,
            "total_topics": total_topics,
            "completed_topic_titles": completed_topic_titles,
            "test_scores": test_scores,
            "avg_test_score": avg_score,
            "certificate": {
                "id": cert.id,
                "final_score": float(cert.final_score) if cert and cert.final_score else None,
                "issued_at": (cert.issued_at.isoformat() if hasattr(cert.issued_at, "isoformat") else cert.issued_at) if cert and cert.issued_at else None,
            } if cert else None,
            "video_watched_seconds": video_seconds,
        })
    return {"courses": courses_report}


def _build_profile_public_summary(db: Session, user: User) -> dict:
    """Строит безопасный публичный summary профиля без чувствительных полей."""
    if user.role == "student":
        sp = _ensure_student_profile(db, user)
    else:
        sp = None

    profile = _build_profile_extended(db, user)
    safe = {
        "id": profile["id"],
        "email": profile["email"],
        "full_name": profile["full_name"],
        "role": profile["role"],
        "photo_url": profile.get("photo_url"),
        "description": profile.get("description"),
        "phone": profile.get("phone"),
        "birth_date": profile.get("birth_date"),
        "city": profile.get("city"),
        "created_at": profile.get("created_at"),
        "points": profile.get("points", 0),
        "status": profile.get("status"),
    }

    if user.role == "student" and sp is not None:
        safe.update(
            {
                "status": sp.status,
                "gender": sp.gender,
                "nationality": sp.nationality,
                "iin": sp.iin,
                "identity_card": sp.identity_card,
                "phone_alternative": sp.phone_alternative,
                "postal_code": sp.postal_code,
                "country": sp.country,
                "student_id_card_number": sp.student_id_card_number,
                "specialty": sp.specialty,
                "course": sp.course,
                "group": sp.group,
                "study_form": sp.study_form,
                "admission_date": (sp.admission_date.isoformat() if hasattr(sp.admission_date, "isoformat") else sp.admission_date) if sp.admission_date else None,
                "graduation_date_planned": (sp.graduation_date_planned.isoformat() if hasattr(sp.graduation_date_planned, "isoformat") else sp.graduation_date_planned) if sp.graduation_date_planned else None,
                "parent": profile.get("parent"),
                "teacher": profile.get("teacher"),
            }
        )
    elif user.role == "parent":
        safe.update(
            {
                "work_place": profile.get("work_place"),
                "kinship_degree": profile.get("kinship_degree"),
                "educational_process_role": profile.get("educational_process_role"),
                "education": profile.get("education"),
                "academic_degree": profile.get("academic_degree"),
                "email_work": profile.get("email_work"),
                "phone_work": profile.get("phone_work"),
                "office": profile.get("office"),
                "employee_number": profile.get("employee_number"),
                "position": profile.get("position"),
                "department": profile.get("department"),
                "hire_date": profile.get("hire_date"),
                "employment_status": profile.get("employment_status"),
                "interface_language": profile.get("interface_language"),
                "children": profile.get("children"),
            }
        )
    elif user.role == "teacher":
        safe.update(
            {
                "education": profile.get("education"),
                "academic_degree": profile.get("academic_degree"),
                "email_work": profile.get("email_work"),
                "phone_work": profile.get("phone_work"),
                "office": profile.get("office"),
                "employee_number": profile.get("employee_number"),
                "position": profile.get("position"),
                "department": profile.get("department"),
                "hire_date": profile.get("hire_date"),
                "employment_status": profile.get("employment_status"),
                "academic_interests": profile.get("academic_interests"),
                "subjects_taught": profile.get("subjects_taught"),
                "teaching_hours": profile.get("teaching_hours"),
                "reception_hours": profile.get("reception_hours"),
                "status": profile.get("status"),
                "interface_language": profile.get("interface_language"),
                "curated_courses": profile.get("curated_courses"),
                "consultation_location": profile.get("consultation_location"),
                "can_view_performance": profile.get("can_view_performance"),
                "can_message_students": profile.get("can_message_students"),
                "can_view_attendance": profile.get("can_view_attendance"),
                "can_call_parent_teacher_meetings": profile.get("can_call_parent_teacher_meetings"),
                "can_create_group_announcements": profile.get("can_create_group_announcements"),
                "groups": profile.get("groups"),
                "students_count": profile.get("students_count"),
            }
        )
    elif user.role in ("admin", "director"):
        safe.update(
            {
                "education_level": profile.get("education_level"),
                "email_work": profile.get("email_work"),
                "phone_work": profile.get("phone_work"),
                "office": profile.get("office"),
                "employee_number": profile.get("employee_number"),
                "position": profile.get("position"),
                "department": profile.get("department"),
                "hire_date": profile.get("hire_date"),
                "status": profile.get("status"),
                "system_role": profile.get("system_role"),
                "permissions": profile.get("permissions"),
                "areas_of_responsibility": profile.get("areas_of_responsibility"),
                "can_create_users": profile.get("can_create_users"),
                "can_delete_users": profile.get("can_delete_users"),
                "can_edit_courses": profile.get("can_edit_courses"),
                "can_view_analytics": profile.get("can_view_analytics"),
                "can_configure_system": profile.get("can_configure_system"),
                "interface_language": profile.get("interface_language"),
            }
        )

    return safe


@router.get("/{user_id}/profile-public")
def get_user_profile_public(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Публичный профиль пользователя (для просмотра из рейтинга). Любой авторизованный пользователь может просмотреть."""
    try:
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        profile = _build_profile_public_summary(db, target)

        certs = db.query(Certificate).filter(Certificate.user_id == user_id).all()
        if certs:
            course_ids = [c.course_id for c in certs]
            courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
        else:
            courses = {}
        certificates = []
        for c in certs:
            course = courses.get(c.course_id)
            certificates.append({
                "id": c.id,
                "course_id": c.course_id,
                "course_title": course.title if course else "",
                "certificate_url": _certificate_display_url(c.certificate_url),
                "final_score": float(c.final_score) if c.final_score else None,
                "issued_at": (c.issued_at.isoformat() if hasattr(c.issued_at, "isoformat") else c.issued_at) if c.issued_at else None,
            })

        progress_detail = _build_progress_detail(db, user_id)

        enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user_id).all()
        enrollment_list = [{"course_id": e.course_id} for e in enrollments]

        return {
            "profile": profile,
            "certificates": certificates,
            "progress_detail": progress_detail,
            "enrollments": enrollment_list,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("profile-public failed for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Не удалось загрузить профиль") from e


@router.get("/me/advanced-analytics")
def get_advanced_analytics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Расширенная аналитика прогресса (только для Premium пользователей)."""
    is_premium = getattr(current_user, "is_premium", 0) == 1
    if not is_premium:
        raise HTTPException(
            status_code=403,
            detail="Расширенная аналитика доступна только для Premium пользователей. Оформите подписку."
        )
    
    # Получаем все курсы пользователя
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == current_user.id).all()
    course_ids = [e.course_id for e in enrollments]
    
    if not course_ids:
        return {
            "overview": {
                "total_courses": 0,
                "courses_completed": 0,
                "total_study_time_hours": 0,
                "average_score": None,
                "streak_days": 0,
            },
            "progress_over_time": [],
            "course_details": [],
            "performance_metrics": {},
        }
    
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    
    # Общая статистика
    certs = db.query(Certificate).filter(
        Certificate.user_id == current_user.id,
        Certificate.course_id.in_(course_ids),
    ).all()
    courses_completed = len(certs)
    
    # Время обучения (сумма всех video_watched_seconds)
    progress_rows = db.query(StudentProgress).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.course_id.in_(course_ids),
    ).all()
    total_video_seconds = sum(p.video_watched_seconds or 0 for p in progress_rows)
    total_study_time_hours = round(total_video_seconds / 3600, 1)
    
    # Средний балл
    test_scores = [float(p.test_score) for p in progress_rows if p.test_score is not None]
    average_score = round(sum(test_scores) / len(test_scores), 1) if test_scores else None
    
    # Серия дней (streak)
    today = date.today()
    streak_days = 0
    check_date = today
    while True:
        day_start = datetime.combine(check_date, datetime.min.time(), tzinfo=timezone.utc)
        day_end = datetime.combine(check_date, datetime.max.time(), tzinfo=timezone.utc)
        has_activity = db.query(StudentProgress).filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.created_at >= day_start,
            StudentProgress.created_at <= day_end,
        ).first() is not None
        
        if not has_activity:
            break
        streak_days += 1
        check_date -= timedelta(days=1)
    
    # Прогресс по времени (последние 30 дней)
    progress_over_time = []
    for i in range(30):
        day = today - timedelta(days=29 - i)
        day_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        day_end = datetime.combine(day, datetime.max.time(), tzinfo=timezone.utc)
        day_progress = db.query(StudentProgress).filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.is_completed == True,
            StudentProgress.completed_at >= day_start,
            StudentProgress.completed_at <= day_end,
        ).count()
        progress_over_time.append({
            "date": day.isoformat(),
            "topics_completed": day_progress,
        })
    
    # Детали по курсам
    course_details = []
    for course_id in course_ids:
        course = courses.get(course_id)
        if not course:
            continue
        
        course_progress = [p for p in progress_rows if p.course_id == course_id]
        completed_topics = len([p for p in course_progress if p.is_completed])
        total_topics = db.query(CourseTopic).filter(CourseTopic.course_id == course_id).count()
        course_video_seconds = sum(p.video_watched_seconds or 0 for p in course_progress)
        course_test_scores = [float(p.test_score) for p in course_progress if p.test_score is not None]
        course_avg_score = round(sum(course_test_scores) / len(course_test_scores), 1) if course_test_scores else None
        
        cert = next((c for c in certs if c.course_id == course_id), None)
        
        course_details.append({
            "course_id": course_id,
            "course_title": course.title,
            "progress_percent": round((completed_topics / total_topics * 100) if total_topics else 0, 1),
            "topics_completed": completed_topics,
            "total_topics": total_topics,
            "study_time_hours": round(course_video_seconds / 3600, 1),
            "average_score": course_avg_score,
            "has_certificate": cert is not None,
        })
    
    # Метрики производительности
    performance_metrics = {
        "completion_rate": round((courses_completed / len(course_ids) * 100) if course_ids else 0, 1),
        "average_study_time_per_day": round(total_study_time_hours / 30, 1) if total_study_time_hours > 0 else 0,
        "test_accuracy": average_score if average_score else None,
        "consistency_score": round((streak_days / 30 * 100) if streak_days > 0 else 0, 1),
    }
    
    return {
        "overview": {
            "total_courses": len(course_ids),
            "courses_completed": courses_completed,
            "total_study_time_hours": total_study_time_hours,
            "average_score": average_score,
            "streak_days": streak_days,
        },
        "progress_over_time": progress_over_time,
        "course_details": course_details,
        "performance_metrics": performance_metrics,
    }
