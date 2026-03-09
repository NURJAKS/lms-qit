from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.database import engine, Base
from app.core.migrations import run_migrations
from app.core.config import settings
from app.models import *  # noqa: F401 - register all models
from app.api.routes import auth, admin, applications, courses, topics, tests, progress, users, ai_bot, ai_challenge, notifications, schedule, teacher, analytics, parent, payments, assignments, shop, dashboard, premium, reviews
from app.jobs.daily_rewards import run_daily_leaderboard_rewards

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Conditionally disable docs in production
docs_kwargs = {}
if not settings.DEBUG:
    docs_kwargs = {"docs_url": None, "redoc_url": None}

app = FastAPI(title="Education Platform API", version="1.0.0", **docs_kwargs)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Слишком много запросов. Попробуйте через минуту."},
    )


# CORS from env
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables and run lightweight schema migrations
Base.metadata.create_all(bind=engine)
run_migrations()

# Daily leaderboard rewards at 00:05 (Asia/Almaty)
scheduler = BackgroundScheduler(timezone="Asia/Almaty")
scheduler.add_job(run_daily_leaderboard_rewards, "cron", hour=0, minute=5)
scheduler.start()

# Static files for uploads
uploads_path = Path(__file__).resolve().parent.parent / "uploads"
uploads_path.mkdir(parents=True, exist_ok=True)
(uploads_path / "videos").mkdir(exist_ok=True)
(uploads_path / "certificates").mkdir(exist_ok=True)
(uploads_path / "avatars").mkdir(exist_ok=True)
(uploads_path / "submissions").mkdir(exist_ok=True)
(uploads_path / "assignments").mkdir(exist_ok=True)
(uploads_path / "assignments" / "temp").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# API routes (prefix /api)
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(topics.router, prefix="/api")
app.include_router(tests.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(ai_bot.router, prefix="/api")
app.include_router(ai_challenge.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(teacher.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(parent.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(shop.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(premium.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Education Platform API", "docs": "/docs" if settings.DEBUG else None}

