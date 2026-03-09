from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    image_url = Column(String(500))
    category_id = Column(Integer, ForeignKey("course_categories.id"))
    is_active = Column(Boolean, default=False)
    is_moderated = Column(Boolean, default=False)
    is_premium_only = Column(Boolean, default=False)
    price = Column(Numeric(10, 2), default=0)
    language = Column(String(10), default="kz")
    created_by = Column(Integer, ForeignKey("users.id"))
    published_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("CourseCategory", back_populates="courses")
    modules = relationship("CourseModule", back_populates="course", order_by="CourseModule.order_number", cascade="all, delete-orphan")
    topics = relationship("CourseTopic", back_populates="course", order_by="CourseTopic.order_number", cascade="all, delete-orphan")
    tests = relationship("Test", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan")
    progress = relationship("StudentProgress", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")
    ai_challenges = relationship("AIChallenge", back_populates="course")
    teacher_groups = relationship("TeacherGroup", back_populates="course")
    assignments = relationship("TeacherAssignment", back_populates="course")
    teacher_materials = relationship("TeacherMaterial", back_populates="course", cascade="all, delete-orphan")
    teacher_questions = relationship("TeacherQuestion", back_populates="course", cascade="all, delete-orphan")
    course_applications = relationship("CourseApplication", back_populates="course", cascade="all, delete-orphan", lazy="select")