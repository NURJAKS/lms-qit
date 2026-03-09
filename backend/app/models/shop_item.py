from sqlalchemy import Column, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class ShopItem(Base):
    __tablename__ = "shop_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    price_coins = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)  # book, souvenir, cap, notebook, a4, headphones, keyboard, laptop, monitor, mouse, webcam, bag, other
    icon_name = Column(String(50))  # Lucide icon name for frontend
    image_url = Column(String(500))
    is_active = Column(Integer, default=1)  # 1=active, 0=inactive

    purchases = relationship("UserPurchase", back_populates="shop_item")
    favorites = relationship("UserFavorite", back_populates="shop_item", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="shop_item", cascade="all, delete-orphan")
