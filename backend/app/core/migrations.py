from __future__ import annotations

from sqlalchemy import Engine, text

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


def run_migrations() -> None:
    """Entry point for running lightweight, in‑app migrations."""
    _ensure_user_city_column(engine)
    _ensure_course_applications_columns(engine)


