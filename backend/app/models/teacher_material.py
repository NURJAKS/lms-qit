from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeacherMaterial(Base):
    __tablename__ = "teacher_materials"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(Integer, ForeignKey("course_topics.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    description = Column(Text)  # HTML
    video_urls = Column(Text)  # JSON array
    image_urls = Column(Text)  # JSON array
    attachment_urls = Column(Text)  # JSON array of file URLs
    attachment_links = Column(Text)  # JSON array of external links
    is_supplementary = Column(Boolean, nullable=False, default=False)  # доп. материал
    target_student_ids = Column(Text, nullable=True)  # JSON array of user IDs, if null then for all group
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    group = relationship("TeacherGroup", back_populates="materials")
    course = relationship("Course", back_populates="teacher_materials")
    topic = relationship("CourseTopic", back_populates="teacher_materials")
