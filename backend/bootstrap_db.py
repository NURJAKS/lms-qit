"""Deterministic local DB bootstrap for fresh clones.

Usage:
  python bootstrap_db.py
"""

from __future__ import annotations

import logging
import sys

from app.core.database import Base, SessionLocal, engine
from app.core.migrations import run_migrations
from app.models import *  # noqa: F401 - register SQLAlchemy models
from app.models.user import User
import seed_data


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("bootstrap_db")


def _has_admin_user() -> bool:
    db = SessionLocal()
    try:
        return db.query(User.id).filter(User.email == "admin@edu.kz").first() is not None
    finally:
        db.close()


def main() -> int:
    logger.info("Creating missing tables...")
    Base.metadata.create_all(bind=engine)

    logger.info("Running schema compatibility migrations...")
    # Strict mode is important for reproducible bootstrap on fresh machines.
    run_migrations(strict=True)

    if _has_admin_user():
        logger.info("Seed data already exists, skipping full seed.")
        return 0

    logger.info("No seed users found, running initial seed...")
    seed_data.seed()
    logger.info("Database bootstrap completed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - runtime bootstrap guard
        logger.exception("Database bootstrap failed: %s", exc)
        raise SystemExit(1)
