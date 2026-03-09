import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings
from app.core.database import get_db
from app.models.group_student import GroupStudent
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import (
    UserLogin,
    UserRegister,
    Token,
    RegisterResponse,
    GoogleLoginRequest,
    GoogleLoginResponse,
    GoogleRegisterRequest,
)
from app.schemas.user import UserResponse
from app.services.activity_log import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/minute")
def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован",
        )
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    user_data = UserResponse.model_validate(user).model_dump()
    if user.role == "student":
        user_data["has_group_access"] = (
            db.query(GroupStudent).filter(GroupStudent.student_id == user.id).first() is not None
        )
    else:
        user_data["has_group_access"] = True
    return RegisterResponse(user=user_data, access_token=token)


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    log_activity(db, user.id, "login", "user", user.id, {"email": user.email})
    db.commit()
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    return Token(access_token=token)


@router.post("/google-login", response_model=GoogleLoginResponse)
@limiter.limit("5/minute")
def google_login(request: Request, data: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        # Verify the Google ID token
        # NOTE: settings.GOOGLE_CLIENT_ID must be set in the environment or config
        idinfo = id_token.verify_oauth2_token(
            data.id_token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
        )
        
        email = idinfo['email']
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            log_activity(db, user.id, "login", "user", user.id, {"email": user.email, "method": "google"})
            db.commit()
            token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
            return GoogleLoginResponse(user_exists=True, access_token=token)
        else:
            return GoogleLoginResponse(
                user_exists=False, 
                email=email, 
                full_name=idinfo.get('name', '')
            )
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )


@router.post("/google-register", response_model=RegisterResponse)
@limiter.limit("5/minute")
def google_register(request: Request, data: GoogleRegisterRequest, db: Session = Depends(get_db)):
    try:
        # Verify the token again to ensure authenticity during registration
        idinfo = id_token.verify_oauth2_token(
            data.id_token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
        )
        
        email = idinfo['email']
        full_name = idinfo.get('name', email)
        
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже зарегистрирован",
            )
            
        user = User(
            email=email,
            password_hash=get_password_hash(secrets.token_urlsafe(32)), # Random password for Google users
            full_name=full_name,
            role=data.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        log_activity(db, user.id, "register", "user", user.id, {"email": user.email, "method": "google"})
        db.commit()
        
        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
        user_data = UserResponse.model_validate(user).model_dump()
        
        # Determine group access based on role
        if user.role == "student":
            user_data["has_group_access"] = (
                db.query(GroupStudent).filter(GroupStudent.student_id == user.id).first() is not None
            )
        else:
            user_data["has_group_access"] = True
            
        return RegisterResponse(user=user_data, access_token=token)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )
