from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class CourseModule(Base):
    __tablename__ = "course_modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    order_number = Column(Integer, nullable=False)
    description = Column(Text)

    course = relationship("Course", back_populates="modules")
    topics = relationship("CourseTopic", back_populates="module", order_by="CourseTopic.order_number", cascade="all, delete-orphan")
