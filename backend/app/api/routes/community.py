from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_serializer
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.community_post import CommunityPost
from app.models.community_post_like import CommunityPostLike
from app.models.user import User

router = APIRouter(prefix="/community", tags=["community"])

CommunityTag = Literal["strategy", "tip"]


class CommunityPostCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    tag: CommunityTag


class CommunityPostUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    tag: CommunityTag | None = None


class CommunityPostAuthor(BaseModel):
    id: int
    full_name: str
    photo_url: str | None = None
    role: str
    is_premium: int = 0


class CommunityPostResponse(BaseModel):
    id: int
    text: str
    tag: CommunityTag
    created_at: datetime
    updated_at: datetime | None = None
    author: CommunityPostAuthor
    can_edit: bool
    can_delete: bool
    is_edited: bool
    like_count: int = 0
    current_user_liked: bool = False

    @field_serializer("created_at", "updated_at", when_used="json")
    def _serialize_datetime_utc(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        dt = value.astimezone(timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


def _can_manage_post(user: User, post: CommunityPost) -> bool:
    return user.id == post.user_id or user.role in ("admin", "director", "curator", "teacher")


def _serialize_post(post: CommunityPost, current_user: User) -> CommunityPostResponse:
    author = post.author
    likes = getattr(post, "likes", None) or []
    like_count = len(likes)
    current_user_liked = any(l.user_id == current_user.id for l in likes)
    return CommunityPostResponse(
        id=post.id,
        text=post.text,
        tag=post.tag,  # type: ignore[arg-type]
        created_at=post.created_at,
        updated_at=post.updated_at,
        author=CommunityPostAuthor(
            id=author.id,
            full_name=author.full_name,
            photo_url=author.photo_url,
            role=author.role,
            is_premium=getattr(author, "is_premium", 0) or 0,
        ),
        can_edit=_can_manage_post(current_user, post),
        can_delete=_can_manage_post(current_user, post),
        is_edited=bool(post.updated_at and post.updated_at > post.created_at),
        like_count=like_count,
        current_user_liked=current_user_liked,
    )


@router.get("/posts", response_model=list[CommunityPostResponse])
def list_posts(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    tag: CommunityTag | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
):
    if current_user.role == "parent":
        raise HTTPException(status_code=403, detail="errorAccessDenied")

    q = (
        db.query(CommunityPost)
        .filter(CommunityPost.is_deleted == False)  # noqa: E712
        .options(selectinload(CommunityPost.likes))
    )
    if tag:
        q = q.filter(CommunityPost.tag == tag)
    rows = q.order_by(CommunityPost.created_at.desc(), CommunityPost.id.desc()).limit(limit).all()
    return [_serialize_post(post, current_user) for post in rows]


@router.post("/posts", response_model=CommunityPostResponse)
def create_post(
    body: CommunityPostCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role == "parent":
        raise HTTPException(status_code=403, detail="errorAccessDenied")

    post = CommunityPost(
        user_id=current_user.id,
        tag=body.tag,
        text=body.text.strip(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize_post(post, current_user)


@router.post("/posts/{post_id}/like", response_model=CommunityPostResponse)
def toggle_post_like(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role == "parent":
        raise HTTPException(status_code=403, detail="errorAccessDenied")

    post = (
        db.query(CommunityPost)
        .filter(CommunityPost.id == post_id, CommunityPost.is_deleted == False)  # noqa: E712
        .options(selectinload(CommunityPost.likes))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="errorPostNotFound")

    existing = db.query(CommunityPostLike).filter(
        CommunityPostLike.post_id == post_id,
        CommunityPostLike.user_id == current_user.id,
    ).first()
    if existing:
        db.delete(existing)
    else:
        db.add(CommunityPostLike(post_id=post_id, user_id=current_user.id))
    db.commit()
    db.refresh(post)
    return _serialize_post(post, current_user)


@router.patch("/posts/{post_id}", response_model=CommunityPostResponse)
def update_post(
    post_id: int,
    body: CommunityPostUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role == "parent":
        raise HTTPException(status_code=403, detail="errorAccessDenied")

    post = db.query(CommunityPost).filter(CommunityPost.id == post_id, CommunityPost.is_deleted == False).first()  # noqa: E712
    if not post:
        raise HTTPException(status_code=404, detail="errorPostNotFound")
    if not _can_manage_post(current_user, post):
        raise HTTPException(status_code=403, detail="errorPostEditForbidden")

    if body.text is not None:
        post.text = body.text.strip()
    if body.tag is not None:
        post.tag = body.tag
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return _serialize_post(post, current_user)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.role == "parent":
        raise HTTPException(status_code=403, detail="errorAccessDenied")

    post = db.query(CommunityPost).filter(CommunityPost.id == post_id, CommunityPost.is_deleted == False).first()  # noqa: E712
    if not post:
        raise HTTPException(status_code=404, detail="errorPostNotFound")
    if not _can_manage_post(current_user, post):
        raise HTTPException(status_code=403, detail="errorPostDeleteForbidden")

    post.is_deleted = True
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
