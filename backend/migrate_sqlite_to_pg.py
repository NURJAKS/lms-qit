#!/usr/bin/env python3
"""
Перенос данных SQLite → PostgreSQL (та же схема SQLAlchemy, что у приложения).

Запуск из каталога backend:
  SQLITE_URL=sqlite:///./education.db \\
  POSTGRES_URL=postgresql://user:pass@localhost:5432/education_platform \\
  python migrate_sqlite_to_pg.py

Первый импорт в пустую БД Postgres — без флагов.
Повторный импорт (перезапись) — только с --force.

В Docker (файл с хоста смонтирован в /tmp/education.db):
  docker compose ... run --rm -v /path/education.db:/tmp/education.db:ro \\
    backend python migrate_sqlite_to_pg.py --sqlite-url sqlite:////tmp/education.db --force
"""
from __future__ import annotations

import argparse
import json as _json
import os
import sys
from pathlib import Path

# Корень backend (родитель каталога app/)
_BACKEND_ROOT = Path(__file__).resolve().parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base
from app.models.assignment_private_comment import AssignmentPrivateComment
from app.models import (  # noqa: F401 — регистрация в Base.metadata
    User,
    CourseCategory,
    Course,
    CourseModule,
    CourseTopic,
    Test,
    TestQuestion,
    StudentProgress,
    CourseEnrollment,
    Certificate,
    AIChallenge,
    UserActivityLog,
    StudySchedule,
    StudentGoal,
    TeacherGroup,
    GroupTeacher,
    AIChallengeCache,
    GroupStudent,
    TeacherAssignment,
    TeacherAssignmentRubric,
    AssignmentSubmission,
    AssignmentSubmissionGrade,
    AssignmentClassComment,
    Notification,
    AIChatHistory,
    Payment,
    CoinTransactionLog,
    DailyLeaderboardReward,
    ShopItem,
    UserPurchase,
    UserFavorite,
    CartItem,
    PremiumSubscription,
    CourseApplication,
    AddStudentTask,
    TeacherMaterial,
    TeacherQuestion,
    TeacherQuestionAnswer,
    TeacherQuestionClassComment,
    CourseReview,
    CommunityPost,
    CommunityPostLike,
    TopicNote,
    TopicSynopsisSubmission,
    CourseFeedPost,
    StudentProfile,
    MaterialPrivateComment,
    SupportTicket,
)

# Порядок не критичен при session_replication_role = replica, но оставляем «родители → дети» для ясности.
MIGRATION_MODELS: list = [
    User,
    CourseCategory,
    Course,
    CourseModule,
    CourseTopic,
    Test,
    TestQuestion,
    StudentProgress,
    CourseEnrollment,
    Certificate,
    AIChallenge,
    UserActivityLog,
    StudySchedule,
    StudentGoal,
    TeacherGroup,
    GroupTeacher,
    AIChallengeCache,
    GroupStudent,
    TeacherAssignment,
    TeacherAssignmentRubric,
    AssignmentSubmission,
    AssignmentSubmissionGrade,
    AssignmentClassComment,
    AssignmentPrivateComment,
    Notification,
    AIChatHistory,
    Payment,
    CoinTransactionLog,
    DailyLeaderboardReward,
    ShopItem,
    UserPurchase,
    UserFavorite,
    CartItem,
    PremiumSubscription,
    CourseApplication,
    AddStudentTask,
    TeacherMaterial,
    TeacherQuestion,
    TeacherQuestionAnswer,
    TeacherQuestionClassComment,
    CourseReview,
    CommunityPost,
    CommunityPostLike,
    TopicNote,
    TopicSynopsisSubmission,
    CourseFeedPost,
    StudentProfile,
    MaterialPrivateComment,
    SupportTicket,
]


def _resolve_sqlite_url(url: str) -> str:
    """Как в app.core.config: относительный sqlite путь от корня backend."""
    if not url.startswith("sqlite:///./") and not (url.startswith("sqlite:///") and not url.startswith("sqlite:////")):
        return url
    path = url.replace("sqlite:///./", "").replace("sqlite:///", "")
    if path.startswith("/"):
        return f"sqlite:///{path}"
    abs_path = (_BACKEND_ROOT / path).resolve()
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{abs_path}"


def _pg_table_names() -> list[str]:
    return [m.__tablename__ for m in MIGRATION_MODELS]


def _postgres_has_any_data(pg_session: Session) -> bool:
    try:
        n = pg_session.execute(text("SELECT COUNT(*) FROM users")).scalar()
        return (n or 0) > 0
    except Exception:
        return False


def _truncate_all_postgres(pg_session: Session) -> None:
    names = _pg_table_names()
    # Одна команда: CASCADE снимает зависимости FK
    quoted = ", ".join(f'"{n}"' for n in names)
    pg_session.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
    pg_session.commit()


def _sync_sequences(pg_session: Session, pg_engine) -> None:
    insp = inspect(pg_engine)
    for model in MIGRATION_MODELS:
        table_name = model.__tablename__
        if not insp.has_table(table_name):
            continue
        pk = list(model.__table__.primary_key.columns)
        if len(pk) != 1:
            continue
        col = pk[0].name
        try:
            seq = pg_session.execute(
                text("SELECT pg_get_serial_sequence(:tbl, :col)"),
                {"tbl": table_name, "col": col},
            ).scalar()
            if not seq:
                continue
            max_id = pg_session.execute(
                text(f'SELECT MAX("{col}") FROM "{table_name}"')
            ).scalar()
            if max_id is None:
                continue  # пустая таблица — оставляем sequence по умолчанию
            pg_session.execute(
                text(f'SELECT setval(:seq, :max_id)'),
                {"seq": seq, "max_id": int(max_id)},
            )
        except Exception:
            continue
    pg_session.commit()


def _sqlite_column_names(sqlite_insp, table_name: str) -> set[str]:
    if not sqlite_insp.has_table(table_name):
        return set()
    return {c["name"] for c in sqlite_insp.get_columns(table_name)}


# Columns declared as JSON in the model — values may arrive as plain strings
# from SQLite (e.g. '[]' or '{"key": "val"}').  Parse them so Postgres stores
# them as proper JSON arrays/objects, not as double-encoded JSON strings.
from sqlalchemy.types import JSON as _SA_JSON

def _json_column_names(model) -> set[str]:
    """Return column names declared with a JSON type."""
    return {
        c.name
        for c in model.__table__.columns
        if isinstance(c.type, _SA_JSON)
    }

def _maybe_parse_json(value):
    """If *value* is a string that looks like JSON array/object, parse it."""
    if not isinstance(value, str):
        return value
    s = value.strip()
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}")):
        try:
            return _json.loads(s)
        except (ValueError, _json.JSONDecodeError):
            pass
    return value


def _copy_rows_sqlite_compat(
    sqlite_db: Session,
    postgres_db: Session,
    model,
    sqlite_cols: set[str],
) -> int:
    """
    Копирует строки без ORM SELECT по SQLite: старые БД могут не иметь колонок,
    которые уже есть в модели (например topic_synopsis_submissions.grade).
    JSON-столбцы парсятся из строк (SQLite хранит JSON как TEXT).
    """
    table_name = model.__tablename__
    model_col_names = [c.name for c in model.__table__.columns]
    select_cols = [n for n in model_col_names if n in sqlite_cols]
    if not select_cols:
        return 0
    json_cols = _json_column_names(model)
    quoted = ", ".join(f'"{c}"' for c in select_cols)
    rows = sqlite_db.execute(text(f'SELECT {quoted} FROM "{table_name}"')).mappings().all()
    for row in rows:
        row_dict = dict(row)
        data = {c.name: row_dict.get(c.name) for c in model.__table__.columns}
        # Parse string-encoded JSON values so Postgres stores proper JSON types
        for col_name in json_cols:
            if col_name in data and data[col_name] is not None:
                data[col_name] = _maybe_parse_json(data[col_name])
        postgres_db.add(model(**data))
    return len(rows)


def migrate(sqlite_url: str, postgres_url: str, *, force: bool) -> bool:
    sqlite_url = _resolve_sqlite_url(sqlite_url)
    print(f"Источник (SQLite): {sqlite_url}")
    print(f"Назначение (PostgreSQL): {postgres_url.split('@')[-1] if '@' in postgres_url else postgres_url}")

    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    postgres_engine = create_engine(postgres_url, pool_pre_ping=True)

    # Схема в Postgres
    print("Создание таблиц в PostgreSQL (create_all)...")
    Base.metadata.create_all(postgres_engine)

    SqliteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)

    sqlite_db: Session = SqliteSession()
    postgres_db: PostgresSession = PostgresSession()

    try:
        if _postgres_has_any_data(postgres_db) and not force:
            print(
                "\nОШИБКА: в PostgreSQL уже есть данные (таблица users не пуста).\n"
                "Чтобы перезаписать, запустите с флагом --force (все текущие данные в Postgres будут удалены)."
            )
            return False

        if force and _postgres_has_any_data(postgres_db):
            print("Очистка таблиц PostgreSQL (--force)...")
            _truncate_all_postgres(postgres_db)

        print("Режим вставки: session_replication_role = replica (FK временно не проверяются)")
        postgres_db.execute(text("SET session_replication_role = 'replica'"))

        sinsp = inspect(sqlite_engine)
        for model in MIGRATION_MODELS:
            table_name = model.__tablename__
            if not sinsp.has_table(table_name):
                print(f"  Пропуск (нет в SQLite): {table_name}")
                continue

            sqlite_cols = _sqlite_column_names(sinsp, table_name)
            n = _copy_rows_sqlite_compat(sqlite_db, postgres_db, model, sqlite_cols)
            postgres_db.commit()
            print(f"  {table_name}: {n} строк")

        postgres_db.execute(text("SET session_replication_role = 'origin'"))
        postgres_db.commit()

        print("Синхронизация sequences (SERIAL)...")
        _sync_sequences(postgres_db, postgres_engine)

        print("\nГотово: миграция завершена успешно.")
        return True

    except Exception as e:
        print(f"\nОШИБКА: {e}")
        postgres_db.rollback()
        raise
    finally:
        sqlite_db.close()
        postgres_db.close()


def main() -> None:
    p = argparse.ArgumentParser(description="SQLite → PostgreSQL, перенос данных LMS")
    p.add_argument(
        "--sqlite-url",
        default=os.environ.get("SQLITE_URL", "sqlite:///./education.db"),
        help="URL SQLite (по умолчанию SQLITE_URL или ./education.db)",
    )
    p.add_argument(
        "--postgres-url",
        default=os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL"),
        help="URL PostgreSQL (или переменные POSTGRES_URL / DATABASE_URL)",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="Очистить таблицы в PostgreSQL перед копированием (если там уже были данные)",
    )
    args = p.parse_args()

    if not args.postgres_url:
        print("Укажите --postgres-url или переменную окружения POSTGRES_URL / DATABASE_URL.")
        sys.exit(1)

    ok = migrate(args.sqlite_url, args.postgres_url, force=args.force)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
