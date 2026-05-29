from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TopicSynopsisSubmission(Base):
    """Конспект по теме (файл), видимый учителю."""

    __tablename__ = "topic_synopsis_submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(Integer, ForeignKey("course_topics.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    note_text = Column(Text)
    grade = Column(Numeric(5, 2))
    teacher_comment = Column(Text)
    graded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    graded_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", backref="topic_synopsis_submissions", foreign_keys=[user_id])
    topic = relationship("CourseTopic", backref="synopsis_submissions")
    graded_by = relationship("User", foreign_keys=[graded_by_id])
