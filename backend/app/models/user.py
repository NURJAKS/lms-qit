from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)
    is_approved = Column(Boolean, default=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    photo_url = Column(String(500))
    description = Column(Text)
    phone = Column(String(50))
    birth_date = Column(Date)
    city = Column(String(100))
    address = Column(String(500))

    # Teacher profile fields (stored on users for simplicity)
    gender = Column(String(20))  # Мужской|Женский|Другое
    identity_card = Column(String(100))
    iin = Column(String(20))  # ИИН (Kazakhstan)
    # Curator-specific fields (teacher role)
    curated_courses = Column(JSON)  # array(string)
    consultation_schedule = Column(JSON)  # json: [{day,time,duration}] or object
    consultation_location = Column(String(255))
    can_view_performance = Column(Boolean, default=False)
    can_message_students = Column(Boolean, default=False)
    can_view_attendance = Column(Boolean, default=False)
    can_call_parent_teacher_meetings = Column(Boolean, default=False)
    can_create_group_announcements = Column(Boolean, default=False)
    # Parent profile fields (stored on users for simplicity)
    work_place = Column(String(255))
    kinship_degree = Column(String(20))  # Отец|Мать|Опекун|Другое
    educational_process_role = Column(String(30))  # Законный представитель|Опекун
    education = Column(String(500))
    academic_degree = Column(String(255))
    email_work = Column(String(255))
    phone_work = Column(String(50))
    office = Column(String(100))
    reception_hours = Column(String(255))
    employee_number = Column(String(100))
    position = Column(String(255))
    department = Column(String(255))
    hire_date = Column(Date)
    employment_status = Column(String(50))  # Штатный|Совместитель|Почасовой
    academic_interests = Column(Text)
    teaching_hours = Column(String(100))
    # Arrays stored as JSON (works for SQLite/Postgres)
    subjects_taught = Column(JSON)  # array(string)
    student_counts = Column(JSON)  # array(integer)
    status = Column(String(20))  # Активный|В отпуске|Неактивный
    interface_language = Column(String(20))  # Русский|Казахский|Английский

    # Admin profile fields (stored on users for simplicity)
    education_level = Column(String(255))
    email_personal = Column(String(255))
    system_role = Column(String(50))  # Суперадминистратор|Администратор факультета|Администратор кафедры
    permissions = Column(JSON)  # array(string)
    areas_of_responsibility = Column(JSON)  # array(string)
    can_create_users = Column(Boolean, default=False)
    can_delete_users = Column(Boolean, default=False)
    can_edit_courses = Column(Boolean, default=False)
    can_view_analytics = Column(Boolean, default=False)
    can_configure_system = Column(Boolean, default=False)
    points = Column(Integer, default=0)
    is_premium = Column(Integer, default=0)
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
    assignment_submissions = relationship(
        "AssignmentSubmission",
        back_populates="student",
        foreign_keys="AssignmentSubmission.student_id",
    )
    parent = relationship("User", remote_side=[id], backref="children", foreign_keys=[parent_id])
    course_applications = relationship("CourseApplication", back_populates="user", foreign_keys="CourseApplication.user_id", cascade="all, delete-orphan")