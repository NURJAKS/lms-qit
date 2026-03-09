from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)  # admin, director, curator, teacher, student, parent, courier
    is_approved = Column(Boolean, default=True, nullable=False)  # False = pending admin approval
    parent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    photo_url = Column(String(500))
    description = Column(Text)
    phone = Column(String(50))
    birth_date = Column(Date)
    city = Column(String(100))
    address = Column(String(500))
    points = Column(Integer, default=0)  # геймификация: очки для покупок
    is_premium = Column(Integer, default=0)  # 1 = Premium подписка
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    enrollments = relationship("CourseEnrollment", back_populates="user")
    progress = relationship("StudentProgress", back_populates="user")
    certificates = relationship("Certificate", back_populates="user")
    ai_challenges = relationship("AIChallenge", back_populates="user")
    activity_logs = relationship("UserActivityLog", back_populates="user")
    study_schedules = relationship("StudySchedule", back_populates="user")
    student_goals = relationship("StudentGoal", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    ai_chat_history = relationship("AIChatHistory", back_populates="user")
    taught_groups = relationship("TeacherGroup", back_populates="teacher", foreign_keys="TeacherGroup.teacher_id")
    assignments_created = relationship("TeacherAssignment", back_populates="teacher")
    group_memberships = relationship("GroupStudent", back_populates="student")
    assignment_submissions = relationship("AssignmentSubmission", back_populates="student")
    parent = relationship("User", remote_side=[id], backref="children", foreign_keys=[parent_id])
    course_applications = relationship("CourseApplication", back_populates="user", foreign_keys="CourseApplication.user_id", cascade="all, delete-orphan")