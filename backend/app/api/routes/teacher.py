import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_user
from app.core.database import get_db
from app.models.user import User
from app.models.teacher_group import TeacherGroup
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.services.coins import add_coins
from app.services.export_service import generate_xlsx_response
from app.models.progress import StudentProgress
from app.models.notification import Notification
from app.models.enrollment import CourseEnrollment
from app.models.add_student_task import AddStudentTask
from app.models.teacher_assignment_rubric import TeacherAssignmentRubric
from app.models.assignment_submission_grade import AssignmentSubmissionGrade
from app.models.course_topic import CourseTopic
from app.models.course_module import CourseModule
from app.models.teacher_material import TeacherMaterial
from app.models.teacher_question import TeacherQuestion, TeacherQuestionAnswer
from app.models.test import Test
from app.models.test_question import TestQuestion

router = APIRouter(prefix="/teacher", tags=["teacher"])

ALLOWED_ASSIGNMENT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".pdf", ".doc", ".docx", ".txt"}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB for video


def _can_manage_group(user: User, group: TeacherGroup) -> bool:
    """Teacher can manage own group; admin/director/curator can manage any."""
    if user.role in ("admin", "director", "curator"):
        return True
    return group.teacher_id == user.id


def _is_assignment_closed(a: TeacherAssignment) -> bool:
    """Closed if teacher set closed_at, or deadline passed and reject_submissions_after_deadline is true."""
    from datetime import datetime, timezone
    closed_at = getattr(a, "closed_at", None)
    if closed_at is not None:
        return True
    deadline = getattr(a, "deadline", None)
    if deadline is None:
        return False
    reject = getattr(a, "reject_submissions_after_deadline", True)
    if reject is False:
        return False
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return deadline < now


def _is_teacher_question_closed(q: TeacherQuestion) -> bool:
    from datetime import datetime, timezone
    dl = getattr(q, "deadline", None)
    if dl is None:
        return False
    reject = getattr(q, "reject_submissions_after_deadline", True)
    if reject is False:
        return False
    now = datetime.now(timezone.utc)
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    return dl < now


def _question_options_list(raw: str | None) -> list:
    if not raw or not str(raw).strip():
        return []
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def _normalize_question_type_storage(qt: str | None) -> str:
    if not qt:
        return "open"
    if qt == "short_answer":
        return "open"
    if qt == "multiple_choice":
        return "single_choice"
    if qt in ("open", "single_choice"):
        return qt
    return "open"


def _normalize_question_type_api(stored: str | None) -> str:
    s = stored or "open"
    if s in ("open", "short_answer"):
        return "open"
    if s in ("single_choice", "multiple_choice"):
        return "single_choice"
    return s


class GroupCreate(BaseModel):
    course_id: int
    group_name: str


class GroupUpdate(BaseModel):
    course_id: int | None = None
    group_name: str | None = None
    is_archived: bool | None = None


class AddStudent(BaseModel):
    student_id: int


class RubricLevelCreate(BaseModel):
    text: str = ""
    points: float = 0


class RubricCriterionCreate(BaseModel):
    name: str
    max_points: float
    description: str | None = None
    levels: list[RubricLevelCreate] | None = None


class TestQuestionCreate(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str  # a, b, c, d


class AssignmentCreate(BaseModel):
    group_id: int
    course_id: int
    topic_id: int
    title: str
    description: str | None = None
    deadline: str | None = None
    max_points: int = 100
    attachment_urls: list[str] | None = None
    attachment_links: list[str] | None = None
    video_urls: list[str] | None = None
    rubric: list[RubricCriterionCreate] | None = None
    test_questions: list[TestQuestionCreate] | None = None  # for assignment with test


class AssignmentUpdate(BaseModel):
    """All fields optional for PATCH."""
    title: str | None = None
    description: str | None = None
    deadline: str | None = None
    max_points: int | None = None
    topic_id: int | None = None
    attachment_urls: list[str] | None = None
    attachment_links: list[str] | None = None
    video_urls: list[str] | None = None
    rubric: list[RubricCriterionCreate] | None = None


def _parse_rubric_levels_json(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _rubric_row_to_api(c: TeacherAssignmentRubric) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "max_points": float(c.max_points),
        "description": (c.description or "") if getattr(c, "description", None) is not None else "",
        "levels": _parse_rubric_levels_json(getattr(c, "levels_json", None)),
    }


def _rubric_levels_json_from_create(levels: list[RubricLevelCreate] | None) -> str | None:
    if not levels:
        return None
    cleaned = [{"text": (lv.text or "").strip(), "points": float(lv.points)} for lv in levels]
    return json.dumps(cleaned, ensure_ascii=False)


def _validate_rubric_max_matches_levels(c: RubricCriterionCreate) -> None:
    if not c.levels:
        return
    computed = max(float(lv.points) for lv in c.levels)
    if abs(computed - float(c.max_points)) > 0.01:
        raise HTTPException(
            status_code=400,
            detail="max_points must equal the highest level points when levels are provided",
        )


class MaterialCreate(BaseModel):
    group_id: int
    course_id: int
    topic_id: int | None = None
    title: str
    description: str | None = None
    video_urls: list[str] | None = None
    image_urls: list[str] | None = None
    attachment_urls: list[str] | None = None
    attachment_links: list[str] | None = None


class QuestionCreate(BaseModel):
    group_id: int
    course_id: int
    topic_id: int | None = None
    question_text: str
    question_type: str = "single_choice"  # single_choice, open
    options: list[str] | None = None
    correct_option: str | None = None


class MaterialUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    topic_id: int | None = None
    video_urls: list[str] | None = None
    image_urls: list[str] | None = None
    attachment_urls: list[str] | None = None
    attachment_links: list[str] | None = None


class QuestionUpdate(BaseModel):
    question_text: str | None = None
    question_type: str | None = None
    topic_id: int | None = None
    options: list[str] | None = None
    correct_option: str | None = None


class TopicCreate(BaseModel):
    title: str
    description: str | None = None


class TopicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class SubmissionGrade(BaseModel):
    grade: float | None = None
    teacher_comment: str | None = None
    grades: list[dict] | None = None  # [{"criterion_id": 1, "points": 15}]


@router.post("/assignments/upload")
async def upload_assignment_file(
    file: Annotated[UploadFile, File()] = ...,
    current_user: Annotated[User, Depends(get_current_teacher_user)] = ...,
):
    """Загрузить файл для вложения к заданию (временное хранение)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Файл не выбран")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_ASSIGNMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Только: {', '.join(ALLOWED_ASSIGNMENT_EXTENSIONS)}",
        )
    uploads_base = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    temp_dir = uploads_base / "assignments" / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = temp_dir / name
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 50MB)")
    dest.write_bytes(content)
    url = f"/uploads/assignments/temp/{name}"
    return {"url": url}


@router.get("/stats")
def teacher_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Статистика для дашборда учителя: группы, работы на проверку, студенты и тренды за последние 7 дней."""
    from datetime import datetime, timedelta, timezone

    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    groups = q_groups.all()
    group_ids = [g.id for g in groups]
    groups_count = len(groups)

    student_ids = set()
    for g in groups:
        for gs in g.students:
            student_ids.add(gs.student_id)
    students_count = len(student_ids)

    q_assignments = db.query(TeacherAssignment)
    if group_ids:
        q_assignments = q_assignments.filter(TeacherAssignment.group_id.in_(group_ids))
    assignment_ids = [a.id for a in q_assignments.all()]

    pending_submissions_count = 0
    if assignment_ids:
        pending_submissions_count = (
            db.query(AssignmentSubmission)
            .filter(
                AssignmentSubmission.assignment_id.in_(assignment_ids),
                AssignmentSubmission.grade == None,
            )
            .count()
        )

    # Тренды за последние 7 дней (по сравнению с предыдущими 7)
    # Используем дату создания групп и связей студент-группа как прокси для динамики.
    now = datetime.now(timezone.utc)
    today = datetime(year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc)
    start_prev = today - timedelta(days=14)

    # Собираем группы текущего учителя/админа в выбранном интервале
    groups_in_window = (
        db.query(TeacherGroup)
        .filter(TeacherGroup.created_at >= start_prev)
    )
    if not is_admin:
        groups_in_window = groups_in_window.filter(TeacherGroup.teacher_id == current_user.id)
    groups_in_window = groups_in_window.all()

    def build_daily_counts(items, get_created_at):
        """Возвращает список из максимум 14 значений по дням, начиная с start_prev."""
        buckets = [0] * 14
        for item in items:
            created_at = get_created_at(item)
            if not created_at:
                continue
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            delta_days = (created_at.date() - start_prev.date()).days
            if 0 <= delta_days < 14:
                buckets[delta_days] += 1
        # Преобразуем в кумулятивную сумму, чтобы отражать общий рост
        cumulative = []
        total = 0
        for value in buckets:
            total += value
            cumulative.append(total)
        return cumulative

    groups_trend_full = build_daily_counts(groups_in_window, lambda g: g.created_at)

    # Для студентов используем связи GroupStudent, дата добавления которых отражает добавление студента
    student_links_in_window = (
        db.query(GroupStudent)
        .filter(GroupStudent.added_at >= start_prev)
    )
    if group_ids:
        student_links_in_window = student_links_in_window.filter(GroupStudent.group_id.in_(group_ids))
    student_links_in_window = student_links_in_window.all()
    students_trend_full = build_daily_counts(student_links_in_window, lambda gs: gs.added_at)

    # Разбиваем кумулятивный массив на предыдущие 7 и текущие 7 дней
    def split_trend(full):
        if len(full) < 14:
            full = [0] * (14 - len(full)) + full
        prev = full[:7]
        current = full[7:14]
        return prev, current

    groups_trend_prev, groups_trend_current = split_trend(groups_trend_full)
    students_trend_prev, students_trend_current = split_trend(students_trend_full)

    def calc_change_percent(prev, current):
        prev_sum = sum(prev)
        curr_sum = sum(current)
        if prev_sum <= 0:
            return 100 if curr_sum > 0 else 0
        return round((curr_sum - prev_sum) / prev_sum * 100)

    groups_change_percent = calc_change_percent(groups_trend_prev, groups_trend_current)
    students_change_percent = calc_change_percent(students_trend_prev, students_trend_current)

    return {
        "groups_count": groups_count,
        "pending_submissions_count": pending_submissions_count,
        "students_count": students_count,
        "groups_trend_prev": groups_trend_prev,
        "groups_trend_current": groups_trend_current,
        "students_trend_prev": students_trend_prev,
        "students_trend_current": students_trend_current,
        "groups_change_percent": groups_change_percent,
        "students_change_percent": students_change_percent,
    }


@router.get("/recent-submissions")
def get_recent_submissions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    limit: int = 10,
):
    """Последние сдачи заданий студентами для групп текущего учителя."""
    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    group_ids = [g.id for g in q_groups.all()]
    
    if not group_ids:
        return []
        
    submissions = (
        db.query(AssignmentSubmission)
        .join(TeacherAssignment)
        .filter(TeacherAssignment.group_id.in_(group_ids))
        .order_by(AssignmentSubmission.submitted_at.desc())
        .limit(limit)
        .all()
    )
    
    return [
        {
            "id": s.id,
            "student_id": s.student_id,
            "student_name": s.student.full_name or s.student.email,
            "assignment_id": s.assignment_id,
            "assignment_title": s.assignment.title,
            "group_name": s.assignment.group.group_name,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "grade": float(s.grade) if s.grade else None,
        }
        for s in submissions
    ]


@router.get("/submissions/inbox")
def get_submissions_inbox(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    status: str | None = Query(None, description="pending (есть непроверенные) или graded (все проверены)"),
    group_id: int | None = Query(None, description="Фильтр по конкретной группе"),
):
    """
    Список заданий с агрегированными счетчиками сдач для экрана 'Непроверенные задания'.
    Возвращает именно задания (TeacherAssignment), а не отдельные сдачи.
    """
    from datetime import datetime, timezone
    from sqlalchemy import func, case, and_, or_

    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    
    if group_id:
        q_groups = q_groups.filter(TeacherGroup.id == group_id)
    
    groups = q_groups.all()
    group_ids = [g.id for g in groups]
    group_map = {g.id: g for g in groups}

    if not group_ids:
        return []

    # Подзапрос для агрегации сдач по каждому заданию
    # submitted_count: общее кол-во сдач
    # graded_count: кол-во оцененных сдач (grade is not null)
    # pending_count: кол-во неоцененных сдач (grade is null)
    stats_subq = (
        db.query(
            AssignmentSubmission.assignment_id,
            func.count(AssignmentSubmission.id).label("submitted_count"),
            func.count(AssignmentSubmission.grade).label("graded_count"),
            func.sum(case((AssignmentSubmission.grade == None, 1), else_=0)).label("pending_count")
        )
        .group_by(AssignmentSubmission.assignment_id)
        .subquery()
    )

    # Основной запрос по заданиям
    query = (
        db.query(
            TeacherAssignment,
            func.coalesce(stats_subq.c.submitted_count, 0).label("submitted_count"),
            func.coalesce(stats_subq.c.graded_count, 0).label("graded_count"),
            func.coalesce(stats_subq.c.pending_count, 0).label("pending_count")
        )
        .outerjoin(stats_subq, TeacherAssignment.id == stats_subq.c.assignment_id)
        .filter(TeacherAssignment.group_id.in_(group_ids))
    )

    # Фильтрация по статусу
    if status == "pending":
        now = datetime.now(timezone.utc)
        # Непроверенные сдачи ИЛИ срок сдачи прошёл, а работ никто не сдал
        query = query.filter(
            or_(
                stats_subq.c.pending_count > 0,
                and_(
                    func.coalesce(stats_subq.c.submitted_count, 0) == 0,
                    TeacherAssignment.deadline.isnot(None),
                    TeacherAssignment.deadline < now,
                ),
            )
        )
    elif status == "graded":
        # Все сдачи проверены (graded_count == submitted_count) и есть хотя бы одна сдача
        # Или просто где есть проверенные (согласно уточнению в задании)
        query = query.filter(
            and_(
                stats_subq.c.submitted_count > 0,
                stats_subq.c.submitted_count == stats_subq.c.graded_count
            )
        )

    # Сортировка: deadline (null в начало), затем created_at desc
    # В SQLAlchemy nullsfirst() / nullslast()
    results = query.order_by(
        TeacherAssignment.deadline.asc().nullsfirst(),
        TeacherAssignment.created_at.desc()
    ).all()

    out = []
    for a, submitted_count, graded_count, pending_count in results:
        group = group_map.get(a.group_id)
        total_students = len(group.students) if group else 0
        
        out.append({
            "id": a.id,
            "title": a.title,
            "group_id": a.group_id,
            "group_name": group.group_name if group else "",
            "course_id": a.course_id,
            "course_title": a.course.title if a.course else "",
            "deadline": a.deadline.isoformat() if a.deadline else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "submitted_count": int(submitted_count),
            "total_students": total_students,
            "graded_count": int(graded_count)
        })

    return out


@router.get("/groups")
def list_groups(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    is_admin = current_user.role in ("admin", "director", "curator")
    q = db.query(TeacherGroup)
    if not is_admin:
        q = q.filter(TeacherGroup.teacher_id == current_user.id)
    rows = q.order_by(TeacherGroup.id).all()
    return [
        {
            "id": r.id,
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "group_name": r.group_name,
            "teacher_id": r.teacher_id,
            "students_count": len(r.students),
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/groups")
def create_group(
    body: GroupCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Создать новую учебную группу (только для админов и директоров)."""
    if current_user.role not in ("admin", "director"):
        raise HTTPException(status_code=403, detail="У вас нет прав для создания групп. Это действие доступно только администраторам.")
    g = TeacherGroup(
        teacher_id=current_user.id,
        course_id=body.course_id,
        group_name=body.group_name,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return {"id": g.id, "group_name": g.group_name}


@router.patch("/groups/{group_id}")
def update_group(
    group_id: int,
    body: GroupUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Обновить данные группы (название или курс)."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    # Allow teachers to archive their own groups
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="У вас нет прав для редактирования этой группы.")
    
    if body.group_name is not None:
        g.group_name = body.group_name
    if body.course_id is not None:
        g.course_id = body.course_id
    if body.is_archived is not None:
        g.is_archived = body.is_archived
        
    db.commit()
    db.refresh(g)
    return {"id": g.id, "group_name": g.group_name}


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Удалить группу полностью."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    # Allow teachers to delete their own groups
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="У вас нет прав для удаления этой группы.")
        
    db.delete(g)
    db.commit()
    return {"ok": True, "message": "Группа удалена"}


@router.post("/groups/{group_id}/students")
def add_student_to_group(
    group_id: int,
    body: AddStudent,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == body.student_id,
        CourseEnrollment.course_id == g.course_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=400, detail="Студент не записан на этот курс")
    try:
        gs = GroupStudent(group_id=group_id, student_id=body.student_id)
        db.add(gs)
        course_title = g.course.title if g.course else ""
        notif = Notification(
            user_id=body.student_id,
            type="added_to_group",
            title="Вас добавили в группу",
            message=f"Преподаватель добавил вас в группу «{g.group_name}» по курсу «{course_title}». Теперь вам доступны все разделы платформы.",
            link="/app",
        )
        db.add(notif)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Студент уже в группе или не найден")
    return {"ok": True}


@router.get("/groups/{group_id}/students")
def list_group_students(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="Группа не найдена")
    students = [gs.student for gs in g.students]
    return [{"id": u.id, "full_name": u.full_name or "", "email": u.email or ""} for u in students]


@router.get("/groups/{group_id}/gradebook")
def get_group_gradebook(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Матрица оценок: учащиеся × задания группы (для вкладки «Оценки»)."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="Группа не найдена")

    student_ids = [gs.student_id for gs in g.students]
    users = (
        {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()}
        if student_ids
        else {}
    )
    students_out = [
        {
            "id": sid,
            "full_name": (users[sid].full_name or "") if sid in users else "",
            "email": (users[sid].email or "") if sid in users else "",
        }
        for sid in student_ids
        if sid in users
    ]
    students_out.sort(key=lambda x: ((x["full_name"] or x["email"]).lower()))

    assignments = (
        db.query(TeacherAssignment)
        .filter(TeacherAssignment.group_id == group_id)
        .order_by(TeacherAssignment.created_at.desc())
        .all()
    )
    assignment_cols = [
        {
            "id": a.id,
            "title": a.title,
            "deadline": a.deadline.isoformat() if a.deadline else None,
            "max_points": a.max_points or 100,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in assignments
    ]

    aid_list = [a.id for a in assignments]
    subs: list[AssignmentSubmission] = []
    if aid_list:
        subs = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id.in_(aid_list)).all()

    cells: dict[str, dict] = {}
    for sub in subs:
        key = f"{sub.student_id}_{sub.assignment_id}"
        cells[key] = {
            "submission_id": sub.id,
            "grade": float(sub.grade) if sub.grade is not None else None,
            "submitted": True,
            "graded": sub.grade is not None,
            "missing": False,
        }

    for sid in student_ids:
        for a in assignments:
            key = f"{sid}_{a.id}"
            if key not in cells:
                cells[key] = {
                    "submission_id": None,
                    "grade": None,
                    "submitted": False,
                    "graded": False,
                    "missing": True,
                }

    column_averages: dict[str, float | None] = {}
    for a in assignments:
        grades = [float(s.grade) for s in subs if s.assignment_id == a.id and s.grade is not None]
        column_averages[str(a.id)] = round(sum(grades) / len(grades), 1) if grades else None

    row_averages: dict[str, float | None] = {}
    for sid in student_ids:
        grades = [float(s.grade) for s in subs if s.student_id == sid and s.grade is not None]
        row_averages[str(sid)] = round(sum(grades) / len(grades), 1) if grades else None

    return {
        "students": students_out,
        "assignments": assignment_cols,
        "cells": cells,
        "column_averages": column_averages,
        "row_averages": row_averages,
    }


@router.delete("/groups/{group_id}/students/{student_id}")
def remove_student_from_group(
    group_id: int,
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    gs = db.query(GroupStudent).filter(GroupStudent.group_id == group_id, GroupStudent.student_id == student_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Студент не в этой группе")
    db.delete(gs)
    db.commit()
    return {"ok": True}


@router.get("/groups/{group_id}/progress")
def group_progress(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    course_id: int | None = None,
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="Группа не найдена")
    student_ids = [gs.student_id for gs in g.students]
    if not student_ids:
        return []
    q = db.query(StudentProgress).filter(StudentProgress.user_id.in_(student_ids))
    if course_id:
        q = q.filter(StudentProgress.course_id == course_id)
    rows = q.all()
    by_user = {}
    for r in rows:
        by_user.setdefault(r.user_id, []).append({"topic_id": r.topic_id, "is_completed": r.is_completed, "test_score": float(r.test_score) if r.test_score else None})
    return [{"user_id": uid, "progress": by_user.get(uid, [])} for uid in student_ids]


@router.get("/courses/{course_id}/students-without-group")
def students_without_group(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Студенты, записанные на курс, но не входящие ни в одну группу по этому курсу."""
    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup).filter(TeacherGroup.course_id == course_id)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    groups = q_groups.all()
    student_ids_in_groups = set()
    for g in groups:
        for gs in g.students:
            student_ids_in_groups.add(gs.student_id)

    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course_id).all()
    enrolled_ids = [e.user_id for e in enrollments]
    student_role_ids = [
        u.id for u in db.query(User).filter(User.id.in_(enrolled_ids), User.role == "student").all()
    ]
    without_group = [uid for uid in student_role_ids if uid not in student_ids_in_groups]
    if not without_group:
        return []
    users = db.query(User).filter(User.id.in_(without_group)).all()
    return [{"id": u.id, "full_name": u.full_name or "", "email": u.email or ""} for u in users]


@router.get("/add-student-tasks")
def list_add_student_tasks(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    status: str | None = Query(None, description="pending, done"),
):
    """Задачи «добавить студента в группу» для текущего учителя."""
    q = db.query(AddStudentTask).filter(AddStudentTask.teacher_id == current_user.id)
    if status:
        q = q.filter(AddStudentTask.status == status)
    rows = q.order_by(AddStudentTask.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "student_name": r.student.full_name or r.student.email if r.student else "",
            "student_email": r.student.email or "" if r.student else "",
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.group.course_id if r.group else None,
            "course_title": r.group.course.title if r.group and r.group.course else "",
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in rows
    ]


@router.post("/add-student-tasks/{task_id}/complete")
def complete_add_student_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Отметить задачу «добавить студента» как выполненную."""
    from datetime import datetime, timezone
    task = db.query(AddStudentTask).filter(
        AddStudentTask.id == task_id,
        AddStudentTask.teacher_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if task.status == "done":
        return {"ok": True, "message": "Уже выполнено"}
    gs = db.query(GroupStudent).filter(
        GroupStudent.group_id == task.group_id,
        GroupStudent.student_id == task.student_id,
    ).first()
    if not gs:
        raise HTTPException(
            status_code=400,
            detail="Сначала добавьте студента в группу",
        )
    task.status = "done"
    task.completed_at = datetime.now(timezone.utc)
    notif = Notification(
        user_id=task.manager_id,
        type="add_student_task_completed",
        title="Студент принят в группу",
        message=f"Учитель добавил студента {task.student.full_name or task.student.email} в группу «{task.group.group_name}».",
        link="/app/admin/users",
    )
    db.add(notif)
    db.commit()
    return {"ok": True}


@router.get("/assignments")
def list_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    group_id: int | None = Query(None),
):
    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    group_ids = [g.id for g in q_groups.all()]
    if not group_ids:
        return []

    # Get Assignments
    q_a = db.query(TeacherAssignment).filter(TeacherAssignment.group_id.in_(group_ids))
    if group_id:
        q_a = q_a.filter(TeacherAssignment.group_id == group_id)
    assignments = q_a.all()

    # Get Materials
    q_m = db.query(TeacherMaterial).filter(TeacherMaterial.group_id.in_(group_ids))
    if group_id:
        q_m = q_m.filter(TeacherMaterial.group_id == group_id)
    materials = q_m.all()

    # Get Questions
    q_q = db.query(TeacherQuestion).filter(TeacherQuestion.group_id.in_(group_ids))
    if group_id:
        q_q = q_q.filter(TeacherQuestion.group_id == group_id)
    questions = q_q.all()

    out = []
    
    for r in assignments:
        closed_at = getattr(r, "closed_at", None)
        out.append({
            "id": r.id,
            "type": "assignment",
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "topic_id": r.topic_id,
            "title": r.title,
            "description": r.description,
            "deadline": r.deadline.isoformat() if r.deadline else None,
            "closed_at": closed_at.isoformat() if closed_at else None,
            "is_closed": _is_assignment_closed(r),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    for r in materials:
        out.append({
            "id": r.id,
            "type": "material",
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "topic_id": r.topic_id,
            "title": r.title,
            "description": r.description,
            "deadline": None,
            "closed_at": None,
            "is_closed": False,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    for r in questions:
        out.append({
            "id": r.id,
            "type": "question",
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "topic_id": r.topic_id,
            "title": r.question_text,
            "description": f"Type: {r.question_type}",
            "deadline": None,
            "closed_at": None,
            "is_closed": False,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # Sort by created_at desc
    out.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return out


@router.post("/assignments")
def create_assignment(
    body: AssignmentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    from datetime import datetime
    g = db.query(TeacherGroup).filter(TeacherGroup.id == body.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    if body.course_id != g.course_id:
        raise HTTPException(status_code=400, detail="course_id не совпадает с курсом группы")
    topic = db.query(CourseTopic).filter(CourseTopic.id == body.topic_id, CourseTopic.course_id == body.course_id).first()
    if not topic:
        raise HTTPException(status_code=400, detail="Тема не найдена или не принадлежит курсу")
    deadline = None
    if body.deadline:
        try:
            deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
        except Exception:
            pass
    test_id_val = None
    if body.test_questions:
        test = Test(
            course_id=body.course_id,
            topic_id=body.topic_id,
            title=f"Тест: {body.title}",
            passing_score=70,
            question_count=len(body.test_questions),
        )
        db.add(test)
        db.flush()
        test_id_val = test.id
        for i, q in enumerate(body.test_questions):
            tq = TestQuestion(
                test_id=test.id,
                question_text=q.question_text,
                correct_answer=q.correct_answer.lower()[:1],
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                order_number=i + 1,
            )
            db.add(tq)
    a = TeacherAssignment(
        teacher_id=current_user.id,
        group_id=body.group_id,
        course_id=body.course_id,
        topic_id=body.topic_id,
        title=body.title,
        description=body.description,
        deadline=deadline,
        max_points=body.max_points,
        attachment_urls=json.dumps(body.attachment_urls) if body.attachment_urls else None,
        attachment_links=json.dumps(body.attachment_links) if body.attachment_links else None,
        video_urls=json.dumps(body.video_urls) if body.video_urls else None,
        test_id=test_id_val,
    )
    db.add(a)
    db.flush()
    if body.rubric:
        for c in body.rubric:
            _validate_rubric_max_matches_levels(c)
            desc = (c.description or "").strip() or None
            r = TeacherAssignmentRubric(
                assignment_id=a.id,
                name=c.name,
                max_points=c.max_points,
                description=desc,
                levels_json=_rubric_levels_json_from_create(c.levels),
            )
            db.add(r)
    db.commit()
    db.refresh(a)

    # Notify each student in the group about the new assignment
    for gs in g.students:
        notif = Notification(
            user_id=gs.student_id,
            type="assignment_created",
            title="Новое задание",
            message=f"Преподаватель создал задание «{a.title}» для группы «{g.group_name}».",
            link=f"/app/courses/{body.course_id}?tab=classwork&assignmentId={a.id}",
        )
        db.add(notif)
    db.commit()

    return {"id": a.id, "title": a.title}


@router.get("/assignments/{assignment_id}")
def get_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Полные данные задания для формы редактирования."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    rubric = [_rubric_row_to_api(c) for c in a.rubric_criteria]
    return {
        "id": a.id,
        "group_id": a.group_id,
        "course_id": a.course_id,
        "topic_id": a.topic_id,
        "title": a.title,
        "description": a.description or "",
        "deadline": a.deadline.isoformat() if a.deadline else None,
        "closed_at": a.closed_at.isoformat() if a.closed_at else None,
        "is_closed": _is_assignment_closed(a),
        "max_points": a.max_points,
        "attachment_urls": json.loads(a.attachment_urls) if a.attachment_urls else [],
        "attachment_links": json.loads(a.attachment_links) if a.attachment_links else [],
        "video_urls": json.loads(a.video_urls) if a.video_urls else [],
        "rubric": rubric,
    }


@router.patch("/assignments/{assignment_id}/close")
def close_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Закрыть задание вручную (запрет сдачи)."""
    from datetime import datetime, timezone
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    a.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "closed_at": a.closed_at.isoformat()}


@router.patch("/assignments/{assignment_id}/reopen")
def reopen_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Открыть задание снова (снять ручное закрытие)."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    a.closed_at = None
    db.commit()
    db.refresh(a)
    return {"id": a.id, "closed_at": None}


@router.patch("/assignments/{assignment_id}/deadline")
def update_assignment_deadline(
    assignment_id: int,
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Обновить дедлайн задания."""
    from datetime import datetime, timezone
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа к этому заданию")
    
    deadline = None
    if body.get("deadline"):
        raw = body["deadline"].strip()
        try:
            if "Z" not in raw and "+" not in raw and raw.count("-") >= 2:
                raw = raw + "Z"
            deadline = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    a.deadline = deadline
    db.commit()
    db.refresh(a)
    return {
        "id": a.id,
        "deadline": a.deadline.isoformat() if a.deadline else None,
    }


@router.patch("/assignments/{assignment_id}")
def update_assignment(
    assignment_id: int,
    body: AssignmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Обновить задание (название, описание, дедлайн, рубрика и т.д.). Группу и курс не меняем."""
    from datetime import datetime
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")

    if body.title is not None:
        a.title = body.title
    if body.description is not None:
        a.description = body.description
    if body.max_points is not None:
        a.max_points = body.max_points
    if body.topic_id is not None:
        topic = db.query(CourseTopic).filter(
            CourseTopic.id == body.topic_id, CourseTopic.course_id == a.course_id
        ).first()
        if not topic:
            raise HTTPException(status_code=400, detail="Тема не найдена или не принадлежит курсу")
        a.topic_id = body.topic_id
    if body.deadline is not None:
        deadline = None
        if body.deadline:
            try:
                deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(status_code=400, detail="Неверный формат даты")
        a.deadline = deadline
    if body.attachment_urls is not None:
        a.attachment_urls = json.dumps(body.attachment_urls) if body.attachment_urls else None
    if body.attachment_links is not None:
        a.attachment_links = json.dumps(body.attachment_links) if body.attachment_links else None
    if body.video_urls is not None:
        a.video_urls = json.dumps(body.video_urls) if body.video_urls else None

    if body.rubric is not None:
        db.query(TeacherAssignmentRubric).filter(
            TeacherAssignmentRubric.assignment_id == assignment_id
        ).delete()
        for c in body.rubric:
            _validate_rubric_max_matches_levels(c)
            desc = (c.description or "").strip() or None
            r = TeacherAssignmentRubric(
                assignment_id=a.id,
                name=c.name,
                max_points=c.max_points,
                description=desc,
                levels_json=_rubric_levels_json_from_create(c.levels),
            )
            db.add(r)

    db.commit()
    db.refresh(a)
    return {"id": a.id, "title": a.title}


@router.get("/assignments/{assignment_id}/submissions")
def list_submissions(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    import json
    rows = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == assignment_id).all()
    submissions_by_student = {r.student_id: r for r in rows}

    group_students = g.students
    student_ids = [gs.student_id for gs in group_students]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}

    rubric_rows = db.query(TeacherAssignmentRubric).filter(TeacherAssignmentRubric.assignment_id == assignment_id).all()
    rubric = [_rubric_row_to_api(c) for c in rubric_rows]
    submission_grades = {}
    for sg in db.query(AssignmentSubmissionGrade).filter(
        AssignmentSubmissionGrade.submission_id.in_([r.id for r in rows])
    ).all():
        submission_grades.setdefault(sg.submission_id, []).append({"criterion_id": sg.criterion_id, "points": float(sg.points)})

    submissions = []
    for sid in student_ids:
        u = users.get(sid)
        if not u:
            continue
        r = submissions_by_student.get(sid)
        if r:
            submissions.append({
                "id": r.id,
                "student_id": sid,
                "student_name": u.full_name or "",
                "submission_text": r.submission_text,
                "file_url": r.file_url,
                "file_urls": json.loads(r.file_urls) if r.file_urls else [],
                "grade": float(r.grade) if r.grade is not None else None,
                "teacher_comment": r.teacher_comment,
                "student_private_comment": getattr(r, "student_private_comment", None),
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "rubric_grades": submission_grades.get(r.id, []),
                "status": "graded" if r.grade is not None else "pending"
            })
        else:
            submissions.append({
                "id": None,
                "student_id": sid,
                "student_name": u.full_name or "",
                "submission_text": None,
                "file_url": None,
                "file_urls": [],
                "grade": None,
                "teacher_comment": None,
                "submitted_at": None,
                "rubric_grades": [],
                "status": "not_submitted"
            })

    assignment_details = {
        "title": a.title,
        "description": a.description,
        "max_points": a.max_points,
        "deadline": a.deadline.isoformat() if a.deadline else None,
        "group_name": g.group_name
    }

    return {"submissions": submissions, "rubric": rubric, "assignment": assignment_details}





@router.get("/groups/{group_id}/progress/excel")
def export_group_progress_excel(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    course_id: int | None = Query(None),
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="Группа не найдена")
    student_ids = [gs.student_id for gs in g.students]
    
    rows = []
    headers = ["User ID", "Full Name", "Email", "Topic ID", "Completed", "Score"]
    
    if student_ids:
        users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()}
        q = db.query(StudentProgress).filter(StudentProgress.user_id.in_(student_ids))
        if course_id:
            q = q.filter(StudentProgress.course_id == course_id)
        prog_rows = q.all()
        for r in prog_rows:
            u = users.get(r.user_id)
            rows.append([r.user_id, u.full_name if u else "", u.email if u else "", r.topic_id, r.is_completed, r.test_score])
    
    return generate_xlsx_response(rows, "group_progress", headers, sheet_name="Progress")


@router.put("/submissions/{submission_id}")
def grade_submission(
    submission_id: int,
    body: SubmissionGrade,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    from datetime import datetime, timezone
    sub = db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Работа не найдена")
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == sub.assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    final_grade = body.grade
    if body.grades:
        for sg in db.query(AssignmentSubmissionGrade).filter(AssignmentSubmissionGrade.submission_id == submission_id).all():
            db.delete(sg)
        total = 0
        for gd in body.grades:
            cid = gd.get("criterion_id")
            pts = gd.get("points", 0)
            crit = db.query(TeacherAssignmentRubric).filter(
                TeacherAssignmentRubric.id == cid,
                TeacherAssignmentRubric.assignment_id == a.id,
            ).first()
            if crit:
                db.add(AssignmentSubmissionGrade(submission_id=submission_id, criterion_id=cid, points=pts))
                total += float(pts)
        final_grade = total if final_grade is None else final_grade
    sub.grade = final_grade
    sub.teacher_comment = body.teacher_comment
    sub.graded_at = datetime.now(timezone.utc)
    # Tiered points system based on grade
    if final_grade is not None and not (sub.coins_awarded or 0):
        if final_grade >= 90:
            add_coins(db, sub.student_id, 500, f"assignment_{sub.id}")
        elif final_grade >= 70:
            add_coins(db, sub.student_id, 300, f"assignment_{sub.id}")
        elif final_grade >= 50:
            add_coins(db, sub.student_id, 150, f"assignment_{sub.id}")
        else:
            add_coins(db, sub.student_id, 50, f"assignment_{sub.id}")
        sub.coins_awarded = 1
    n = Notification(
        user_id=sub.student_id,
        type="assignment_graded",
        title="Задание оценено",
        message=f"Ваша работа оценена: {final_grade}. {body.teacher_comment or ''}",
        link=f"/app/courses/{a.course_id}?tab=classwork&assignmentId={a.id}",
    )
    db.add(n)
    db.commit()
    return {"ok": True}


@router.post("/assignments/{assignment_id}/mark-reviewed")
def mark_assignment_reviewed(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Отметить все сдачи задания как проверенные (поставить 0 тем, кто не сдал, или просто пометить)."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")

    # Находим всех студентов группы
    student_ids = [gs.student_id for gs in g.students]
    
    # Находим существующие сдачи
    existing_submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id
    ).all()
    submitted_student_ids = [s.student_id for s in existing_submissions]

    # 1. Для существующих сдач без оценки - ставим 0 (или можно оставить как есть, но обычно 'проверено' значит есть оценка)
    # В данном контексте, судя по UI, это просто экшн для перемещения в 'Проверенные'.
    # Чтобы задание попало в graded, у всех сдач должна быть оценка.
    for s in existing_submissions:
        if s.grade is None:
            s.grade = 0
            s.teacher_comment = "Auto-graded as reviewed"

    # 2. Для тех кто не сдал - создаем пустую сдачу с оценкой 0
    for sid in student_ids:
        if sid not in submitted_student_ids:
            new_sub = AssignmentSubmission(
                assignment_id=assignment_id,
                student_id=sid,
                grade=0,
                teacher_comment="Not submitted, marked as reviewed"
            )
            db.add(new_sub)

    db.commit()
    return {"ok": True}


@router.post("/assignments/{assignment_id}/unmark-reviewed")
def unmark_assignment_reviewed(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Отметить задание как непроверенное (сбросить оценки 0 у пустых сдач или просто сбросить оценки)."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")

    # Сбрасываем оценки у всех сдач этого задания
    submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id
    ).all()
    
    for s in submissions:
        s.grade = None
        # Если это была пустая сдача (без текста и файла), можно её вообще удалить
        if not s.submission_text and not s.file_url and not s.file_urls:
            db.delete(s)

    db.commit()
    return {"ok": True}


# ---------- Materials ----------
@router.get("/materials")
def list_materials(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    group_id: int | None = Query(None),
):
    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    group_ids = [g.id for g in q_groups.all()]
    if not group_ids:
        return []
    q = db.query(TeacherMaterial).filter(TeacherMaterial.group_id.in_(group_ids))
    if group_id:
        q = q.filter(TeacherMaterial.group_id == group_id)
    rows = q.order_by(TeacherMaterial.id.desc()).all()
    return [
        {
            "id": r.id,
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "topic_id": r.topic_id,
            "title": r.title,
            "description": r.description,
            "video_urls": json.loads(r.video_urls) if r.video_urls else [],
            "image_urls": json.loads(r.image_urls) if r.image_urls else [],
            "attachment_urls": json.loads(r.attachment_urls) if r.attachment_urls else [],
            "attachment_links": json.loads(r.attachment_links) if r.attachment_links else [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/materials")
def create_material(
    body: MaterialCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == body.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    if body.course_id != g.course_id:
        raise HTTPException(status_code=400, detail="course_id не совпадает с курсом группы")
    m = TeacherMaterial(
        teacher_id=current_user.id,
        group_id=body.group_id,
        course_id=body.course_id,
        topic_id=body.topic_id,
        title=body.title,
        description=body.description,
        video_urls=json.dumps(body.video_urls) if body.video_urls else None,
        image_urls=json.dumps(body.image_urls) if body.image_urls else None,
        attachment_urls=json.dumps(body.attachment_urls) if body.attachment_urls else None,
        attachment_links=json.dumps(body.attachment_links) if body.attachment_links else None,
    )
    db.add(m)
    for gs in g.students:
        notif = Notification(
            user_id=gs.student_id,
            type="material_created",
            title="Новый материал",
            message=f"Преподаватель добавил материал «{m.title}» для группы «{g.group_name}».",
            link="/app/materials",
        )
        db.add(notif)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "title": m.title}


# ---------- Questions ----------
@router.get("/questions")
def list_questions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    group_id: int | None = Query(None),
):
    is_admin = current_user.role in ("admin", "director", "curator")
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
    group_ids = [g.id for g in q_groups.all()]
    if not group_ids:
        return []
    q = db.query(TeacherQuestion).filter(TeacherQuestion.group_id.in_(group_ids))
    if group_id:
        q = q.filter(TeacherQuestion.group_id == group_id)
    rows = q.order_by(TeacherQuestion.id.desc()).all()
    return [
        {
            "id": r.id,
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.course_id,
            "question_text": r.question_text,
            "question_type": r.question_type,
            "options": json.loads(r.options) if r.options else [],
            "correct_option": r.correct_option,
            "answers_count": len(r.answers),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/materials/{material_id}")
def get_material(
    material_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    m = db.query(TeacherMaterial).filter(TeacherMaterial.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Материал не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return {
        "id": m.id,
        "group_id": m.group_id,
        "course_id": m.course_id,
        "topic_id": m.topic_id,
        "title": m.title,
        "description": m.description,
        "video_urls": json.loads(m.video_urls) if m.video_urls else [],
        "image_urls": json.loads(m.image_urls) if m.image_urls else [],
        "attachment_urls": json.loads(m.attachment_urls) if m.attachment_urls else [],
        "attachment_links": json.loads(m.attachment_links) if m.attachment_links else [],
    }


@router.patch("/materials/{material_id}")
def update_material(
    material_id: int,
    body: MaterialUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    m = db.query(TeacherMaterial).filter(TeacherMaterial.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Материал не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    if body.title is not None: m.title = body.title
    if body.description is not None: m.description = body.description
    if body.topic_id is not None: m.topic_id = body.topic_id
    if body.video_urls is not None: m.video_urls = json.dumps(body.video_urls)
    if body.image_urls is not None: m.image_urls = json.dumps(body.image_urls)
    if body.attachment_urls is not None: m.attachment_urls = json.dumps(body.attachment_urls)
    if body.attachment_links is not None: m.attachment_links = json.dumps(body.attachment_links)
    
    db.commit()
    return {"ok": True}


@router.get("/questions/{question_id}")
def get_question(
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return {
        "id": q.id,
        "group_id": q.group_id,
        "course_id": q.course_id,
        "question_text": q.question_text,
        "question_type": q.question_type,
        "options": json.loads(q.options) if q.options else [],
    }


@router.get("/questions/{question_id}/answers")
def list_question_answers(
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    rows = db.query(TeacherQuestionAnswer).filter(TeacherQuestionAnswer.question_id == question_id).all()
    answers_by_student = {r.student_id: r for r in rows}

    group_students = g.students
    student_ids = [gs.student_id for gs in group_students]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}

    results = []
    for sid in student_ids:
        u = users.get(sid)
        if not u: continue
        r = answers_by_student.get(sid)
        results.append({
            "id": r.id if r else None,
            "student_id": sid,
            "student_name": u.full_name or u.email,
            "answer_text": r.answer_text if r else None,
            "grade": r.grade if r else None,
            "teacher_comment": r.teacher_comment if r else None,
            "submitted_at": r.created_at.isoformat() if r and r.created_at else None,
            "status": "submitted" if r else "not_submitted"
        })

    return {
        "answers": results,
        "question": {
            "id": q.id,
            "text": q.question_text,
            "type": q.question_type,
            "options": json.loads(q.options) if q.options else [],
            "correct_option": q.correct_option,
            "group_name": g.group_name
        }
    }


@router.put("/questions/answers/{answer_id}")
def grade_question_answer(
    answer_id: int,
    body: SubmissionGrade,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    from datetime import datetime, timezone
    ans = db.query(TeacherQuestionAnswer).filter(TeacherQuestionAnswer.id == answer_id).first()
    if not ans:
        raise HTTPException(status_code=404, detail="Ответ не найден")
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == ans.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")

    ans.grade = body.grade
    ans.teacher_comment = body.teacher_comment
    ans.graded_at = datetime.now(timezone.utc)

    # Award coins if grade is high
    if body.grade is not None and body.grade >= 70 and not (ans.coins_awarded or 0):
        add_coins(db, ans.student_id, 100, f"question_{q.id}")
        ans.coins_awarded = 1

    n = Notification(
        user_id=ans.student_id,
        type="question_graded",
        title="Ответ на вопрос оценен",
        message=f"Ваш ответ на вопрос «{q.question_text[:30]}...» оценен: {body.grade}. {body.teacher_comment or ''}",
        link="/app/questions",
    )
    db.add(n)
    db.commit()
    return {"ok": True}


@router.post("/questions/answers/{answer_id}/return")
def return_question_answer(
    answer_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Сбросить ответ студента, чтобы он мог ответить снова."""
    ans = db.query(TeacherQuestionAnswer).filter(TeacherQuestionAnswer.id == answer_id).first()
    if not ans:
        raise HTTPException(status_code=404, detail="Ответ не найден")
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == ans.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")

    student_id = ans.student_id
    question_text = q.question_text
    db.delete(ans)

    n = Notification(
        user_id=student_id,
        type="question_returned",
        title="Ответ возвращен",
        message=f"Ваш ответ на вопрос «{question_text[:30]}...» был возвращен учителем. Вы можете ответить снова.",
        link="/app/questions",
    )
    db.add(n)
    db.commit()
    return {"ok": True}


@router.patch("/questions/{question_id}")
def update_question(
    question_id: int,
    body: QuestionUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    
    if body.question_text is not None: q.question_text = body.question_text
    if body.question_type is not None: q.question_type = body.question_type
    if body.options is not None: q.options = json.dumps(body.options)
    if body.correct_option is not None: q.correct_option = body.correct_option
    
    db.commit()
    return {"ok": True}


@router.post("/questions")
def create_question(
    body: QuestionCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == body.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    if body.course_id != g.course_id:
        raise HTTPException(status_code=400, detail="course_id не совпадает с курсом группы")
    q = TeacherQuestion(
        teacher_id=current_user.id,
        group_id=body.group_id,
        course_id=body.course_id,
        topic_id=body.topic_id,
        question_text=body.question_text,
        question_type=body.question_type,
        options=json.dumps(body.options) if body.options else None,
        correct_option=body.correct_option,
    )
    db.add(q)
    for gs in g.students:
        notif = Notification(
            user_id=gs.student_id,
            type="question_created",
            title="Новый вопрос",
            message=f"Преподаватель задал вопрос для группы «{g.group_name}».",
            link="/app/questions",
        )
        db.add(notif)
    db.commit()
    db.refresh(q)
    return {"id": q.id, "question_text": q.question_text[:50]}


    # ---------- Topics (teacher creates) ----------
@router.patch("/topics/{topic_id}")
def update_topic(
    topic_id: int,
    body: TopicUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    # Check access
    is_admin = current_user.role in ("admin", "director", "curator")
    if not is_admin:
        has_group = db.query(TeacherGroup).filter(
            TeacherGroup.course_id == topic.course_id,
            TeacherGroup.teacher_id == current_user.id
        ).first()
        if not has_group:
            raise HTTPException(status_code=403, detail="Нет доступа")

    if body.title is not None: topic.title = body.title
    if body.description is not None: topic.description = body.description
    
    db.commit()
    db.refresh(topic)
    return {"id": topic.id, "title": topic.title}


@router.delete("/topics/{topic_id}")
def delete_topic(
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    
    # Check access
    is_admin = current_user.role in ("admin", "director", "curator")
    if not is_admin:
        has_group = db.query(TeacherGroup).filter(
            TeacherGroup.course_id == topic.course_id,
            TeacherGroup.teacher_id == current_user.id
        ).first()
        if not has_group:
            raise HTTPException(status_code=403, detail="Нет доступа")

    db.delete(topic)
    db.commit()
    return {"ok": True}


@router.post("/courses/{course_id}/topics")
def create_topic(
    course_id: int,
    body: TopicCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    is_admin = current_user.role in ("admin", "director", "curator")
    if not is_admin:
        # Check if teacher has any group in this course
        has_group = db.query(TeacherGroup).filter(
            TeacherGroup.course_id == course_id,
            TeacherGroup.teacher_id == current_user.id
        ).first()
        if not has_group:
            raise HTTPException(status_code=403, detail="Нет доступа к этому курсу")
    max_order = db.query(CourseTopic).filter(CourseTopic.course_id == course_id).count()
    topic = CourseTopic(
        course_id=course_id,
        title=body.title,
        description=body.description,
        order_number=max_order + 1,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return {"id": topic.id, "title": topic.title}


# ---------- Reuse (clone assignment or material) ----------
@router.get("/assignments/{assignment_id}/clone")
def get_assignment_for_clone(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    rubric = [_rubric_row_to_api(c) for c in a.rubric_criteria]
    return {
        "group_id": a.group_id,
        "course_id": a.course_id,
        "topic_id": a.topic_id,
        "title": a.title,
        "description": a.description,
        "max_points": a.max_points,
        "attachment_urls": json.loads(a.attachment_urls) if a.attachment_urls else [],
        "attachment_links": json.loads(a.attachment_links) if a.attachment_links else [],
        "video_urls": json.loads(a.video_urls) if a.video_urls else [],
        "rubric": rubric,
    }


@router.get("/materials/{material_id}/clone")
def get_material_for_clone(
    material_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    m = db.query(TeacherMaterial).filter(TeacherMaterial.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Материал не найден")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа")
    return {
        "group_id": m.group_id,
        "course_id": m.course_id,
        "topic_id": m.topic_id,
        "title": m.title,
        "description": m.description,
        "video_urls": json.loads(m.video_urls) if m.video_urls else [],
        "image_urls": json.loads(m.image_urls) if m.image_urls else [],
    }
