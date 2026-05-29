"""Единые веса и формула итогового рейтинга (тесты, задания учителя, курсы, активность)."""

# Сумма весов по смыслу: тесты + задания + (courses_done * COURSES_SCALE) + activity
W_AVG_SCORE = 0.40
W_AVG_ASSIGNMENT = 0.35
W_COURSES = 0.15  # умножается на courses_done * COURSES_SCALE
W_ACTIVITY = 0.10

COURSES_SCALE = 10  # как в legacy-формуле: «балл» за курс


def composite_rating(
    avg_score: float,
    avg_assignment: float,
    courses_done: int,
    activity: int,
) -> float:
    return round(
        avg_score * W_AVG_SCORE
        + avg_assignment * W_AVG_ASSIGNMENT
        + courses_done * COURSES_SCALE * W_COURSES
        + activity * W_ACTIVITY,
        2,
    )
