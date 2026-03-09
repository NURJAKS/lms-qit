from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GroupStudent(Base):
    __tablename__ = "group_students"
    __table_args__ = (UniqueConstraint("group_id", "student_id", name="uq_group_student"),)

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("TeacherGroup", back_populates="students")
    student = relationship("User", back_populates="group_memberships")
