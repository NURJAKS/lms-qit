from __future__ import annotations

from sqlalchemy import Engine, inspect, text

from app.core.database import engine


def _ensure_user_city_column(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack users.city.

    In older versions, the users table did not have the city column. Newer
    application versions expect it to exist, which causes "no such column:
    users.city" errors on any query against the users table.

    For SQLite databases only, we:
    - read PRAGMA table_info(users)
    - if the table exists and the city column is missing, run
      ALTER TABLE users ADD COLUMN city VARCHAR(100)
    """
    try:
        # Only run this lightweight migration for SQLite connections.
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(users)"))
            rows = list(result)
            if not rows:
                # Table does not exist yet; fresh databases will be created
                # with the correct schema via Base.metadata.create_all.
                return

            column_names = {row[1] for row in rows}
            if "city" in column_names:
                return

            conn.execute(text("ALTER TABLE users ADD COLUMN city VARCHAR(100)"))
    except Exception:
        # Schema migration issues should not crash the API startup in dev;
        # failures will still surface as DB errors if they persist.
        return


def _ensure_user_teacher_columns(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack teacher profile fields on users.

    We store teacher profile fields on the users table for simplicity. For SQLite only:
    - read PRAGMA table_info(users)
    - add missing columns via ALTER TABLE ... ADD COLUMN ...
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        needed_columns = {
            "gender": "VARCHAR(20)",
            "identity_card": "VARCHAR(100)",
            "iin": "VARCHAR(20)",
            # curator-specific fields (teacher role)
            # arrays/objects stored as JSON text in SQLite
            "curated_courses": "TEXT",
            "consultation_schedule": "TEXT",
            "consultation_location": "VARCHAR(255)",
            "can_view_performance": "BOOLEAN",
            "can_message_students": "BOOLEAN",
            "can_view_attendance": "BOOLEAN",
            "can_call_parent_teacher_meetings": "BOOLEAN",
            "can_create_group_announcements": "BOOLEAN",
            "education": "VARCHAR(500)",
            "academic_degree": "VARCHAR(255)",
            "email_work": "VARCHAR(255)",
            "phone_work": "VARCHAR(50)",
            "office": "VARCHAR(100)",
            "reception_hours": "VARCHAR(255)",
            "employee_number": "VARCHAR(100)",
            "position": "VARCHAR(255)",
            "department": "VARCHAR(255)",
            "hire_date": "DATE",
            "employment_status": "VARCHAR(50)",
            "academic_interests": "TEXT",
            "teaching_hours": "VARCHAR(100)",
            # arrays (stored as JSON text in SQLite)
            "subjects_taught": "TEXT",
            "student_counts": "TEXT",
            "status": "VARCHAR(20)",
            "interface_language": "VARCHAR(20)",
        }

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(users)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            for name, ddl_type in needed_columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl_type}"))
    except Exception:
        return


def _ensure_user_admin_columns(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack admin profile fields on users.

    We store admin profile fields on the users table for simplicity. For SQLite only:
    - read PRAGMA table_info(users)
    - add missing columns via ALTER TABLE ... ADD COLUMN ...
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        needed_columns = {
            "education_level": "VARCHAR(255)",
            "email_personal": "VARCHAR(255)",
            "system_role": "VARCHAR(50)",
            # arrays (stored as JSON text in SQLite)
            "permissions": "TEXT",
            "areas_of_responsibility": "TEXT",
            "can_create_users": "BOOLEAN",
            "can_delete_users": "BOOLEAN",
            "can_edit_courses": "BOOLEAN",
            "can_view_analytics": "BOOLEAN",
            "can_configure_system": "BOOLEAN",
        }

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(users)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            for name, ddl_type in needed_columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl_type}"))
    except Exception:
        return


def _ensure_user_parent_columns(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack parent profile fields on users.
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        needed_columns = {
            "work_place": "VARCHAR(255)",
            "kinship_degree": "VARCHAR(20)",
            "educational_process_role": "VARCHAR(30)",
        }

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(users)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            for name, ddl_type in needed_columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl_type}"))
    except Exception:
        return


def _ensure_student_profile_iin_column(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack student_profiles.iin.
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(student_profiles)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            if "iin" not in existing:
                conn.execute(text("ALTER TABLE student_profiles ADD COLUMN iin VARCHAR(20)"))
    except Exception:
        return


def _ensure_course_applications_columns(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack the extended
    fields on course_applications (city, parent_*).
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        needed_columns = {
            "city": "VARCHAR(100)",
            "parent_email": "VARCHAR(255)",
            "parent_full_name": "VARCHAR(255)",
            "parent_phone": "VARCHAR(50)",
            "parent_city": "VARCHAR(100)",
            # новые поля анкеты студента и родителя
            "student_birth_date": "DATE",
            "student_age": "INTEGER",
            "student_iin": "VARCHAR(30)",
            "parent_birth_date": "DATE",
            "parent_age": "INTEGER",
            "parent_iin": "VARCHAR(30)",
        }

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(course_applications)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            for name, ddl_type in needed_columns.items():
                if name not in existing:
                    conn.execute(
                        text(f"ALTER TABLE course_applications ADD COLUMN {name} {ddl_type}")
                    )
    except Exception:
        # Schema migration issues should not crash the API startup in dev;
        # failures will still surface as DB errors if they persist.
        return


def _ensure_teacher_materials_columns(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for teacher_materials table.
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        needed_columns = {
            "attachment_urls": "TEXT",
            "attachment_links": "TEXT",
        }

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(teacher_materials)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            for name, ddl_type in needed_columns.items():
                if name not in existing:
                    conn.execute(
                        text(f"ALTER TABLE teacher_materials ADD COLUMN {name} {ddl_type}")
                    )
    except Exception:
        return


def _ensure_student_progress_updated_at_column(db_engine: Engine) -> None:
    """
    Backward‑compatible migration for legacy SQLite DBs that lack student_progress.updated_at.

    Newer code expects the column to exist (see StudentProgress model). Without it,
    any ORM query against student_progress fails with:
      sqlite3.OperationalError: no such column: student_progress.updated_at
    """
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(student_progress)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            if "updated_at" in existing:
                return

            # SQLite supports adding a nullable column via ALTER TABLE.
            conn.execute(text("ALTER TABLE student_progress ADD COLUMN updated_at DATETIME"))
    except Exception:
        return


def _ensure_user_purchases_price_paid_column(db_engine: Engine) -> None:
    """Add price_paid column to user_purchases for correct refund calculations."""
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(user_purchases)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            if "price_paid" not in existing:
                conn.execute(text("ALTER TABLE user_purchases ADD COLUMN price_paid INTEGER"))
    except Exception:
        return


def _ensure_teacher_assignments_submission_columns(db_engine: Engine) -> None:
    """Add reject_after_deadline / student comment / edit flags (legacy DBs)."""
    try:
        insp = inspect(db_engine)
        if not insp.has_table("teacher_assignments"):
            return
        existing = {c["name"] for c in insp.get_columns("teacher_assignments")}
        sqlite = "sqlite" in str(db_engine.url).lower()
        with db_engine.begin() as conn:
            if "reject_submissions_after_deadline" not in existing:
                ddl = "INTEGER NOT NULL DEFAULT 1" if sqlite else "BOOLEAN NOT NULL DEFAULT TRUE"
                conn.execute(text(f"ALTER TABLE teacher_assignments ADD COLUMN reject_submissions_after_deadline {ddl}"))
            if "allow_student_class_comments" not in existing:
                ddl = "INTEGER NOT NULL DEFAULT 1" if sqlite else "BOOLEAN NOT NULL DEFAULT TRUE"
                conn.execute(text(f"ALTER TABLE teacher_assignments ADD COLUMN allow_student_class_comments {ddl}"))
            if "allow_student_edit_submission" not in existing:
                ddl = "INTEGER NOT NULL DEFAULT 0" if sqlite else "BOOLEAN NOT NULL DEFAULT FALSE"
                conn.execute(text(f"ALTER TABLE teacher_assignments ADD COLUMN allow_student_edit_submission {ddl}"))
    except Exception:
        return


def _ensure_assignment_submissions_returned_at_column(db_engine: Engine) -> None:
    """Add returned_at column to assignment_submissions for publish/return tracking."""
    try:
        insp = inspect(db_engine)
        if not insp.has_table("assignment_submissions"):
            return
        existing = {c["name"] for c in insp.get_columns("assignment_submissions")}
        if "returned_at" in existing:
            return
        sqlite = "sqlite" in str(db_engine.url).lower()
        dt = "DATETIME" if sqlite else "TIMESTAMPTZ"
        with db_engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE assignment_submissions ADD COLUMN returned_at {dt}"))
    except Exception:
        return


def _ensure_assignment_submissions_teacher_comment_author_column(db_engine: Engine) -> None:
    """Add teacher_comment_author_id to assignment_submissions for author attribution."""
    try:
        insp = inspect(db_engine)
        if not insp.has_table("assignment_submissions"):
            return
        existing = {c["name"] for c in insp.get_columns("assignment_submissions")}
        if "teacher_comment_author_id" in existing:
            return
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE assignment_submissions ADD COLUMN teacher_comment_author_id INTEGER"))
    except Exception:
        return


def _ensure_teacher_questions_extended_columns(db_engine: Engine) -> None:
    try:
        insp = inspect(db_engine)
        if not insp.has_table("teacher_questions"):
            return
        existing = {c["name"] for c in insp.get_columns("teacher_questions")}
        sqlite = "sqlite" in str(db_engine.url).lower()
        dt = "DATETIME" if sqlite else "TIMESTAMPTZ"
        with db_engine.begin() as conn:
            if "description" not in existing:
                conn.execute(text("ALTER TABLE teacher_questions ADD COLUMN description TEXT"))
            if "deadline" not in existing:
                conn.execute(text(f"ALTER TABLE teacher_questions ADD COLUMN deadline {dt}"))
            if "max_points" not in existing:
                conn.execute(text("ALTER TABLE teacher_questions ADD COLUMN max_points INTEGER DEFAULT 100"))
            if "attachment_urls" not in existing:
                conn.execute(text("ALTER TABLE teacher_questions ADD COLUMN attachment_urls TEXT"))
            if "attachment_links" not in existing:
                conn.execute(text("ALTER TABLE teacher_questions ADD COLUMN attachment_links TEXT"))
            if "video_urls" not in existing:
                conn.execute(text("ALTER TABLE teacher_questions ADD COLUMN video_urls TEXT"))
            if "reject_submissions_after_deadline" not in existing:
                ddl = "INTEGER NOT NULL DEFAULT 1" if sqlite else "BOOLEAN NOT NULL DEFAULT TRUE"
                conn.execute(text(f"ALTER TABLE teacher_questions ADD COLUMN reject_submissions_after_deadline {ddl}"))
            if "allow_student_class_comments" not in existing:
                ddl = "INTEGER NOT NULL DEFAULT 1" if sqlite else "BOOLEAN NOT NULL DEFAULT TRUE"
                conn.execute(text(f"ALTER TABLE teacher_questions ADD COLUMN allow_student_class_comments {ddl}"))
            if "allow_student_edit_submission" not in existing:
                ddl = "INTEGER NOT NULL DEFAULT 0" if sqlite else "BOOLEAN NOT NULL DEFAULT FALSE"
                conn.execute(text(f"ALTER TABLE teacher_questions ADD COLUMN allow_student_edit_submission {ddl}"))
    except Exception:
        return


def _ensure_teacher_question_answers_answer_text(db_engine: Engine) -> None:
    try:
        insp = inspect(db_engine)
        if not insp.has_table("teacher_question_answers"):
            return
        existing = {c["name"] for c in insp.get_columns("teacher_question_answers")}
        if "answer_text" in existing:
            return
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE teacher_question_answers ADD COLUMN answer_text TEXT"))
    except Exception:
        return


def _ensure_teacher_question_answers_extended_columns(db_engine: Engine) -> None:
    """
    Backward-compatible migration for legacy SQLite DBs that lack newer
    teacher_question_answers columns (grade/comment/graded_at/coins_awarded).
    """
    try:
        insp = inspect(db_engine)
        if not insp.has_table("teacher_question_answers"):
            return
        existing = {c["name"] for c in insp.get_columns("teacher_question_answers")}
        sqlite = "sqlite" in str(db_engine.url).lower()
        dt = "DATETIME" if sqlite else "TIMESTAMPTZ"
        with db_engine.begin() as conn:
            if "grade" not in existing:
                conn.execute(text("ALTER TABLE teacher_question_answers ADD COLUMN grade INTEGER"))
            if "teacher_comment" not in existing:
                conn.execute(text("ALTER TABLE teacher_question_answers ADD COLUMN teacher_comment TEXT"))
            if "graded_at" not in existing:
                conn.execute(text(f"ALTER TABLE teacher_question_answers ADD COLUMN graded_at {dt}"))
            if "coins_awarded" not in existing:
                conn.execute(text("ALTER TABLE teacher_question_answers ADD COLUMN coins_awarded INTEGER DEFAULT 0"))
    except Exception:
        return


def _ensure_topic_synopsis_and_feed_tables(db_engine: Engine) -> None:
    """Create topic_synopsis_submissions and course_feed_posts if missing."""
    try:
        from app.models.topic_synopsis import TopicSynopsisSubmission
        from app.models.course_feed_post import CourseFeedPost

        TopicSynopsisSubmission.__table__.create(bind=db_engine, checkfirst=True)
        CourseFeedPost.__table__.create(bind=db_engine, checkfirst=True)
    except Exception:
        return


def _ensure_topic_synopsis_columns(db_engine: Engine) -> None:
    """Backfill missing columns for topic_synopsis_submissions on legacy DBs."""
    try:
        insp = inspect(db_engine)
        if not insp.has_table("topic_synopsis_submissions"):
            return
        existing = {c["name"] for c in insp.get_columns("topic_synopsis_submissions")}
        sqlite = "sqlite" in str(db_engine.url).lower()
        dt = "DATETIME" if sqlite else "TIMESTAMPTZ"
        with db_engine.begin() as conn:
            if "updated_at" not in existing:
                conn.execute(text(f"ALTER TABLE topic_synopsis_submissions ADD COLUMN updated_at {dt}"))
    except Exception:
        return


def _ensure_shop_items_secret_content_column(db_engine: Engine) -> None:
    """Add secret_content column to shop_items."""
    try:
        url = str(db_engine.url)
        if "sqlite" not in url:
            return

        with db_engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(shop_items)"))
            rows = list(result)
            if not rows:
                return
            existing = {row[1] for row in rows}
            if "secret_content" not in existing:
                conn.execute(text("ALTER TABLE shop_items ADD COLUMN secret_content TEXT"))
    except Exception:
        return


def _ensure_support_tickets_table(db_engine: Engine) -> None:
    """Create support_tickets table if missing."""
    try:
        from app.models.support_ticket import SupportTicket

        SupportTicket.__table__.create(bind=db_engine, checkfirst=True)
    except Exception:
        return


def run_migrations() -> None:
    """Entry point for running lightweight, in‑app migrations."""
    _ensure_topic_synopsis_and_feed_tables(engine)
    _ensure_user_city_column(engine)
    _ensure_user_teacher_columns(engine)
    _ensure_user_admin_columns(engine)
    _ensure_user_parent_columns(engine)
    _ensure_student_profile_iin_column(engine)
    _ensure_course_applications_columns(engine)
    _ensure_teacher_materials_columns(engine)
    _ensure_student_progress_updated_at_column(engine)
    _ensure_user_purchases_price_paid_column(engine)
    _ensure_teacher_assignments_submission_columns(engine)
    _ensure_assignment_submissions_returned_at_column(engine)
    _ensure_assignment_submissions_teacher_comment_author_column(engine)
    _ensure_teacher_questions_extended_columns(engine)
    _ensure_teacher_question_answers_answer_text(engine)
    _ensure_teacher_question_answers_extended_columns(engine)
    _ensure_topic_synopsis_columns(engine)
    _ensure_shop_items_secret_content_column(engine)
    _ensure_support_tickets_table(engine)

