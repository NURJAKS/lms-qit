from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_admin_user
from app.core.database import get_db
from app.models.user import User
from app.models.course import Course
from app.models.course_review import CourseReview
from app.models.enrollment import CourseEnrollment

router = APIRouter(tags=["reviews"])


# --- Schemas ---
class ReviewCreate(BaseModel):
    course_id: int
    rating: int  # 1-5
    text: str | None = None


class AdminReply(BaseModel):
    admin_reply: str


# --- Student endpoints ---
@router.post("/reviews")
def create_review(
    body: ReviewCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Студент оставляет отзыв. Один отзыв на курс."""
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Рейтинг: от 1 до 5")
    # Check enrollment
    enrolled = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == current_user.id,
        CourseEnrollment.course_id == body.course_id,
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="Вы не записаны на этот курс")
    # Check if already reviewed
    existing = db.query(CourseReview).filter(
        CourseReview.user_id == current_user.id,
        CourseReview.course_id == body.course_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже оставили отзыв на этот курс")
    review = CourseReview(
        user_id=current_user.id,
        course_id=body.course_id,
        rating=body.rating,
        text=body.text,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"id": review.id, "message": "Отзыв отправлен на модерацию"}


@router.get("/reviews")
def list_approved_reviews(
    db: Annotated[Session, Depends(get_db)],
    course_id: int | None = Query(None),
    is_featured: bool | None = Query(None, description="Только избранные для лендинга"),
    limit: int = Query(100, ge=1, le=200),
):
    """Одобренные отзывы (публичные)."""
    q = db.query(CourseReview).filter(CourseReview.is_approved == True)
    if course_id:
        q = q.filter(CourseReview.course_id == course_id)
    if is_featured is True:
        q = q.filter(CourseReview.is_featured == True)
    rows = q.order_by(CourseReview.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "user_name": r.user.full_name or r.user.email if r.user else "",
            "course_title": r.course.title if r.course else "",
            "course_id": r.course_id,
            "rating": r.rating,
            "text": r.text,
            "is_featured": r.is_featured,
            "admin_reply": r.admin_reply,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/reviews/stats")
def reviews_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Статистика по отзывам (админ)."""
    total = db.query(CourseReview).count()
    pending = db.query(CourseReview).filter(CourseReview.is_approved == False).count()
    approved = db.query(CourseReview).filter(CourseReview.is_approved == True).count()
    featured = db.query(CourseReview).filter(CourseReview.is_featured == True).count()
    avg_rating = db.query(func.avg(CourseReview.rating)).scalar() or 0
    return {
        "total": total, "pending": pending, "approved": approved,
        "featured": featured, "avg_rating": round(float(avg_rating), 1),
    }


# --- Admin endpoints ---
@router.get("/admin/reviews")
def admin_list_reviews(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    status: str | None = Query(None, description="pending, approved, rejected"),
    course_id: int | None = Query(None),
):
    """Все отзывы для модерации."""
    q = db.query(CourseReview)
    if status == "pending":
        q = q.filter(CourseReview.is_approved == False)
    elif status == "approved":
        q = q.filter(CourseReview.is_approved == True)
    if course_id:
        q = q.filter(CourseReview.course_id == course_id)
    rows = q.order_by(CourseReview.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_name": r.user.full_name or r.user.email if r.user else "",
            "user_email": r.user.email if r.user else "",
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "rating": r.rating,
            "text": r.text,
            "is_approved": r.is_approved,
            "is_featured": r.is_featured,
            "admin_reply": r.admin_reply,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.put("/admin/reviews/{review_id}/approve")
def approve_review(
    review_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    review = db.query(CourseReview).filter(CourseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    review.is_approved = True
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.put("/admin/reviews/{review_id}/reject")
def reject_review(
    review_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    review = db.query(CourseReview).filter(CourseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    review.is_approved = False
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.put("/admin/reviews/{review_id}/reply")
def reply_review(
    review_id: int,
    body: AdminReply,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    review = db.query(CourseReview).filter(CourseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    review.admin_reply = body.admin_reply
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.put("/admin/reviews/{review_id}/feature")
def toggle_featured(
    review_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    review = db.query(CourseReview).filter(CourseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    review.is_featured = not review.is_featured
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "is_featured": review.is_featured}


@router.delete("/admin/reviews/{review_id}")
def delete_review(
    review_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    review = db.query(CourseReview).filter(CourseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    db.delete(review)
    db.commit()
    return {"ok": True}
