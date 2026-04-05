#!/usr/bin/env python3
"""
Create one test student who already "purchased" (has CourseEnrollment) for a couple courses.

Also creates GroupStudent (so dashboard doesn't show "pending group") and at least one TeacherAssignment
so assignment-related flows can be tested.

Run:
  cd backend
  python3 seed_student_purchased_courses.py
"""

from __future__ import annotations

import argparse
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import sys
import uuid

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import (
    User,
    Course,
    CourseEnrollment,
    TeacherGroup,
    GroupStudent,
    TeacherAssignment,
    Payment,
)
from app.models.course_topic import CourseTopic
from app.services.fake_student_profile import fake_student_profile_for_user_id
from sqlalchemy import text


def _pick_courses_with_topics(db, limit: int) -> list[Course]:
    candidates = (
        db.query(Course)
        .filter(Course.is_active == True)  # noqa: E712
        .order_by(Course.id)
        .all()
    )

    picked: list[Course] = []
    for c in candidates:
        has_topics = db.query(CourseTopic).filter(CourseTopic.course_id == c.id).first() is not None
        if has_topics:
            picked.append(c)
        if len(picked) >= limit:
            break
    return picked


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--full-name", default="Тестовый студент (Purchased)")
    parser.add_argument("--email", default=None, help="If omitted, will be auto-generated.")
    parser.add_argument("--password", default="student123")
    parser.add_argument("--courses-count", type=int, default=2)
    parser.add_argument("--course-id", type=int, default=None, help="Enroll only in this course (ignores --courses-count).")
    parser.add_argument("--teacher-id", type=int, default=None, help="Use specific teacher for groups.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        teachers_q = db.query(User).filter(User.role == "teacher").order_by(User.id)
        teacher = teachers_q.filter(User.id == args.teacher_id).first() if args.teacher_id else teachers_q.first()
        if not teacher:
            raise RuntimeError("No teacher found in DB. Run `python seed_data.py` first.")

        if args.course_id is not None:
            course = (
                db.query(Course)
                .filter(Course.id == args.course_id, Course.is_active == True)  # noqa: E712
                .first()
            )
            if not course:
                raise RuntimeError(f"Active course id={args.course_id} not found.")
            has_topics = db.query(CourseTopic).filter(CourseTopic.course_id == course.id).first() is not None
            if not has_topics:
                raise RuntimeError(f"Course id={args.course_id} has no topics.")
            selected_courses = [course]
        else:
            courses = _pick_courses_with_topics(db, limit=max(1, args.courses_count))
            if len(courses) < 1:
                raise RuntimeError("No active courses with topics found. Run `python seed_data.py` first.")

            selected_courses = courses[: max(1, args.courses_count)]

        base_email = args.email or f"test_student_purchased_{uuid.uuid4().hex[:10]}@edu.kz"
        email = base_email
        while db.query(User).filter(User.email == email).first() is not None:
            email = base_email.replace("@edu.kz", f"_{uuid.uuid4().hex[:4]}@edu.kz")

        student = User(
            email=email,
            password_hash=get_password_hash(args.password),
            full_name=args.full_name,
            role="student",
            parent_id=None,
            is_approved=True,
        )
        db.add(student)
        db.flush()  # populate student.id

        fake = fake_student_profile_for_user_id(student.id)
        # StudentProfile schema may differ between DB versions (legacy column `snils_inn` etc).
        # We insert via SQL using existing table_info, so the script works against the current DB schema.
        table_info = db.execute(text("PRAGMA table_info(student_profiles)")).all()
        column_names = [r[1] for r in table_info]  # (cid, name, type, notnull, dflt_value, pk)
        not_null_columns = {r[1] for r in table_info if int(r[3]) == 1}

        # Generate legacy-ish required values if column exists.
        # SNILS is 11 digits; for "snils_inn" we keep it synthetic and digits-only.
        snils_inn = "".join(str((student.id + i) % 10) for i in range(11))

        values_by_col = {
            "user_id": student.id,
            "gender": fake.gender,
            "nationality": fake.nationality,
            "identity_card": fake.identity_card,
            "iin": fake.iin,
            "snils_inn": snils_inn,
            "phone_alternative": fake.phone_alternative,
            "postal_code": fake.postal_code,
            "country": fake.country,
            "student_id_card_number": fake.student_id_card_number,
            "specialty": fake.specialty,
            "course": fake.course,
            "group": fake.group,
            "study_form": fake.study_form,
            "admission_date": fake.admission_date,
            "graduation_date_planned": fake.graduation_date_planned,
            "status": fake.status,
            "interface_language": fake.interface_language,
            "timezone": fake.timezone,
        }

        insert_cols = [c for c in column_names if c in values_by_col]
        # Ensure all NOT NULL columns are included (except maybe columns with defaults handled by DB).
        for c in not_null_columns:
            if c not in values_by_col:
                # Best-effort fallback; for test DBs this is enough to satisfy constraints.
                values_by_col[c] = ""  # may be overridden below for numeric/date types
                insert_cols.append(c)

        # If there is a gap for date/number columns that are NOT NULL, coerce safe defaults.
        # SQLite is lenient, so simple fallbacks usually suffice.
        for c in insert_cols:
            if values_by_col.get(c) is None and c in not_null_columns:
                values_by_col[c] = fake.admission_date if "date" in c else 0

        placeholders = ", ".join([f":{c}" for c in insert_cols])
        cols_sql = ", ".join([f'"{c}"' for c in insert_cols])
        stmt = text(f"INSERT INTO student_profiles ({cols_sql}) VALUES ({placeholders})")
        db.execute(stmt, {c: values_by_col[c] for c in insert_cols})

        now = datetime.now(timezone.utc)
        assignment_deadline = now + timedelta(days=7)

        created_groups: list[TeacherGroup] = []
        for idx, course in enumerate(selected_courses, start=1):
            # Create enrollment ("already purchased")
            enrollment = db.query(CourseEnrollment).filter(
                CourseEnrollment.user_id == student.id,
                CourseEnrollment.course_id == course.id,
            ).first()
            amount = Decimal(str(course.price or 0))
            if not enrollment:
                enrollment = CourseEnrollment(
                    user_id=student.id,
                    course_id=course.id,
                    payment_confirmed=True,
                    payment_amount=amount,
                )
                db.add(enrollment)

            # Payment record (optional but keeps DB consistent)
            existing_payment = db.query(Payment).filter(
                Payment.user_id == student.id,
                Payment.course_id == course.id,
            ).first()
            if not existing_payment:
                db.add(
                    Payment(
                        user_id=student.id,
                        course_id=course.id,
                        amount=amount,
                        status="completed",
                        payment_method="card",
                    )
                )

            # Teacher group for this course + student membership
            group = db.query(TeacherGroup).filter(
                TeacherGroup.teacher_id == teacher.id,
                TeacherGroup.course_id == course.id,
            ).order_by(TeacherGroup.id).first()
            if not group:
                group = TeacherGroup(
                    teacher_id=teacher.id,
                    course_id=course.id,
                    group_name=f"Test group {idx} ({course.title})",
                )
                db.add(group)
                db.flush()

            created_groups.append(group)

            existing_membership = db.query(GroupStudent).filter(
                GroupStudent.group_id == group.id,
                GroupStudent.student_id == student.id,
            ).first()
            if not existing_membership:
                db.add(GroupStudent(group_id=group.id, student_id=student.id))

        # Create one test assignment for the first group, so assignment flows can be tested immediately.
        if created_groups:
            gr = created_groups[0]
            # Avoid duplicates for the same group+title
            assignment = db.query(TeacherAssignment).filter(
                TeacherAssignment.group_id == gr.id,
                TeacherAssignment.teacher_id == teacher.id,
                TeacherAssignment.title == "Тестовое задание для студента",
            ).first()
            if not assignment:
                db.add(
                    TeacherAssignment(
                        teacher_id=teacher.id,
                        group_id=gr.id,
                        course_id=gr.course_id,
                        topic_id=None,
                        title="Тестовое задание для студента",
                        description="Автосоздано скриптом seed_student_purchased_courses.py для проверки логики сдачи задания.",
                        deadline=assignment_deadline,
                    )
                )

        db.commit()
        db.refresh(student)

        selected_titles = [(c.id, c.title) for c in selected_courses]
        print("Created test student with purchased courses:")
        print(f"  email: {student.email}")
        print(f"  password: {args.password}")
        print("  enrollments:")
        for cid, title in selected_titles:
            print(f"    - {cid}: {title}")
        print("  student is added to GroupStudent (dashboard accessible).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

