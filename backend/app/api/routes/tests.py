import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.test import Test
from app.models.test_question import TestQuestion
from app.models.progress import StudentProgress
from app.models.course_topic import CourseTopic
from app.models.enrollment import CourseEnrollment
from app.models.notification import Notification
from app.models.certificate import Certificate
from app.models.course import Course
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.models.group_student import GroupStudent
from app.models.course_topic import CourseTopic
from app.schemas.test import TestResponse, TestQuestionForStudent, TestSubmitRequest, TestSubmitResponse
from app.services.coins import add_coins, has_received_coins_for_reason
from app.services.certificate_render import render_certificate_png
from app.services.topic_flow import can_take_topic_test, topic_test_gate_message
from app.api.course_access import assert_can_access_course_materials

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tests", tags=["tests"])


def _check_enrollment(db: Session, current_user: User, course_id: int) -> None:
    assert_can_access_course_materials(db, current_user, course_id)


def _check_all_topics_completed(db: Session, user_id: int, course_id: int) -> tuple[bool, int, int]:
    """Проверяет, пройдены ли все темы курса. Возвращает (all_completed, completed_count, total_count)."""
    # Получаем все темы курса
    all_topics = db.query(CourseTopic).filter(CourseTopic.course_id == course_id).all()
    
    if not all_topics:
        # Если тем нет - доступ разрешен
        return (True, 0, 0)
    
    total_count = len(all_topics)
    topic_ids = [t.id for t in all_topics]
    
    # Проверяем, какие темы пройдены
    completed_progress = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.course_id == course_id,
        StudentProgress.topic_id.in_(topic_ids),
        StudentProgress.is_completed == True,
    ).all()
    
    completed_count = len(completed_progress)
    all_completed = completed_count == total_count
    
    return (all_completed, completed_count, total_count)


def _check_all_assignments_completed(db: Session, user_id: int, course_id: int) -> tuple[bool, int, int]:
    """Проверяет, выполнены ли все задания курса. Возвращает (all_completed, completed_count, total_count)."""
    # Получаем все группы студента
    group_ids = [gs.group_id for gs in db.query(GroupStudent).filter(GroupStudent.student_id == user_id).all()]
    if not group_ids:
        # Если студент не в группах, считаем что заданий нет - доступ разрешен
        return (True, 0, 0)
    
    # Получаем все задания для курса из групп студента (исключая доп. задания)
    assignments = db.query(TeacherAssignment).filter(
        TeacherAssignment.course_id == course_id,
        TeacherAssignment.group_id.in_(group_ids),
        TeacherAssignment.is_supplementary == False,
    ).all()
    
    if not assignments:
        # Если заданий нет - доступ разрешен
        return (True, 0, 0)
    
    total_count = len(assignments)
    assignment_ids = [a.id for a in assignments]
    
    # Проверяем, какие задания выполнены (имеют оценку)
    completed_submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.student_id == user_id,
        AssignmentSubmission.assignment_id.in_(assignment_ids),
        AssignmentSubmission.grade.isnot(None),
    ).all()
    
    completed_count = len(completed_submissions)
    all_completed = completed_count == total_count
    
    return (all_completed, completed_count, total_count)


def _check_can_take_final_test(db: Session, user_id: int, course_id: int) -> tuple[bool, dict]:
    """
    Проверяет, можно ли сдавать контрольный тест курса.
    Возвращает (can_take, info_dict) где info_dict содержит детали проверки.
    """
    # Проверяем темы
    topics_completed, topics_completed_count, topics_total = _check_all_topics_completed(db, user_id, course_id)
    
    # Проверяем задания
    assignments_completed, assignments_completed_count, assignments_total = _check_all_assignments_completed(db, user_id, course_id)
    
    # Тест доступен только если все темы пройдены И все задания выполнены
    can_take = topics_completed and assignments_completed
    
    return (can_take, {
        "topics_completed": topics_completed,
        "topics_completed_count": topics_completed_count,
        "topics_total": topics_total,
        "assignments_completed": assignments_completed,
        "assignments_completed_count": assignments_completed_count,
        "assignments_total": assignments_total,
    })


@router.get("/available")
def get_available_tests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    course_id: int | None = None,
):
    """Список контрольных тестов из записанных курсов. Опционально: course_id — только тесты этого курса."""
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == current_user.id).all()
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return []
    if course_id is not None:
        if course_id not in course_ids:
            return []
        course_ids = [course_id]
    tests = db.query(Test).filter(Test.course_id.in_(course_ids), Test.is_final == 1).order_by(Test.course_id, Test.id).all()
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
    
    result = []
    for t in tests:
        can_take, info = _check_can_take_final_test(db, current_user.id, t.course_id)
        result.append({
            "id": t.id,
            "title": t.title,
            "course_id": t.course_id,
            "course_title": courses[t.course_id].title if t.course_id in courses else "",
            "is_final": bool(t.is_final),
            "passing_score": t.passing_score or 70,
            "question_count": t.question_count or 0,
            "can_take": can_take,
            "topics_completed": info["topics_completed"],
            "topics_completed_count": info["topics_completed_count"],
            "topics_total": info["topics_total"],
            "assignments_completed": info["assignments_completed_count"],
            "assignments_total": info["assignments_total"],
        })
    
    return result


@router.get("/{test_id}", response_model=TestResponse)
def get_test(
    test_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="errorTestNotFound")
    _check_enrollment(db, current_user, test.course_id)
    return test


@router.get("/{test_id}/questions", response_model=list[TestQuestionForStudent])
def get_test_questions(
    test_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    lang: str | None = None,
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="errorTestNotFound")
    _check_enrollment(db, current_user, test.course_id)
    
    # Проверяем, что все темы пройдены и все задания выполнены перед доступом к контрольному тесту
    if test.is_final:
        can_take, info = _check_can_take_final_test(db, current_user.id, test.course_id)
        if not can_take:
            reasons = []
            if not info["topics_completed"]:
                reasons.append(f"темы: {info['topics_completed_count']}/{info['topics_total']}")
            if not info["assignments_completed"]:
                reasons.append(f"задания: {info['assignments_completed_count']}/{info['assignments_total']}")
            reason_text = ", ".join(reasons) if reasons else "неизвестная причина"
            raise HTTPException(
                status_code=403,
                detail=f"Контрольный тест доступен только после прохождения всех тем курса и выполнения всех заданий. Не выполнено: {reason_text}"
            )

    if test.topic_id and not test.is_final:
        ok, reason = can_take_topic_test(db, current_user.id, test.topic_id, test.course_id)
        if not ok:
            raise HTTPException(status_code=403, detail=topic_test_gate_message(reason))
    
    questions = db.query(TestQuestion).filter(TestQuestion.test_id == test_id).order_by(TestQuestion.order_number).all()
    return [TestQuestionForStudent(id=q.id, test_id=q.test_id, question_text=q.question_text, option_a=q.option_a, option_b=q.option_b, option_c=q.option_c, option_d=q.option_d, order_number=q.order_number) for q in questions]


@router.post("/{test_id}/submit", response_model=TestSubmitResponse)
def submit_test(
    test_id: int,
    body: TestSubmitRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    lang: str | None = None,
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="errorTestNotFound")
    _check_enrollment(db, current_user, test.course_id)
    
    # Проверяем, что все темы пройдены и все задания выполнены перед сдачей контрольного теста
    if test.is_final:
        can_take, info = _check_can_take_final_test(db, current_user.id, test.course_id)
        if not can_take:
            reasons = []
            if not info["topics_completed"]:
                reasons.append(f"темы: {info['topics_completed_count']}/{info['topics_total']}")
            if not info["assignments_completed"]:
                reasons.append(f"задания: {info['assignments_completed_count']}/{info['assignments_total']}")
            reason_text = ", ".join(reasons) if reasons else "неизвестная причина"
            raise HTTPException(
                status_code=403,
                detail=f"Контрольный тест доступен только после прохождения всех тем курса и выполнения всех заданий. Не выполнено: {reason_text}"
            )

    if test.topic_id and not test.is_final:
        ok, reason = can_take_topic_test(db, current_user.id, test.topic_id, test.course_id)
        if not ok:
            raise HTTPException(status_code=403, detail=topic_test_gate_message(reason))
    questions = db.query(TestQuestion).filter(TestQuestion.test_id == test_id).all()
    q_by_id = {q.id: q for q in questions}
    correct = 0
    for a in body.answers:
        q = q_by_id.get(a.question_id)
        if q and q.correct_answer.strip().lower() == a.answer.strip().lower():
            correct += 1
    total = len(questions)
    score = (correct / total * 100) if total else 0

    # --- Three-tier scoring for topic tests ---
    # For topic tests: 0-50% = failed, 50-80% = needs_review, 80-100% = passed
    # For final tests: use existing passing_score
    if test.is_final:
        passing = test.passing_score or 70
        passed = score >= passing
        result_tier = "passed" if passed else "failed"
    else:
        if score >= 80:
            result_tier = "passed"
            passed = True
        elif score >= 50:
            result_tier = "needs_review"
            passed = False
        else:
            result_tier = "failed"
            passed = False

    # --- Build recommendation message based on tier ---
    recommendation_message = None
    show_supplementary_link = False

    if result_tier == "failed":
        show_supplementary_link = True
        recommendation_message = (
            "К сожалению, вы не набрали достаточно баллов для прохождения теста. "
            "Мы рекомендуем вам ознакомиться с дополнительными материалами по этой теме, "
            "чтобы лучше подготовиться к повторной сдаче. "
            "Не расстраивайтесь — у вас обязательно получится! "
            "Зайдите во вкладку «Доп материалы», там вы найдёте видео, конспекты, "
            "задания и другие полезные ресурсы для подготовки."
        )
    elif result_tier == "needs_review":
        show_supplementary_link = True
        recommendation_message = (
            "Неплохой результат! Вы набрали больше половины баллов, "
            "но для перехода к следующей теме нужно набрать не менее 80%. "
            "Рекомендуем повторить последние темы, а по желанию — "
            "заглянуть во вкладку «Доп материалы» для дополнительной подготовки. "
            "Вы молодец, и через время попробуйте сдать тест ещё раз — у вас обязательно получится!"
        )

    topic_id = test.topic_id
    if topic_id:
        prog = db.query(StudentProgress).filter(
            StudentProgress.user_id == current_user.id,
            StudentProgress.topic_id == topic_id,
        ).first()
        if not prog:
            topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
            if topic:
                prog = StudentProgress(
                    user_id=current_user.id,
                    course_id=test.course_id,
                    topic_id=topic_id,
                    is_completed=passed,
                    test_score=score,
                    attempts_count=1,
                )
                db.add(prog)
            else:
                prog = None
        else:
            prog.attempts_count = (prog.attempts_count or 0) + 1
            prog.test_score = score
            prog.is_completed = passed
        if prog:
            if passed:
                prog.completed_at = datetime.now(timezone.utc)
        db.commit()

    notif_type = "test_passed" if passed else "test_failed"
    notif_title = "Тест сдан!" if passed else "Тест не сдан"
    notif_msg = "Құттықтаймыз! Сіз тестті сәтті тапсырдыңыз және келесі тақырыпқа көше аласыз." if passed else "Сіз тестті тапсыра алмадыңыз. Тақырыпты қайталап, қайтадан көріңіз."
    link = f"/app/courses/{test.course_id}"
    n = Notification(user_id=current_user.id, type=notif_type, title=notif_title, message=notif_msg, link=link)
    db.add(n)

    if passed and test.is_final:
        existing_cert = db.query(Certificate).filter(
            Certificate.user_id == current_user.id,
            Certificate.course_id == test.course_id,
        ).first()
        if existing_cert:
            # Обновляем оценку если пересдал лучше
            if score > (float(existing_cert.final_score) if existing_cert.final_score else 0):
                existing_cert.final_score = score
        else:
            cert = Certificate(
                user_id=current_user.id,
                course_id=test.course_id,
                certificate_url="",
                final_score=score,
            )
            db.add(cert)
            db.flush()
            course_row = db.query(Course).filter(Course.id == test.course_id).first()
            # Полное официальное название курса из БД (например, на казахском в courses.title)
            course_title = ((course_row.title if course_row else "") or "").strip()
            student_label = (current_user.full_name or "").strip() or (current_user.email or "Студент")
            try:
                cert.certificate_url = render_certificate_png(
                    cert.id,
                    student_label,
                    course_title,
                    issued_at=datetime.now(timezone.utc),
                )
            except Exception:
                logger.exception(
                    "certificate_render_failed course_id=%s user_id=%s",
                    test.course_id,
                    current_user.id,
                )
                cert.certificate_url = "/uploads/certificates/certification-template.png"
            n_cert = Notification(
                user_id=current_user.id,
                type="certificate_issued",
                title="Сертификат берілді!",
                message=f"Сіз курсты сәтті аяқтадыңыз. Сертификатты жүктеп алыңыз.",
                link="/app/profile",
            )
            db.add(n_cert)

    # Coins за пройденный тест (шкала: 100%→500, 90%→400, 80%→300, 70%→200), один раз за тест
    if passed:
        reason = f"test_{test_id}"
        if not has_received_coins_for_reason(db, current_user.id, reason):
            if score >= 100:
                add_coins(db, current_user.id, 500, reason)
            elif score >= 90:
                add_coins(db, current_user.id, 400, reason)
            elif score >= 80:
                add_coins(db, current_user.id, 300, reason)
            elif score >= 70:
                add_coins(db, current_user.id, 200, reason)

    # +25 coins за завершение темы (Duolingo-style), один раз за topic
    if passed and topic_id:
        topic_reason = f"topic_{topic_id}"
        if not has_received_coins_for_reason(db, current_user.id, topic_reason):
            add_coins(db, current_user.id, 25, topic_reason)

    db.commit()

    return TestSubmitResponse(
        score=score,
        passed=passed,
        correct_count=correct,
        total_count=total,
        result_tier=result_tier,
        recommendation_message=recommendation_message,
        show_supplementary_link=show_supplementary_link,
    )
