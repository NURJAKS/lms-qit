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
    UPLOAD_DIR: str = "./uploads"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 24 * 60  # 24 hours
    PREMIUM_PRICE_TENGE: int = 199999  # цена Premium в тенге
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    # Публичный URL фронта (ссылки в письмах: подтверждение покупки, вход)
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"
    DEBUG: bool = True  # Set to False in production
    # Явный course_id для AI Challenge (трек Web), если название в БД не совпадает с seed
    AI_CHALLENGE_WEB_COURSE_ID: int | None = None
    # Явный course_id для AI Challenge (трек Информатика / общая ИТ)
    AI_CHALLENGE_INFORMATICS_COURSE_ID: int | None = None
    # Явный course_id для AI Challenge (трек «Основы кибербезопасности»)
    AI_CHALLENGE_CYBER_COURSE_ID: int | None = None
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

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
