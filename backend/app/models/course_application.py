from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CourseApplication(Base):
    __tablename__ = "course_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50))
    city = Column(String(100))
    # Дополнительные данные студента
    student_birth_date = Column(Date, nullable=True)
    student_age = Column(Integer, nullable=True)
    student_iin = Column(String(30), nullable=True)
    parent_email = Column(String(255))
    parent_full_name = Column(String(255))
    parent_phone = Column(String(50))
    parent_city = Column(String(100))
    # Дополнительные данные родителя
    parent_birth_date = Column(Date, nullable=True)
    parent_age = Column(Integer, nullable=True)
    parent_iin = Column(String(30), nullable=True)
    confirmation_token = Column(String(100), nullable=True, unique=True, index=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="course_applications", foreign_keys=[user_id])
    course = relationship("Course", back_populates="course_applications")
