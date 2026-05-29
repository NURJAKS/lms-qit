from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AIChatHistory(Base):
    __tablename__ = "ai_chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"))
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    is_suspicious = Column(Boolean, default=False, nullable=False)  # Флаг подозрительного запроса
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True)  # ID теста, если запрос был во время теста
    assignment_id = Column(Integer, ForeignKey("teacher_assignments.id"), nullable=True)  # ID задания, если запрос был во время работы над заданием
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ai_chat_history")
