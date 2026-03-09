from sqlalchemy import Column, Integer, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    payment_confirmed = Column(Boolean, default=False)
    payment_amount = Column(Numeric(10, 2))
    access_expires_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
