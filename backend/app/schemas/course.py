from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator


class CourseCategoryBase(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None


class CourseCategoryCreate(CourseCategoryBase):
    pass


class CourseCategoryResponse(CourseCategoryBase):
    id: int

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    title: str
    description: str | None = None
    image_url: str | None = None
    category_id: int | None = None
    is_active: bool = False
    is_moderated: bool = False
    is_premium_only: bool = False
    price: Decimal = Decimal("0")
    language: str = "kz"


class CourseCreate(CourseBase):
    created_by: int | None = None


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    category_id: int | None = None
    is_active: bool | None = None
    is_moderated: bool | None = None
    is_premium_only: bool | None = None
    price: Decimal | None = None
    language: str | None = None
    published_at: datetime | None = None


class CourseResponse(CourseBase):
    id: int
    created_by: int | None = None
    published_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class CourseModuleBase(BaseModel):
    title: str
    order_number: int
    description: str | None = None


class CourseModuleCreate(CourseModuleBase):
    course_id: int


class CourseModuleResponse(CourseModuleBase):
    id: int
    course_id: int

    class Config:
        from_attributes = True


class CourseTopicBase(BaseModel):
    title: str
    order_number: int
    video_url: str | None = None
    video_duration: int | None = None
    description: str | None = None
    is_preview: bool = False

    @field_validator("is_preview", mode="before")
    @classmethod
    def _coerce_is_preview(cls, v: Any) -> bool:
        """SQLite / legacy rows may have NULL; API must still return a boolean."""
        return False if v is None else bool(v)


class CourseTopicCreate(CourseTopicBase):
    course_id: int
    module_id: int | None = None


class CourseTopicResponse(CourseTopicBase):
    id: int
    course_id: int
    module_id: int | None = None
    theory_unlocked: bool = True

    class Config:
        from_attributes = True
