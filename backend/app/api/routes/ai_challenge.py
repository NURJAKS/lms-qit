import json
import random
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.test_question import TestQuestion
from app.models.progress import StudentProgress
from app.models.ai_challenge import AIChallenge
from app.models.notification import Notification
from app.models.course_topic import CourseTopic
from app.models.course import Course
from app.services.ai_service import get_challenge_recommendations

router = APIRouter(prefix="/challenge", tags=["ai_challenge"])

AI_LEVELS = ("beginner", "intermediate", "expert")
AI_TIME_RANGES = {
    "beginner": (3.0, 4.0),
    "intermediate": (2.0, 3.0),
    "expert": (1.2, 2.0),
}
ROUND_TIME_LIMIT = 90


def _calc_bonus_points(correct_sequence: list[bool]) -> int:
    """Бонусы: 2 подряд +1, 3 подряд +2, 4 подряд +3, 5 подряд +4."""
    total = 0
    streak = 0
    for c in correct_sequence:
        if c:
            streak += 1
            if streak >= 2:
                total += streak - 1
        else:
            streak = 0
    return total


class ChallengeStartResponse(BaseModel):
    challenge_id: int
    questions: list[dict]
    ai_times_per_question: list[float]
    round_time_limit_seconds: int
    ai_bonus_points: int


class ChallengeSubmitRequest(BaseModel):
    answers: list[dict]  # [{"question_id": int, "answer": str, "time_seconds": float}]


def _get_completed_topic_ids(db: Session, user_id: int, course_id: int) -> list[int]:
    progs = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.course_id == course_id,
        StudentProgress.is_completed == True,
    ).all()
    return [p.topic_id for p in progs if p.topic_id]


def _get_questions_from_topics(db: Session, course_id: int, topic_ids: list[int], limit: int = 5):
    from app.models.test import Test
    if not topic_ids:
        return []
    test_ids = db.query(Test.id).filter(
        Test.course_id == course_id,
        Test.topic_id.in_(topic_ids),
        Test.is_final == 0,
    ).distinct().all()
    test_ids = [t[0] for t in test_ids]
    if not test_ids:
        return []
    all_q = db.query(TestQuestion).filter(TestQuestion.test_id.in_(test_ids)).all()
    if len(all_q) <= limit:
        return all_q
    return random.sample(all_q, limit)


def _get_topic_ids_by_level(db: Session, course_id: int, base_topic_ids: list[int], ai_level: str) -> list[int]:
    """Фильтрует темы по уровню: beginner=первые 50%, expert=последние 50%, intermediate=все."""
    if ai_level == "intermediate" or not base_topic_ids:
        return base_topic_ids
    topics = db.query(CourseTopic).filter(
        CourseTopic.id.in_(base_topic_ids),
        CourseTopic.course_id == course_id,
    ).order_by(CourseTopic.order_number).all()
    n = len(topics)
    if n <= 1:
        return base_topic_ids
    half = max(1, n // 2)
    if ai_level == "beginner":
        return [t.id for t in topics[:half]]
    return [t.id for t in topics[-half:]]


def _get_all_topic_ids(db: Session, course_id: int) -> list[int]:
    return [t.id for t in db.query(CourseTopic).filter(CourseTopic.course_id == course_id).order_by(CourseTopic.order_number).all()]


GAME_MODES = ("quiz", "flashcard", "memory")


def _get_answer_text(q: TestQuestion) -> str:
    """Get the correct option text for flashcard back side."""
    key = (q.correct_answer or "a").strip().lower()
    return {"a": q.option_a, "b": q.option_b, "c": q.option_c, "d": q.option_d}.get(key, q.option_a)


class MemoryCardsResponse(BaseModel):
    cards: list[dict]


@router.get("/memory", response_model=MemoryCardsResponse)
def get_memory_cards(
    course_id: int,
    lang: str | None = None,
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    is_admin = current_user.role in ("admin", "director", "curator")
    if is_admin:
        base_topic_ids = _get_all_topic_ids(db, course_id)
    else:
        base_topic_ids = _get_completed_topic_ids(db, current_user.id, course_id)
        # Если у студента нет завершенных тем, используем все темы курса (fallback)
        if not base_topic_ids:
            base_topic_ids = _get_all_topic_ids(db, course_id)
    questions = _get_questions_from_topics(db, course_id, base_topic_ids, 4)
    if len(questions) < 4:
        raise HTTPException(status_code=400, detail="Пройдите больше тем для игры «Память».")
    questions = questions[:4]
    cards: list[dict] = []
    # TODO: lang can be used here in future to return localized question/answer texts
    for i, q in enumerate(questions):
        qid, aid = f"q{i}", f"a{i}"
        cards.append({"id": qid, "text": q.question_text, "pair_id": aid})
        cards.append({"id": aid, "text": _get_answer_text(q), "pair_id": qid})
    random.shuffle(cards)
    return MemoryCardsResponse(cards=cards)


@router.post("/start", response_model=ChallengeStartResponse)
def start_challenge(
    course_id: int,
    ai_level: str = "intermediate",
    game_mode: str = "quiz",
    lang: str | None = None,
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    if ai_level not in AI_LEVELS:
        ai_level = "intermediate"
    if game_mode not in GAME_MODES or game_mode == "memory":
        game_mode = "quiz"
    is_admin = current_user.role in ("admin", "director", "curator")
    if is_admin:
        base_topic_ids = _get_all_topic_ids(db, course_id)
    else:
        base_topic_ids = _get_completed_topic_ids(db, current_user.id, course_id)
        # Если у студента нет завершенных тем, используем все темы курса (fallback)
        if not base_topic_ids:
            base_topic_ids = _get_all_topic_ids(db, course_id)
    topic_ids = _get_topic_ids_by_level(db, course_id, base_topic_ids, ai_level)
    questions = _get_questions_from_topics(db, course_id, topic_ids, 5)
    if len(questions) < 5:
        raise HTTPException(status_code=400, detail="Пройдите больше тем, чтобы начать соревнование с AI.")
    questions = questions[:5]
    lo, hi = AI_TIME_RANGES[ai_level]
    ai_times = [round(random.uniform(lo, hi), 2) for _ in questions]
    ai_bonus = random.randint(0, 3)
    challenge = AIChallenge(
        user_id=current_user.id,
        course_id=course_id,
        ai_total_time=sum(ai_times),
        ai_correct_count=len(questions),
        user_total_time=0,
        user_correct_count=0,
        ai_level=ai_level,
        round_time_limit_seconds=ROUND_TIME_LIMIT,
        ai_bonus_points=ai_bonus,
        game_type=game_mode,
        ai_times_json=json.dumps(ai_times),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    if game_mode == "flashcard":
        q_list = [
            {
                "id": q.id,
                "question_text": q.question_text,
                "answer_text": _get_answer_text(q),
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
            }
            for q in questions
        ]
    else:
        q_list = [
            {"id": q.id, "question_text": q.question_text, "option_a": q.option_a, "option_b": q.option_b, "option_c": q.option_c, "option_d": q.option_d}
            for q in questions
        ]
    return ChallengeStartResponse(
        challenge_id=challenge.id,
        questions=q_list,
        ai_times_per_question=ai_times,
        round_time_limit_seconds=ROUND_TIME_LIMIT,
        ai_bonus_points=ai_bonus,
    )


@router.post("/{challenge_id}/submit")
def submit_challenge(
    challenge_id: int,
    body: ChallengeSubmitRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    from app.models.test import Test
    from datetime import datetime, timezone

    challenge = db.query(AIChallenge).filter(
        AIChallenge.id == challenge_id,
        AIChallenge.user_id == current_user.id,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Челлендж не найден")

    game_type = (challenge.game_type or "quiz").strip().lower()
    is_flashcard = game_type == "flashcard"

    if is_flashcard:
        ai_times = []
        try:
            ai_times = json.loads(challenge.ai_times_json or "[]")
        except (json.JSONDecodeError, TypeError):
            ai_times = []
        if len(ai_times) < len(body.answers):
            ai_times = ai_times + [3.0] * (len(body.answers) - len(ai_times))
        ai_times = ai_times[: len(body.answers)]

        user_correct = 0
        user_time = 0.0
        correct_sequence: list[bool] = []
        wrong_question_ids: list[int] = []
        q_ids = [a["question_id"] for a in body.answers]
        flash_questions = db.query(TestQuestion).filter(TestQuestion.id.in_(q_ids)).all()
        q_by_id = {q.id: q for q in flash_questions}
        for i, a in enumerate(body.answers):
            q = q_by_id.get(a["question_id"])
            correct = q and q.correct_answer.strip().lower() == (a.get("answer") or "").strip().lower()
            user_t = float(a.get("time_seconds") or 999.0)
            ai_t = float(ai_times[i]) if i < len(ai_times) else 999.0
            user_wins = correct and user_t < ai_t
            if user_wins:
                user_correct += 1
                correct_sequence.append(True)
            else:
                wrong_question_ids.append(a["question_id"])
                correct_sequence.append(False)
            user_time += user_t
        ai_correct_count = len(body.answers) - user_correct
        user_bonus = _calc_bonus_points(correct_sequence)
        overtime = False
    else:
        q_ids = [a["question_id"] for a in body.answers]
        questions = db.query(TestQuestion).filter(TestQuestion.id.in_(q_ids)).all()
        q_by_id = {q.id: q for q in questions}
        user_correct = 0
        user_time = 0.0
        correct_sequence: list[bool] = []
        wrong_question_ids: list[int] = []
        for a in body.answers:
            q = q_by_id.get(a["question_id"])
            correct = q and q.correct_answer.strip().lower() == (a.get("answer") or "").strip().lower()
            if correct:
                user_correct += 1
            else:
                wrong_question_ids.append(a["question_id"])
            correct_sequence.append(correct)
            user_time += float(a.get("time_seconds") or 0)
        ai_correct_count = challenge.ai_correct_count or 0
        user_bonus = _calc_bonus_points(correct_sequence)
        limit = challenge.round_time_limit_seconds or ROUND_TIME_LIMIT
        overtime = user_time > limit

    limit = challenge.round_time_limit_seconds or ROUND_TIME_LIMIT
    if is_flashcard:
        limit = ROUND_TIME_LIMIT
        overtime = False
        challenge.ai_correct_count = ai_correct_count

    user_total_score = user_correct + user_bonus
    ai_total_score = (challenge.ai_correct_count or 0) + (challenge.ai_bonus_points or 0)

    challenge.user_correct_count = user_correct
    challenge.user_total_time = user_time
    challenge.user_bonus_points = user_bonus
    challenge.completed_at = datetime.now(timezone.utc)

    recommendations = ""
    wrong_topics_for_links: list[dict] = []
    if wrong_question_ids:
        wrong_questions = db.query(TestQuestion).filter(TestQuestion.id.in_(wrong_question_ids)).all()
        test_ids = [q.test_id for q in wrong_questions]
        tests = db.query(Test).filter(Test.id.in_(test_ids)).all()
        topic_ids = [t.topic_id for t in tests if t.topic_id]
        topics = db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all() if topic_ids else []
        topic_titles = list({t.title for t in topics})
        seen_ids: set[int] = set()
        wrong_topics_for_links = []
        for t in topics:
            if t.id not in seen_ids:
                seen_ids.add(t.id)
                wrong_topics_for_links.append({"id": t.id, "title": t.title})
        course = db.query(Course).filter(Course.id == challenge.course_id).first()
        course_title = course.title if course else "Курс"
        recommendations = get_challenge_recommendations(topic_titles, course_title)
        challenge.recommendations = recommendations

    # Coins за победу в AI vs Student: 4+ правильных → 250, 3 правильных → 200
    if not (challenge.coins_awarded or 0):
        from app.services.coins import add_coins
        user_wins = not overtime and (
            user_total_score > ai_total_score
            or (user_total_score == ai_total_score and user_time < float(challenge.ai_total_time or 0))
        )
        if user_wins:
            if user_correct >= 4:
                add_coins(db, current_user.id, 250, f"ai_challenge_{challenge.id}")
            elif user_correct >= 3:
                add_coins(db, current_user.id, 200, f"ai_challenge_{challenge.id}")
            if user_correct >= 3:
                challenge.coins_awarded = 1
    db.commit()
    n = Notification(
        user_id=current_user.id,
        type="ai_challenge_result",
        title="AI vs Студент - нәтиже",
        message=f"Сіз {user_correct}/5 дұрыс. AI: {challenge.ai_correct_count}/5. Уақыт: сіз {user_time:.1f}с, AI {challenge.ai_total_time:.1f}с.",
        link=f"/app/ai-challenge/{challenge.course_id}",
    )
    db.add(n)
    db.commit()

    user_wins = not overtime and (
        user_total_score > ai_total_score
        or (user_total_score == ai_total_score and user_time < float(challenge.ai_total_time or 0))
    )

    n_q = len(body.answers) if body.answers else 0
    avg_time = user_time / n_q if n_q else 0
    accuracy_pct = (user_correct / n_q * 100) if n_q else 0
    ai_n = challenge.ai_correct_count or 0
    ai_time = float(challenge.ai_total_time or 0)
    ai_avg = ai_time / 5 if ai_n else 0
    ai_accuracy = (ai_n / 5 * 100) if ai_n else 0

    return {
        "user_correct": user_correct,
        "ai_correct": challenge.ai_correct_count,
        "user_time": user_time,
        "ai_time": ai_time,
        "user_bonus_points": user_bonus,
        "ai_bonus_points": challenge.ai_bonus_points or 0,
        "user_total_score": user_total_score,
        "ai_total_score": ai_total_score,
        "user_wins": user_wins,
        "overtime": overtime,
        "recommendations": recommendations,
        "round_time_limit": limit,
        "wrong_topics": wrong_topics_for_links,
        "metrics": {
            "user_speed_avg_sec": round(avg_time, 2),
            "user_accuracy_pct": round(accuracy_pct, 1),
            "user_strategy_bonus": user_bonus,
            "ai_speed_avg_sec": round(ai_avg, 2),
            "ai_accuracy_pct": round(ai_accuracy, 1),
            "ai_strategy_bonus": challenge.ai_bonus_points or 0,
        },
    }
