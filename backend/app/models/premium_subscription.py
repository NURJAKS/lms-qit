from sqlalchemy import Column, Integer, Numeric, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PremiumSubscription(Base):
    """Покупка Premium-подписки за тенге."""

    __tablename__ = "premium_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount_tenge = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="completed")  # completed, refunded
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="premium_subscriptions")
