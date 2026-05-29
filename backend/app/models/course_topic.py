from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class CourseTopic(Base):
    __tablename__ = "course_topics"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, ForeignKey("course_modules.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    order_number = Column(Integer, nullable=False)
    video_url = Column(String(500))
    video_duration = Column(Integer)  # seconds
    description = Column(Text)
    is_preview = Column(Boolean, default=False)

    course = relationship("Course", back_populates="topics")
    module = relationship("CourseModule", back_populates="topics")
    tests = relationship("Test", back_populates="topic", cascade="all, delete-orphan")
    progress = relationship("StudentProgress", back_populates="topic")
    study_schedules = relationship("StudySchedule", back_populates="topic")
    assignments = relationship("TeacherAssignment", back_populates="topic")
    teacher_materials = relationship("TeacherMaterial", back_populates="topic")
    teacher_questions = relationship("TeacherQuestion", back_populates="topic")