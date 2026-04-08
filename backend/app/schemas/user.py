from datetime import date, datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    photo_url: str | None = None
    description: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    city: str | None = None
    address: str | None = None

    # Teacher profile fields (optional; used when role == "teacher")
    gender: str | None = None
    identity_card: str | None = None
    iin: str | None = None
    # Curator profile fields (teacher role)
    curated_courses: list[str] | None = None
    consultation_schedule: list[dict] | dict | None = None
    consultation_location: str | None = None
    can_view_performance: bool | None = None
    can_message_students: bool | None = None
    can_view_attendance: bool | None = None
    can_call_parent_teacher_meetings: bool | None = None
    can_create_group_announcements: bool | None = None
    # Parent profile fields (optional; used when role == "parent")
    work_place: str | None = None
    kinship_degree: str | None = None
    educational_process_role: str | None = None
    education: str | None = None
    academic_degree: str | None = None
    email_work: EmailStr | None = None
    phone_work: str | None = None
    office: str | None = None
    reception_hours: str | None = None
    employee_number: str | None = None
    position: str | None = None
    department: str | None = None
    hire_date: date | None = None
    employment_status: str | None = None
    academic_interests: str | None = None
    teaching_hours: str | None = None
    subjects_taught: list[str] | None = None
    student_counts: list[int] | None = None
    status: str | None = None
    interface_language: str | None = None

    # Admin profile fields (optional; used when role == "admin")
    education_level: str | None = None
    # Stored profile data can contain synthetic domains like example.test.
    email_personal: str | None = None
    system_role: str | None = None
    permissions: list[str] | None = None
    areas_of_responsibility: list[str] | None = None
    can_create_users: bool | None = None
    can_delete_users: bool | None = None
    can_edit_courses: bool | None = None
    can_view_analytics: bool | None = None
    can_configure_system: bool | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"
    photo_url: str | None = None
    description: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    city: str | None = None
    address: str | None = None
    parent_id: int | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    photo_url: str | None = None
    description: str | None = None
    password: str | None = None
    parent_id: int | None = None
    phone: str | None = None
    birth_date: date | None = None
    city: str | None = None
    address: str | None = None

    # Teacher profile fields (optional; used when role == "teacher")
    gender: str | None = None
    identity_card: str | None = None
    iin: str | None = None
    # Curator profile fields (teacher role)
    curated_courses: list[str] | None = None
    consultation_schedule: list[dict] | dict | None = None
    consultation_location: str | None = None
    can_view_performance: bool | None = None
    can_message_students: bool | None = None
    can_view_attendance: bool | None = None
    can_call_parent_teacher_meetings: bool | None = None
    can_create_group_announcements: bool | None = None
    # Parent profile fields (optional; used when role == "parent")
    work_place: str | None = None
    kinship_degree: str | None = None
    educational_process_role: str | None = None
    education: str | None = None
    academic_degree: str | None = None
    email_work: EmailStr | None = None
    phone_work: str | None = None
    office: str | None = None
    reception_hours: str | None = None
    employee_number: str | None = None
    position: str | None = None
    department: str | None = None
    hire_date: date | None = None
    employment_status: str | None = None
    academic_interests: str | None = None
    teaching_hours: str | None = None
    subjects_taught: list[str] | None = None
    student_counts: list[int] | None = None
    status: str | None = None
    interface_language: str | None = None

    # Admin profile fields (optional; used when role == "admin")
    education_level: str | None = None
    email_personal: str | None = None
    system_role: str | None = None
    permissions: list[str] | None = None
    areas_of_responsibility: list[str] | None = None
    can_create_users: bool | None = None
    can_delete_users: bool | None = None
    can_edit_courses: bool | None = None
    can_view_analytics: bool | None = None
    can_configure_system: bool | None = None


class UserResponse(UserBase):
    id: int
    parent_id: int | None = None
    points: int = 0
    is_premium: int = 0
    is_approved: bool = True
    has_group_access: bool | None = None  # для студента: True если есть GroupStudent
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class UserResponseWithToken(UserResponse):
    access_token: str


class CourseInfo(BaseModel):
    id: int
    title: str


class ChildInfo(BaseModel):
    id: int
    full_name: str
    email: str
    courses: list[CourseInfo] = []
    group_name: str | None = None
    teacher_name: str | None = None
    courses_count: int = 0
    completed_courses_count: int = 0


class RelatedUserInfo(BaseModel):
    id: int
    full_name: str
    email: str
    role: str


class ParentInfo(BaseModel):
    id: int
    full_name: str
    email: str


class UserWithRelationsResponse(UserResponse):
    parent: ParentInfo | None = None
    children: list[ChildInfo] | None = None
    students: list[RelatedUserInfo] | None = None
    teachers_curators: list[RelatedUserInfo] | None = None
    groups: list[str] | None = None
