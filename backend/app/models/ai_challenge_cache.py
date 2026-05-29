from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class AIChallengeCache(Base):
    __tablename__ = "ai_challenge_cache"

    id = Column(Integer, primary_key=True, index=True)
    questions_hash = Column(String(500), index=True)
    ai_level = Column(String(20))
    game_mode = Column(String(20))
    response_json = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
