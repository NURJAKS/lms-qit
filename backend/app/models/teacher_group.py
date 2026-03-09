from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeacherGroup(Base):
    __tablename__ = "teacher_groups"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    group_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", back_populates="taught_groups", foreign_keys=[teacher_id])
    course = relationship("Course", back_populates="teacher_groups")
    students = relationship("GroupStudent", back_populates="group", cascade="all, delete-orphan")
    assignments = relationship("TeacherAssignment", back_populates="group", cascade="all, delete-orphan")
    materials = relationship("TeacherMaterial", back_populates="group", cascade="all, delete-orphan")
    questions = relationship("TeacherQuestion", back_populates="group", cascade="all, delete-orphan")
    add_student_tasks = relationship("AddStudentTask", back_populates="group", cascade="all, delete-orphan")