from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    certificate_url = Column(String(500))
    final_score = Column(Numeric(5, 2))

    user = relationship("User", back_populates="certificates")
    course = relationship("Course", back_populates="certificates")
