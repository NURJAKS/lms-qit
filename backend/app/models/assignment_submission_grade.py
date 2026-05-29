from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class AssignmentSubmissionGrade(Base):
    __tablename__ = "assignment_submission_grades"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("assignment_submissions.id", ondelete="CASCADE"), nullable=False)
    criterion_id = Column(Integer, ForeignKey("teacher_assignment_rubrics.id", ondelete="CASCADE"), nullable=False)
    points = Column(Numeric(5, 2), nullable=False)

    submission = relationship("AssignmentSubmission", back_populates="rubric_grades")
    criterion = relationship("TeacherAssignmentRubric", back_populates="submission_grades")
