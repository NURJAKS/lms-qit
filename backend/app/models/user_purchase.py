from sqlalchemy import Column, Integer, DateTime, String, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserPurchase(Base):
    __tablename__ = "user_purchases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shop_item_id = Column(Integer, ForeignKey("shop_items.id", ondelete="CASCADE"), nullable=False)
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())
    delivery_status = Column(String(50), default="pending", nullable=False)  # pending, processing, shipped, delivered, cancelled
    estimated_delivery_date = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    courier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    shop_item = relationship("ShopItem", back_populates="purchases")
    courier = relationship("User", foreign_keys=[courier_id])
