from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("course_topics.id", ondelete="CASCADE"))
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    passing_score = Column(Integer, default=70)
    question_count = Column(Integer, default=10)
    is_final = Column(Integer, default=0)  # 0=False, 1=True for compatibility
    time_limit_seconds = Column(Integer)

    topic = relationship("CourseTopic", back_populates="tests")
    course = relationship("Course", back_populates="tests")
    questions = relationship("TestQuestion", back_populates="test", order_by="TestQuestion.order_number", cascade="all, delete-orphan")
