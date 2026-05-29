from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class CommunityPostLike(Base):
    __tablename__ = "community_post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer,
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_community_post_like"),
    )

    post = relationship("CommunityPost", back_populates="likes", lazy="selectin")
    user = relationship("User", backref="community_post_likes", lazy="selectin")
