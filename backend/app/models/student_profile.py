from sqlalchemy import Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    # Основная информация (без дублей users.*)
    gender = Column(String(20), nullable=False, default="Мужской")  # Мужской|Женский|Другое
    nationality = Column(String(100), nullable=False, default="")  # string
    identity_card = Column(String(100), nullable=False, default="")  # string
    iin = Column(String(20), nullable=False, default="")  # ИИН (Kazakhstan)

    # Контактная информация (часть в users.*)
    phone_alternative = Column(String(50))  # phone
    postal_code = Column(String(20), nullable=False, default="")
    country = Column(String(80), nullable=False, default="")

    # Образовательная информация
    student_id_card_number = Column(String(50), nullable=False, default="")
    specialty = Column(String(255), nullable=False, default="")
    course = Column(Integer, nullable=False, default=1)
    group = Column(String(50), nullable=False, default="")
    study_form = Column(String(30), nullable=False, default="Очная")  # Очная|Заочная|Очно-заочная
    admission_date = Column(Date)
    graduation_date_planned = Column(Date)

    # Дополнительно
    status = Column(String(20), nullable=False, default="Активный")  # Активный|Неактивный
    interface_language = Column(String(20), nullable=False, default="Русский")  # Русский|Казахский|Английский
    timezone = Column(String(20), nullable=False, default="UTC+6")  # UTC±X

    # Legacy field required by some DB versions
    snils_inn = Column(String(20), nullable=False, default="")

    user = relationship("User", backref="student_profile", uselist=False)

