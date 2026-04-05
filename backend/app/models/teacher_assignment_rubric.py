from sqlalchemy import Column, Integer, String, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class TeacherAssignmentRubric(Base):
    __tablename__ = "teacher_assignment_rubrics"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("teacher_assignments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    max_points = Column(Numeric(5, 2), nullable=False)
    description = Column(Text, nullable=True)
    levels_json = Column(Text, nullable=True)  # JSON: [{"text": str, "points": float}, ...]

    assignment = relationship("TeacherAssignment", back_populates="rubric_criteria")
    submission_grades = relationship(
        "AssignmentSubmissionGrade",
        back_populates="criterion",
        cascade="all, delete-orphan",
        foreign_keys="AssignmentSubmissionGrade.criterion_id",
    )
