from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.premium_subscription import PremiumSubscription

router = APIRouter(prefix="/premium", tags=["premium"])


@router.get("/config")
def get_premium_config():
    """Цена Premium в тенге (публичный endpoint)."""
    return {
        "price_tenge": settings.PREMIUM_PRICE_TENGE,
        "currency": "₸",
    }


@router.post("/purchase")
def purchase_premium(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Симуляция покупки Premium за тенге.
    В реальности здесь будет интеграция с платёжной системой (Kaspi, Halyk и т.д.).
    """
    if current_user.is_premium:
        return {
            "message": "У вас уже есть Premium",
            "is_premium": True,
        }
    amount = float(settings.PREMIUM_PRICE_TENGE)
    sub = PremiumSubscription(
        user_id=current_user.id,
        amount_tenge=amount,
        status="completed",
    )
    db.add(sub)
    current_user.is_premium = 1
    db.commit()
    db.refresh(current_user)
    return {
        "message": "Premium успешно активирован!",
        "is_premium": True,
        "amount_tenge": amount,
        "transaction_id": f"PREMIUM-{sub.id:08d}",
    }
