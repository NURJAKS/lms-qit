from sqlalchemy import Column, Integer, Numeric, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AIChallenge(Base):
    __tablename__ = "ai_challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    ai_total_time = Column(Numeric(10, 2))
    ai_correct_count = Column(Integer)
    user_total_time = Column(Numeric(10, 2))
    user_correct_count = Column(Integer)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    ai_level = Column(String(20), default="intermediate")  # beginner | intermediate | expert
    round_time_limit_seconds = Column(Integer, default=90)
    user_bonus_points = Column(Integer, default=0)
    ai_bonus_points = Column(Integer, default=0)
    coins_awarded = Column(Integer, default=0)  # 1 = coins already awarded for this challenge
    recommendations = Column(Text, nullable=True)
    game_type = Column(String(20), default="quiz")  # quiz | flashcard
    ai_times_json = Column(Text, nullable=True)  # JSON array of AI times per question for flashcard scoring

    user = relationship("User", back_populates="ai_challenges")
    course = relationship("Course", back_populates="ai_challenges")
