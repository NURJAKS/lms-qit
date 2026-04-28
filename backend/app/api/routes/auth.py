from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.group_student import GroupStudent
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import (
    UserLogin,
    UserRegister,
    Token,
    RegisterResponse,
)
from app.schemas.user import UserResponse
from app.services.activity_log import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])

# Частая опечатка при входе: в БД email с «sahiev», вводят «sahlev».
_LOGIN_EMAIL_TYPOS: dict[str, str] = {
    "zhandossahlev@gmail.com": "zhandossahiev@gmail.com",
}


@router.post("/register", response_model=RegisterResponse)
@limiter.limit(settings.AUTH_REGISTER_RATELIMIT)
def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="errorRegistrationDisabled",
    )


@router.post("/login", response_model=Token)
@limiter.limit(settings.AUTH_LOGIN_RATELIMIT)
def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    email = (data.email or "").strip().lower()
    email = _LOGIN_EMAIL_TYPOS.get(email, email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errorInvalidEmailOrPassword",
        )
    log_activity(db, user.id, "login", "user", user.id, {"email": user.email})
    db.commit()
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    return Token(access_token=token)
