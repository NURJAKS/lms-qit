from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

_connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    _connect_args["check_same_thread"] = False
_engine_kwargs = {"connect_args": _connect_args}
if "postgresql" in settings.DATABASE_URL:
    _engine_kwargs["pool_pre_ping"] = True
engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
