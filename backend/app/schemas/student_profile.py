from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class StudentProfileBase(BaseModel):
    gender: str | None = None  # Мужской|Женский|Другое
    nationality: str | None = None
    identity_card: str | None = None
    iin: str | None = None

    phone_alternative: str | None = None
    postal_code: str | None = None
    country: str | None = None

    student_id_card_number: str | None = None
    specialty: str | None = None
    course: int | None = None
    group: str | None = None
    study_form: str | None = None  # Очная|Заочная|Очно-заочная
    admission_date: date | None = None
    graduation_date_planned: date | None = None

    status: str | None = None  # Активный|Неактивный
    interface_language: str | None = None  # Русский|Казахский|Английский
    timezone: str | None = None  # UTC±X


class StudentProfileUpdate(StudentProfileBase):
    pass


class StudentProfileRow(StudentProfileBase):
    user_id: int

    class Config:
        from_attributes = True


class StudentProfileMergedResponse(BaseModel):
    # from users.*
    id: int
    email: str
    full_name: str
    photo_url: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    address: str | None = None
    city: str | None = None
    created_at: datetime | None = None

    # from student_profiles.*
    gender: str | None = None
    nationality: str | None = None
    identity_card: str | None = None
    iin: str | None = None

    phone_alternative: str | None = None
    postal_code: str | None = None
    country: str | None = None

    student_id_card_number: str | None = None
    specialty: str | None = None
    course: int | None = None
    group: str | None = None
    study_form: str | None = None
    admission_date: date | None = None
    graduation_date_planned: date | None = None

    status: str | None = None
    interface_language: str | None = None
    timezone: str | None = None

    # computed
    last_login: datetime | None = None

