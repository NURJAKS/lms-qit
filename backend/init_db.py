"""Create tables and seed initial data."""
from app.core.database import engine, Base
from app.models import *  # noqa: F401 - register all models

Base.metadata.create_all(bind=engine)
