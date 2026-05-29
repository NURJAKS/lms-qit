from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer(auto_error=False)


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен не указан",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload["sub"]
    if isinstance(user_id, str):
        user_id = int(user_id)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Доступ к админ-панели: admin, director, curator (просмотр, контент, модерация)."""
    from app.api.permissions import can_view_admin
    if not can_view_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Требуется роль admin, director или curator.",
        )
    return current_user


def get_current_admin_or_director(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Только admin или director — управление пользователями, удаление курсов."""
    from app.api.permissions import is_admin_or_director
    if not is_admin_or_director(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Требуется роль admin или director.",
        )
    return current_user


def get_current_teacher_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role not in ("admin", "director", "curator", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён. Требуется роль преподавателя.",
        )
    return current_user
