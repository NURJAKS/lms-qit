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

class UserWithRelationsResponse(UserResponse):
    children: list[ChildInfo] | None = None
    students: list[RelatedUserInfo] | None = None
    teachers_curators: list[RelatedUserInfo] | None = None
    groups: list[str] | None = None
