from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from random import Random


@dataclass(frozen=True)
class FakeStudentProfileData:
    phone_personal: str
    birth_date: date
    city: str
    address: str
    gender: str
    nationality: str
    identity_card: str
    iin: str
    phone_alternative: str
    postal_code: str
    country: str
    student_id_card_number: str
    specialty: str
    course: int
    group: str
    study_form: str
    admission_date: date
    graduation_date_planned: date
    status: str
    interface_language: str
    timezone: str
    snils_inn: str


def _digits(rnd: Random, n: int) -> str:
    return "".join(str(rnd.randint(0, 9)) for _ in range(n))


def fake_student_profile_for_user_id(user_id: int) -> FakeStudentProfileData:
    """
    Deterministic fake data generator (stable per user_id).
    Avoids real PII; formats are plausible but synthetic.
    """
    rnd = Random(user_id * 1009 + 17)

    phone_personal = f"+7 7{rnd.randint(10, 99)} {_digits(rnd, 3)} {_digits(rnd, 2)} {_digits(rnd, 2)}"
    birth_date = date(rnd.randint(2000, 2008), rnd.randint(1, 12), rnd.randint(1, 28))
    city = rnd.choice(["Алматы", "Астана", "Шымкент", "Караганда", "Актобе", "Павлодар"])
    address = rnd.choice(
        [
            "ул. Абая, д. 10, кв. 25",
            "пр-т Назарбаева, д. 87, кв. 14",
            "ул. Сейфуллина, д. 120, кв. 7",
            "мкр. Самал-2, д. 15, кв. 53",
        ]
    )

    gender = rnd.choice(["Мужской", "Женский", "Другое"])
    nationality = rnd.choice(["Казах", "Русский", "Уйгур", "Украинец", "Татарин", "Кореец"])
    identity_card = f"ID-{_digits(rnd, 2)} {_digits(rnd, 6)}"

    # Synthetic IIN (12 digits, plausible but fake)
    iin = _digits(rnd, 12)

    phone_alt = f"+7 7{rnd.randint(10, 99)} {_digits(rnd, 3)} {_digits(rnd, 2)} {_digits(rnd, 2)}"
    postal_code = _digits(rnd, 6)
    country = rnd.choice(["Казахстан", "Россия"])

    student_id_card_number = f"S-{date.today().year % 100}{_digits(rnd, 6)}"
    specialty = rnd.choice(
        [
            "Информационные системы",
            "Программная инженерия",
            "Кибербезопасность",
            "Data Science",
            "Web-разработка",
        ]
    )
    course = rnd.randint(1, 4)
    group = f"{rnd.choice(['ИС', 'ПИ', 'КБ', 'ДС', 'ВЕБ'])}-{course}{rnd.randint(1, 9)}{rnd.choice(['A', 'B', 'C'])}"
    study_form = rnd.choice(["Очная", "Заочная", "Очно-заочная"])

    # Admission/graduation
    start_year = date.today().year - (course - 1)
    admission_date = date(start_year, rnd.randint(8, 9), rnd.randint(1, 28))
    graduation_date_planned = date(start_year + 4, 6, rnd.randint(1, 28))

    # Students must not appear as "Отчислен" in the product UI.
    # Keep DB value stable and simple.
    status = "Активный"
    interface_language = rnd.choice(["Русский", "Казахский", "Английский"])
    timezone = rnd.choice(["UTC+6", "UTC+5", "UTC+3"])
    snils_inn = _digits(rnd, 11)

    return FakeStudentProfileData(
        phone_personal=phone_personal,
        birth_date=birth_date,
        city=city,
        address=address,
        gender=gender,
        nationality=nationality,
        identity_card=identity_card,
        iin=iin,
        phone_alternative=phone_alt,
        postal_code=postal_code,
        country=country,
        student_id_card_number=student_id_card_number,
        specialty=specialty,
        course=course,
        group=group,
        study_form=study_form,
        admission_date=admission_date,
        graduation_date_planned=graduation_date_planned,
        status=status,
        interface_language=interface_language,
        timezone=timezone,
        snils_inn=snils_inn,
    )

