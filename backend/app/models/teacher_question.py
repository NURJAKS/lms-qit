from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeacherQuestion(Base):
    __tablename__ = "teacher_questions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False, default="single_choice")  # single_choice, open
    options = Column(Text)  # JSON array for single_choice: ["A", "B", "C"]
    correct_option = Column(String(10))  # for single_choice: "A", "B", etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    group = relationship("TeacherGroup", back_populates="questions")
    course = relationship("Course", back_populates="teacher_questions")
    answers = relationship("TeacherQuestionAnswer", back_populates="question", cascade="all, delete-orphan")


class TeacherQuestionAnswer(Base):
    __tablename__ = "teacher_question_answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("teacher_questions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text)  # for open; or selected option for single_choice
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    question = relationship("TeacherQuestion", back_populates="answers")
    student = relationship("User", foreign_keys=[student_id])
