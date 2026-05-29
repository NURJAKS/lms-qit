from typing import Literal

from pydantic import BaseModel, EmailStr

from app.schemas.user import UserResponse


class UserLogin(BaseModel):
    email: str
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Literal["student", "teacher"] = "student"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse | None = None


class TokenPayload(BaseModel):
    sub: int | None = None
    email: str | None = None
    role: str | None = None


class RegisterResponse(BaseModel):
    """Ответ регистрации: пользователь и токен для немедленного входа."""
    user: UserResponse
    access_token: str
