from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from random import Random


@dataclass(frozen=True)
class FakeCuratorProfileData:
    curated_courses: list[str]
    consultation_schedule: list[dict]
    consultation_location: str
    can_view_performance: bool
    can_message_students: bool
    can_view_attendance: bool
    can_call_parent_teacher_meetings: bool
    can_create_group_announcements: bool
    email_personal: str


def _digits(rnd: Random, n: int) -> str:
    return "".join(str(rnd.randint(0, 9)) for _ in range(n))


def fake_curator_profile_for_user_id(user_id: int) -> FakeCuratorProfileData:
    """
    Deterministic fake data generator (stable per user_id).
    Avoids real PII; formats are plausible but synthetic.
    """
    rnd = Random(user_id * 1237 + 17)

    curated_courses_all = [
        "Web-разработка",
        "Python Backend",
        "Data Science",
        "Алгоритмы и структуры данных",
        "UI/UX основы",
        "Кибербезопасность (введение)",
    ]
    rnd.shuffle(curated_courses_all)
    curated_courses = curated_courses_all[: rnd.randint(2, 4)]

    days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"]
    rnd.shuffle(days)
    schedule = []
    for d in days[: rnd.randint(2, 3)]:
        hour = rnd.choice([10, 11, 12, 14, 15, 16, 17])
        minute = rnd.choice([0, 30])
        duration = rnd.choice([30, 45, 60])
        schedule.append({"day": d, "time": f"{hour:02d}:{minute:02d}", "duration": duration})

    consultation_location = rnd.choice(["Каб. A-214", "Каб. B-105", "Каб. C-301", "Онлайн (Zoom)", "Коворкинг 2 этаж"])

    # Capabilities: mostly enabled, but not always all
    can_view_performance = True
    can_message_students = True
    can_view_attendance = rnd.choice([True, True, False])
    can_call_parent_teacher_meetings = rnd.choice([True, False])
    can_create_group_announcements = True

    email_personal = f"curator{user_id}.{_digits(rnd, 3)}@example.test"

    return FakeCuratorProfileData(
        curated_courses=curated_courses,
        consultation_schedule=schedule,
        consultation_location=consultation_location,
        can_view_performance=can_view_performance,
        can_message_students=can_message_students,
        can_view_attendance=can_view_attendance,
        can_call_parent_teacher_meetings=can_call_parent_teacher_meetings,
        can_create_group_announcements=can_create_group_announcements,
        email_personal=email_personal,
    )
