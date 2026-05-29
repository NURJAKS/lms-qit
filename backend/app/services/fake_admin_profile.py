from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from random import Random


@dataclass(frozen=True)
class FakeAdminProfileData:
    gender: str
    identity_card: str
    education_level: str
    email_personal: str
    email_work: str
    phone_work: str
    office: str
    employee_number: str
    position: str
    department: str
    hire_date: date
    status: str
    system_role: str
    permissions: list[str]
    areas_of_responsibility: list[str]
    can_create_users: bool
    can_delete_users: bool
    can_edit_courses: bool
    can_view_analytics: bool
    can_configure_system: bool


def _digits(rnd: Random, n: int) -> str:
    return "".join(str(rnd.randint(0, 9)) for _ in range(n))


def fake_admin_profile_for_user_id(user_id: int, *, work_email: str) -> FakeAdminProfileData:
    """
    Deterministic fake data generator (stable per user_id).
    Avoids real PII; formats are plausible but synthetic.
    """
    rnd = Random(user_id * 2003 + 29)

    gender = rnd.choice(["Мужской", "Женский", "Другое"])
    identity_card = f"ID-{_digits(rnd, 2)} {_digits(rnd, 6)}"
    education_level = rnd.choice(
        [
            "Высшее (бакалавр)",
            "Высшее (магистр)",
            "Высшее (специалист)",
            "Среднее специальное",
        ]
    )

    # Derive a safe personal email (synthetic domain)
    local = f"admin{user_id}.{_digits(rnd, 3)}"
    email_personal = f"{local}@example.test"

    phone_work = f"+7 7{rnd.randint(10, 99)} {_digits(rnd, 3)} {_digits(rnd, 2)} {_digits(rnd, 2)}"
    office = rnd.choice(["A-214", "B-105", "C-301", "D-020", "E-412"])
    employee_number = f"EMP-{date.today().year % 100}{_digits(rnd, 6)}"
    position = rnd.choice(["Администратор", "Старший администратор", "Офис-менеджер", "Координатор программ"])
    department = rnd.choice(["Администрация", "Учебный отдел", "IT отдел", "Деканат", "Кафедра информатики"])

    start_year = date.today().year - rnd.randint(1, 10)
    hire_date = date(start_year, rnd.choice([1, 2, 3, 4, 5, 8, 9, 10, 11]), rnd.randint(1, 28))

    status = rnd.choice(["Активный", "В отпуске", "Неактивный"])
    system_role = rnd.choice(["Суперадминистратор", "Администратор факультета", "Администратор кафедры"])

    base_permissions = [
        "Управление пользователями",
        "Управление курсами",
        "Просмотр отчетов",
        "Просмотр аналитики",
        "Настройки системы",
    ]
    # Pick 3-5 permissions deterministically
    rnd.shuffle(base_permissions)
    permissions = base_permissions[: rnd.randint(3, 5)]

    areas_all = [
        "Факультет IT",
        "Факультет экономики",
        "Кафедра программирования",
        "Кафедра кибербезопасности",
        "Специальность: Data Science",
        "Специальность: Web-разработка",
    ]
    rnd.shuffle(areas_all)
    areas_of_responsibility = areas_all[: rnd.randint(2, 4)]

    # Capability flags (tighter for non-superadmin)
    if system_role == "Суперадминистратор":
        can_create_users = True
        can_delete_users = True
        can_edit_courses = True
        can_view_analytics = True
        can_configure_system = True
    elif system_role == "Администратор факультета":
        can_create_users = True
        can_delete_users = False
        can_edit_courses = True
        can_view_analytics = True
        can_configure_system = False
    else:
        can_create_users = True
        can_delete_users = False
        can_edit_courses = False
        can_view_analytics = True
        can_configure_system = False

    return FakeAdminProfileData(
        gender=gender,
        identity_card=identity_card,
        education_level=education_level,
        email_personal=email_personal,
        email_work=work_email,
        phone_work=phone_work,
        office=office,
        employee_number=employee_number,
        position=position,
        department=department,
        hire_date=hire_date,
        status=status,
        system_role=system_role,
        permissions=permissions,
        areas_of_responsibility=areas_of_responsibility,
        can_create_users=can_create_users,
        can_delete_users=can_delete_users,
        can_edit_courses=can_edit_courses,
        can_view_analytics=can_view_analytics,
        can_configure_system=can_configure_system,
    )

