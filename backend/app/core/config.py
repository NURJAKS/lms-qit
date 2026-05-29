import secrets
from pathlib import Path

from pydantic_settings import BaseSettings

# Корень backend (где .env и education.db) — не зависит от CWD при запуске uvicorn
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _resolve_sqlite_url(url: str) -> str:
    """Если DATABASE_URL указывает на sqlite с относительным путём, разрешаем его от backend root."""
    if not url.startswith("sqlite:///./") and not url.startswith("sqlite:///"):
        return url
    # sqlite:///./education.db -> путь относительно backend/
    path = url.replace("sqlite:///./", "").replace("sqlite:///", "")
    abs_path = (_BACKEND_ROOT / path).resolve()
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{abs_path}"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/education_platform"
    SECRET_KEY: str = secrets.token_urlsafe(64)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    # OpenAI үлгілері: чат және ұсыныстар — арзан жылдам; challenge — сол класс әдепкі бойынша
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_CHALLENGE_MODEL: str = "gpt-4o-mini"
    GEMINI_MODEL: str = "gemini-2.0-flash"
    UPLOAD_DIR: str = "./uploads"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 24 * 60  # 24 сағат
    PREMIUM_PRICE_TENGE: int = 199999  # Premium бағасы теңгемен
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    # Фронттың публикалық URL-і (хаттардағы сілтемелер: сатып алуды растау, кіру)
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"
    DEBUG: bool = True  # Өндірісте False қойыңыз
    # AI Challenge үшін нақты course_id (Web трек), егер БД-дағы атау seed-пен сәйкес келмесе
    AI_CHALLENGE_WEB_COURSE_ID: int | None = None
    # AI Challenge үшін нақты course_id (Информатика / жалпы IT трек)
    AI_CHALLENGE_INFORMATICS_COURSE_ID: int | None = None
    # AI Challenge үшін нақты course_id («Киберқауіпсіздік негіздері» трек)
    AI_CHALLENGE_CYBER_COURSE_ID: int | None = None
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True
    # slowapi: бір IP-ден кіру әрекеттерінің шегі (бұрын 5/мин болды — тест кезінде тез шекке жететін)
    AUTH_LOGIN_RATELIMIT: str = "60/minute"
    AUTH_REGISTER_RATELIMIT: str = "10/minute"

    class Config:
        env_file = str(_BACKEND_ROOT / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


def _get_settings() -> Settings:
    s = Settings()
    if "sqlite" in s.DATABASE_URL:
        s.DATABASE_URL = _resolve_sqlite_url(s.DATABASE_URL)
    return s


settings = _get_settings()
