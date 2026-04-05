from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("teacher_assignments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    submission_text = Column(Text)
    file_url = Column(String(500))
    file_urls = Column(Text)  # JSON array of URLs (up to 5)
    grade = Column(Numeric(5, 2))
    teacher_comment = Column(Text)
    student_private_comment = Column(Text)  # student ↔ teacher private note; teacher_comment is grading feedback
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    graded_at = Column(DateTime(timezone=True))
    coins_awarded = Column(Integer, default=0)  # 1 = coins already awarded for this submission

    assignment = relationship("TeacherAssignment", back_populates="submissions")
    student = relationship("User", back_populates="assignment_submissions")
    rubric_grades = relationship("AssignmentSubmissionGrade", back_populates="submission", cascade="all, delete-orphan")