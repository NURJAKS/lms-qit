from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GroupTeacher(Base):
    __tablename__ = "group_teachers"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="secondary")  # primary, secondary
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("TeacherGroup", back_populates="group_teachers")
    teacher = relationship("User", backref="group_participations")
