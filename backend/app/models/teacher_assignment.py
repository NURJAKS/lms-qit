from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(Integer, ForeignKey("course_topics.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    deadline = Column(DateTime(timezone=True))
    max_points = Column(Integer, default=100)
    attachment_urls = Column(Text)  # JSON array of URLs
    attachment_links = Column(Text)  # JSON array of external links
    video_urls = Column(Text)  # JSON array of video URLs (uploaded or YouTube/Vimeo)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)  # manual close by teacher
    reject_submissions_after_deadline = Column(Boolean, nullable=False, default=True)
    is_synopsis = Column(Boolean, nullable=False, default=False)
    allow_student_class_comments = Column(Boolean, nullable=False, default=True)
    allow_student_edit_submission = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", back_populates="assignments_created")
    group = relationship("TeacherGroup", back_populates="assignments")
    course = relationship("Course", back_populates="assignments")
    topic = relationship("CourseTopic", back_populates="assignments")
    test = relationship("Test", foreign_keys=[test_id])
    submissions = relationship("AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan")
    rubric_criteria = relationship("TeacherAssignmentRubric", back_populates="assignment", cascade="all, delete-orphan")
    class_comments = relationship(
        "AssignmentClassComment",
        back_populates="assignment",
        cascade="all, delete-orphan",
    )