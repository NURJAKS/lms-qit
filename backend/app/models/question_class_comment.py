from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeacherQuestionClassComment(Base):
    """Class-visible discussion thread for a teacher question (same group)."""

    __tablename__ = "teacher_question_class_comments"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("teacher_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    question = relationship("TeacherQuestion", back_populates="class_comments")
    author = relationship("User", foreign_keys=[author_id])
