#!/usr/bin/env python3
"""
Сравнение числа строк SQLite vs PostgreSQL по тем же таблицам, что migrate_sqlite_to_pg.py.

Запуск из каталога backend (или из контейнера, WORKDIR /app):
  SQLITE_URL=sqlite:///./education.db DATABASE_URL=postgresql://... python scripts/compare_sqlite_pg_counts.py

Docker (локальный стек lms-local):
  docker compose -p lms-local --env-file .env.local-prod \\
    -f docker-compose.vps.yml -f docker-compose.local-prod.yml run --rm --no-deps \\
    -v "$(pwd)/backend/education.db:/tmp/edu.db:ro" \\
    -e SQLITE_URL=sqlite:////tmp/edu.db \\
    backend python scripts/compare_sqlite_pg_counts.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from migrate_sqlite_to_pg import MIGRATION_MODELS, _resolve_sqlite_url


def _count_table(engine, table: str) -> int | None:
    insp = inspect(engine)
    if not insp.has_table(table):
        return None
    with engine.connect() as conn:
        return conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()


def main() -> int:
    sqlite_url = os.environ.get("SQLITE_URL", "sqlite:///./education.db")
    pg_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not pg_url:
        print("Задайте DATABASE_URL или POSTGRES_URL (PostgreSQL).")
        return 1

    sqlite_url = _resolve_sqlite_url(sqlite_url)
    se = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    pe = create_engine(pg_url, pool_pre_ping=True)

    print(f"SQLite:    {sqlite_url}")
    print(f"Postgres:  ...@{pg_url.split('@')[-1] if '@' in pg_url else pg_url}")
    print()

    mismatches = 0
    missing_sqlite = 0
    missing_pg = 0
    for model in MIGRATION_MODELS:
        t = model.__tablename__
        ns = _count_table(se, t)
        np = _count_table(pe, t)
        if ns is None:
            missing_sqlite += 1
            print(f"  {t}: (нет в SQLite) | PG={np}")
            continue
        if np is None:
            missing_pg += 1
            print(f"  {t}: SQLite={ns} | (нет в PG)")
            mismatches += 1
            continue
        ok = "✓" if ns == np else "✗"
        if ns != np:
            mismatches += 1
        print(f"  {ok} {t}: SQLite={ns}  PG={np}")

    print()
    if mismatches == 0 and missing_pg == 0:
        print("Совпадения по существующим таблицам: OK.")
    else:
        print(f"Итого: расхождений или отсутствующих таблиц в PG: {mismatches + missing_pg}")
    if missing_sqlite:
        print(f"Таблиц нет в SQLite (нормально для старых дампов): {missing_sqlite}")
    return 0 if mismatches == 0 and missing_pg == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
