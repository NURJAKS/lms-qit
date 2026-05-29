from sqlalchemy import Column, Integer, Boolean, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StudySchedule(Base):
    __tablename__ = "study_schedule"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"))
    topic_id = Column(Integer, ForeignKey("course_topics.id", ondelete="CASCADE"))
    scheduled_date = Column(Date, nullable=False)
    is_completed = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="study_schedules")
    course = relationship("Course")
    topic = relationship("CourseTopic", back_populates="study_schedules")
