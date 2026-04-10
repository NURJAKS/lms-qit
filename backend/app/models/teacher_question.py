from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeacherQuestion(Base):
    __tablename__ = "teacher_questions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(Integer, ForeignKey("course_topics.id", ondelete="SET NULL"), nullable=True)
    question_text = Column(Text, nullable=False)
    description = Column(Text)  # instructions / rich HTML from teacher UI
    question_type = Column(String(20), nullable=False, default="open")  # open, single_choice
    options = Column(Text)  # JSON array for single_choice: ["A", "B", "C"]
    correct_option = Column(String(10))  # for single_choice: "A", "B", etc.
    deadline = Column(DateTime(timezone=True), nullable=True)
    max_points = Column(Integer, default=100)
    attachment_urls = Column(Text)
    attachment_links = Column(Text)
    video_urls = Column(Text)
    reject_submissions_after_deadline = Column(Boolean, nullable=False, default=True)
    allow_student_class_comments = Column(Boolean, nullable=False, default=True)
    allow_student_edit_submission = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    group = relationship("TeacherGroup", back_populates="questions")
    course = relationship("Course", back_populates="teacher_questions")
    topic = relationship("CourseTopic", back_populates="teacher_questions")
    answers = relationship("TeacherQuestionAnswer", back_populates="question", cascade="all, delete-orphan")
    class_comments = relationship(
        "TeacherQuestionClassComment",
        back_populates="question",
        cascade="all, delete-orphan",
    )


class TeacherQuestionAnswer(Base):
    __tablename__ = "teacher_question_answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("teacher_questions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text)
    grade = Column(Integer)  # 0 or 100 for single_choice, or custom for open
    teacher_comment = Column(Text)
    graded_at = Column(DateTime(timezone=True))
    coins_awarded = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    question = relationship("TeacherQuestion", back_populates="answers")
    student = relationship("User", foreign_keys=[student_id])
