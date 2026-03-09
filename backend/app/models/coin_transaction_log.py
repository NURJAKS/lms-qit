from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class CoinTransactionLog(Base):
    __tablename__ = "coin_transaction_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Integer, nullable=False)  # positive = credit, negative = debit
    reason = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
