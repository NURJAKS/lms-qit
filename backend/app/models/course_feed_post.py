from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CourseFeedPost(Base):
    """Пост ленты курса: опрос, ивент, рекомендация (куратор/учитель)."""

    __tablename__ = "course_feed_posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=True)
    kind = Column(String(32), nullable=False, default="text")  # survey, event, recommendation, text
    title = Column(String(255), nullable=False)
    body = Column(Text)
    link_url = Column(String(500))
    active_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    author = relationship("User", foreign_keys=[author_id])
    course = relationship("Course", backref="feed_posts")
    group = relationship("TeacherGroup", foreign_keys=[group_id])
