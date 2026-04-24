from pydantic import BaseModel


class TestQuestionBase(BaseModel):
    question_text: str
    correct_answer: str  # a, b, c, d
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    order_number: int | None = None


class TestQuestionCreate(TestQuestionBase):
    test_id: int


class TestQuestionUpdate(BaseModel):
    question_text: str | None = None
    correct_answer: str | None = None
    option_a: str | None = None
    option_b: str | None = None
    option_c: str | None = None
    option_d: str | None = None
    order_number: int | None = None


class TestQuestionResponse(TestQuestionBase):
    id: int
    test_id: int

    class Config:
        from_attributes = True


class TestQuestionForStudent(BaseModel):
    """Вопрос без правильного ответа (для прохождения теста)."""
    id: int
    test_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    order_number: int | None = None

    class Config:
        from_attributes = True


class TestBase(BaseModel):
    title: str
    passing_score: int = 70
    question_count: int = 10
    is_final: bool = False
    time_limit_seconds: int | None = None


class TestCreate(TestBase):
    topic_id: int | None = None
    course_id: int


class TestUpdate(BaseModel):
    title: str | None = None
    passing_score: int | None = None
    question_count: int | None = None
    is_final: bool | None = None
    time_limit_seconds: int | None = None


class TestResponse(TestBase):
    id: int
    topic_id: int | None = None
    course_id: int

    class Config:
        from_attributes = True


class TestSubmitAnswer(BaseModel):
    question_id: int
    answer: str  # a, b, c, d


class TestSubmitRequest(BaseModel):
    answers: list[TestSubmitAnswer]
    time_seconds: float | None = None


class TestSubmitResponse(BaseModel):
    score: float
    passed: bool
    correct_count: int
    total_count: int
    result_tier: str = "passed"  # "failed" (0-50%), "needs_review" (50-80%), "passed" (80-100%)
    recommendation_message: str | None = None
    show_supplementary_link: bool = False
