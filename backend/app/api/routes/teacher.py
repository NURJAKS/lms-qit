import json
from collections import defaultdict
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_teacher_user
from app.core.database import get_db
from app.models.user import User
from app.models.teacher_group import TeacherGroup
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.assignment_submission import AssignmentSubmission
from app.services.coins import add_coins
from app.services.export_service import generate_multi_sheet_xlsx_response
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
from app.models.group_teacher import GroupTeacher
from app.models.topic_synopsis import TopicSynopsisSubmission
from app.models.course_feed_post import CourseFeedPost
from app.api.assignment_access import is_assignment_submission_closed
from app.services.file_service import move_files_to_permanent_storage


router = APIRouter(prefix="/teacher", tags=["teacher"])

ALLOWED_ASSIGNMENT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".pdf", ".doc", ".docx", ".txt"}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB for video


def _can_manage_group(user: User, group: TeacherGroup, db: Session = None) -> bool:
    """Teacher can manage own group; admin/director/curator can manage any."""
    if user.role in ("admin", "director", "curator"):
        return True
    
    # Check if primary or in group_teachers
    if group.teacher_id == user.id:
        return True
    
    if not db:
        # Relationship might be loaded
        return any(gt.teacher_id == user.id for gt in group.group_teachers)
    
    from app.models.group_teacher import GroupTeacher
    exists = db.query(GroupTeacher).filter(
        GroupTeacher.group_id == group.id,
        GroupTeacher.teacher_id == user.id
    ).first()
    return exists is not None


def _is_assignment_closed(a: TeacherAssignment) -> bool:
    """Closed if teacher set closed_at, or deadline passed and reject_submissions_after_deadline is true."""
    return is_assignment_submission_closed(a)


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


def _deadline_to_iso_utc(deadline: datetime | None) -> str | None:
    if deadline is None:
        return None
    if deadline.tzinfo is None:
        return deadline.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    return deadline.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _dt_to_utc_z(dt: datetime | None) -> str | None:
    """Serialize datetimes for the client as UTC with a Z suffix so browsers apply local TZ."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _submission_has_student_work(r: AssignmentSubmission) -> bool:
    """True if the student actually turned in text or files (not a teacher-only placeholder row)."""
    if r.submission_text and str(r.submission_text).strip():
        return True
    if r.file_url and str(r.file_url).strip():
        return True
    if r.file_urls and str(r.file_urls).strip():
        try:
            arr = json.loads(r.file_urls)
            return bool(arr) if isinstance(arr, list) else True
        except (json.JSONDecodeError, TypeError, ValueError):
            return True
    return False


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


def _question_type_for_response(q: TeacherQuestion) -> str:
    """Align API type with options: MC with mis-stored `open` still behaves as single_choice."""
    opts = _question_options_list(q.options)
    if _normalize_question_type_api(q.question_type) == "single_choice":
        return "single_choice"
    if len(opts) >= 2:
        return "single_choice"
    return "open"


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
    test_passing_score: int | None = 70  # configurable passing score
    reject_submissions_after_deadline: bool | None = None
    is_synopsis: bool = False
    is_supplementary: bool = False
    target_student_ids: list[int] | None = None


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
    reject_submissions_after_deadline: bool | None = None
    is_synopsis: bool | None = None
    is_supplementary: bool | None = None
    target_student_ids: list[int] | None = None


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
            detail="errorMaxPointsMismatch",
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
    is_supplementary: bool = False
    target_student_ids: list[int] | None = None


    target_student_ids: list[int] | None = None
    video_urls: list[str] | None = None
    can_comment: bool = True
    can_edit: bool = False


class MaterialUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    topic_id: int | None = None
    video_urls: list[str] | None = None
    image_urls: list[str] | None = None
    attachment_urls: list[str] | None = None
    attachment_links: list[str] | None = None
    target_student_ids: list[int] | None = None


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


class AddTeacher(BaseModel):
    teacher_id: int


class SubmissionGrade(BaseModel):
    grade: float | None = None
    teacher_comment: str | None = None
    grades: list[dict] | None = None  # [{"criterion_id": 1, "points": 15}]


class BootstrapAbsentSubmissionBody(BaseModel):
    student_id: int


@router.post("/assignments/upload")
async def upload_assignment_file(
    file: Annotated[UploadFile, File()] = ...,
    current_user: Annotated[User, Depends(get_current_teacher_user)] = ...,
):
    """Загрузить файл для вложения к заданию (временное хранение)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="errorFileNotSelected")
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
        raise HTTPException(status_code=400, detail="errorFileTooLarge")
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
    from app.models.group_teacher import GroupTeacher
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.outerjoin(GroupTeacher).filter(
            (TeacherGroup.teacher_id == current_user.id) | (GroupTeacher.teacher_id == current_user.id)
        ).distinct()
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
    from app.models.group_teacher import GroupTeacher
    groups_in_window = (
        db.query(TeacherGroup)
        .filter(TeacherGroup.created_at >= start_prev)
    )
    if not is_admin:
        groups_in_window = groups_in_window.outerjoin(GroupTeacher).filter(
            (TeacherGroup.teacher_id == current_user.id) | (GroupTeacher.teacher_id == current_user.id)
        ).distinct()
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
    from app.models.group_teacher import GroupTeacher
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.outerjoin(GroupTeacher).filter(
            (TeacherGroup.teacher_id == current_user.id) | (GroupTeacher.teacher_id == current_user.id)
        ).distinct()
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
        q_groups = (
            q_groups.outerjoin(GroupTeacher)
            .filter(
                (TeacherGroup.teacher_id == current_user.id)
                | (GroupTeacher.teacher_id == current_user.id)
            )
            .distinct()
        )
    
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
            func.sum(case((AssignmentSubmission.grade.isnot(None), 1), else_=0)).label("graded_count"),
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
            "deadline": _deadline_to_iso_utc(a.deadline),
            "created_at": _dt_to_utc_z(a.created_at) if a.created_at else None,
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
    from app.models.group_teacher import GroupTeacher
    is_admin = current_user.role in ("admin", "director", "curator")
    
    if is_admin:
        q = db.query(TeacherGroup)
    else:
        # Groups where user is either primary or secondary
        q = db.query(TeacherGroup).outerjoin(GroupTeacher).filter(
            (TeacherGroup.teacher_id == current_user.id) | (GroupTeacher.teacher_id == current_user.id)
        ).distinct()

    # Optimize n+1 query for students_count
    from app.models.group_student import GroupStudent
    
    # Subquery to count students per group efficiently in one SQL operation
    student_count_sub = (
        db.query(func.count(GroupStudent.id))
        .filter(GroupStudent.group_id == TeacherGroup.id)
        .scalar_subquery()
    )
    
    rows = q.add_columns(student_count_sub).order_by(TeacherGroup.id).all()
    
    return [
        {
            "id": r.id,
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "group_name": r.group_name,
            "teacher_id": r.teacher_id,
            "students_count": students_count or 0,
            "created_at": r.created_at,
        }
        for r, students_count in rows
    ]


@router.post("/groups")
def create_group(
    body: GroupCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Создать новую учебную группу (только для админов и директоров)."""
    if current_user.role not in ("admin", "director"):
        raise HTTPException(status_code=403, detail="errorOnlyAdminCreateGroup")
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
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    
    # Allow teachers to archive their own groups
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoEditGroupPermission")
    
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
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    
    # Allow only primary teacher or admin to delete
    is_owner = g.teacher_id == current_user.id
    is_admin = current_user.role in ("admin", "director", "curator")
    
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="errorNoDeleteGroupPermission")
        
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
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == body.student_id,
        CourseEnrollment.course_id == g.course_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=400, detail="errorStudentNotEnrolled")
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
        raise HTTPException(status_code=400, detail="errorStudentAlreadyInGroup")
    return {"ok": True}


@router.get("/groups/{group_id}/students")
def list_group_students(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    students = [gs.student for gs in g.students]
    return [{"id": u.id, "full_name": u.full_name or "", "email": u.email or ""} for u in students]


@router.get("/groups/{group_id}/topic-synopses/{topic_id}")
def list_topic_synopses_for_group(
    group_id: int,
    topic_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Конспекты студентов группы по теме."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g, db):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic or topic.course_id != g.course_id:
        raise HTTPException(status_code=404, detail="topicNotFound")
    student_ids = [
        gs.student_id
        for gs in db.query(GroupStudent).filter(GroupStudent.group_id == group_id).all()
    ]
    if not student_ids:
        return []
    rows = (
        db.query(TopicSynopsisSubmission, User)
        .join(User, User.id == TopicSynopsisSubmission.user_id)
        .filter(
            TopicSynopsisSubmission.topic_id == topic_id,
            TopicSynopsisSubmission.user_id.in_(student_ids),
        )
        .order_by(TopicSynopsisSubmission.submitted_at.desc())
        .all()
    )
    grouped: dict[int, dict] = defaultdict(
        lambda: {
            "student_id": 0,
            "full_name": "",
            "email": "",
            "note_text": None,
            "submitted_at": None,
            "files": [],
        }
    )
    for s, u in rows:
        item = grouped[u.id]
        item["student_id"] = u.id
        item["full_name"] = u.full_name or ""
        item["email"] = u.email or ""
        if item["submitted_at"] is None:
            item["submitted_at"] = s.submitted_at.isoformat() if s.submitted_at else None
        if not item["note_text"]:
            note = (s.note_text or "").strip()
            item["note_text"] = note or None
        item["files"].append(
            {
                "id": s.id,
                "file_url": s.file_url,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            }
        )
        # Assuming one grade per (user, topic) - picking latest row info
        if item.get("grade") is None:
            item["synopsis_id"] = s.id
            item["grade"] = float(s.grade) if s.grade is not None else None
            item["teacher_comment"] = s.teacher_comment
            item["graded_at"] = s.graded_at.isoformat() if s.graded_at else None
    return list(grouped.values())


@router.get("/groups/{group_id}/topics-missing-assignments")
def list_topics_missing_assignments(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Темы курса группы, по которым ещё нет ни одного задания (для предупреждений)."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g, db):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    all_topics = (
        db.query(CourseTopic)
        .filter(CourseTopic.course_id == g.course_id)
        .order_by(CourseTopic.order_number)
        .all()
    )
    topic_ids_ordered = [t.id for t in all_topics]
    topics_with_a = {
        a.topic_id
        for a in db.query(TeacherAssignment).filter(
            TeacherAssignment.group_id == group_id,
            TeacherAssignment.topic_id.isnot(None),
        ).all()
    }
    by_id = {t.id: t for t in all_topics}
    missing: list[dict] = []
    for tid in topic_ids_ordered:
        if tid not in topics_with_a and tid in by_id:
            tp = by_id[tid]
            missing.append({"id": tp.id, "title": tp.title})
    return missing


@router.get("/groups/{group_id}/feed")
def get_teacher_group_feed(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Лента для учителя: темы без заданий, посты, работы на проверке."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g, db):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    course_id = g.course_id
    now = datetime.now(timezone.utc)
    items: list[dict] = []

    all_topics = (
        db.query(CourseTopic)
        .filter(CourseTopic.course_id == course_id)
        .order_by(CourseTopic.order_number)
        .all()
    )
    # Removed missing_topic_assignment logic as per user request

    posts = (
        db.query(CourseFeedPost)
        .filter(
            CourseFeedPost.course_id == course_id,
            or_(CourseFeedPost.group_id.is_(None), CourseFeedPost.group_id == group_id),
        )
        .order_by(CourseFeedPost.created_at.desc())
        .limit(50)
        .all()
    )
    for p in posts:
        if p.active_until:
            au = p.active_until
            if au.tzinfo is None:
                au = au.replace(tzinfo=timezone.utc)
            if au < now:
                continue
        att_urls: list[str] = []
        raw_att = p.attachment_urls
        if isinstance(raw_att, list):
            att_urls = [str(x) for x in raw_att if x]
        elif isinstance(raw_att, str) and raw_att.strip():
            try:
                parsed = json.loads(raw_att)
                if isinstance(parsed, list):
                    att_urls = [str(x) for x in parsed if x]
            except Exception:
                att_urls = []
        items.append(
            {
                "kind": "post",
                "post_kind": p.kind,
                "id": f"post-{p.id}",
                "title": p.title,
                "body": p.body,
                "link": p.link_url,
                "attachment_urls": att_urls,
                "date": p.created_at.isoformat() if p.created_at else None,
                "meta": {"post_id": p.id},
            }
        )

    pending_rows = (
        db.query(AssignmentSubmission, TeacherAssignment, User)
        .join(TeacherAssignment, TeacherAssignment.id == AssignmentSubmission.assignment_id)
        .join(User, User.id == AssignmentSubmission.student_id)
        .filter(
            TeacherAssignment.group_id == group_id,
            AssignmentSubmission.grade.is_(None),
            AssignmentSubmission.submitted_at.isnot(None),
        )
        .order_by(AssignmentSubmission.submitted_at.desc())
        .limit(20)
        .all()
    )
    for sub, a, u in pending_rows:
        items.append(
            {
                "kind": "pending_grade",
                "id": f"pend-{sub.id}",
                "title": a.title,
                "body": u.full_name or u.email,
                "link": f"/app/teacher/view-answers/{a.id}?tab=submissions",
                "date": sub.submitted_at.isoformat() if sub.submitted_at else None,
                "meta": {"assignment_id": a.id, "submission_id": sub.id},
            }
        )

    def sort_key(it: dict):
        return it.get("date") or ""

    items.sort(key=sort_key, reverse=True)
    return {"items": items}


@router.get("/groups/{group_id}/teachers")
def list_group_teachers(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g, db):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    
    # Primary teacher
    primary = {
        "id": g.teacher.id,
        "full_name": g.teacher.full_name or "",
        "email": g.teacher.email or "",
        "role": "primary"
    }
    
    # Secondary teachers
    secondaries = [
        {
            "id": gt.teacher.id,
            "full_name": gt.teacher.full_name or "",
            "email": gt.teacher.email or "",
            "role": "secondary"
        }
        for gt in g.group_teachers if gt.role == "secondary"
    ]
    
    return [primary] + secondaries


@router.post("/groups/{group_id}/teachers")
def add_teacher_to_group(
    group_id: int,
    body: AddTeacher,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    
    # Only primary teacher or admin can add/remove secondary teachers
    if current_user.role not in ("admin", "director") and g.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="errorOnlyOwnerAddTeacher")
        
    if body.teacher_id == g.teacher_id:
        raise HTTPException(status_code=400, detail="errorTeacherAlreadyPrimary")
        
    exists = db.query(GroupTeacher).filter(
        GroupTeacher.group_id == group_id,
        GroupTeacher.teacher_id == body.teacher_id
    ).first()
    
    if exists:
        return {"ok": True, "message": "Преподаватель уже добавлен."}
        
    new_gt = GroupTeacher(group_id=group_id, teacher_id=body.teacher_id, role="secondary")
    db.add(new_gt)
    
    # Notification
    notif = Notification(
        user_id=body.teacher_id,
        type="added_as_teacher",
        title="Вас добавили как преподавателя",
        message=f"Вас добавили как второго преподавателя в группу «{g.group_name}». Теперь вам доступно управление заданиями и оценками в этой группе.",
        link=f"/app/teacher/courses/{g.id}",
    )
    db.add(notif)
    
    db.commit()
    return {"ok": True}


@router.delete("/groups/{group_id}/teachers/{teacher_id}")
def remove_teacher_from_group(
    group_id: int,
    teacher_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
        
    # Only primary teacher or admin can remove
    if current_user.role not in ("admin", "director") and g.teacher_id != current_user.id:
        # User can remove themselves? Yes.
        if current_user.id != teacher_id:
            raise HTTPException(status_code=403, detail="Нет прав для удаления.")
            
    gt = db.query(GroupTeacher).filter(
        GroupTeacher.group_id == group_id,
        GroupTeacher.teacher_id == teacher_id,
        GroupTeacher.role == "secondary"
    ).first()
    
    if not gt:
        raise HTTPException(status_code=404, detail="errorTeacherNotFoundInGroup")
        
    db.delete(gt)
    db.commit()
    return {"ok": True}


@router.get("/search-teachers")
def search_teachers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    query: str | None = Query(None),
    group_id: int | None = Query(None),
):
    """
    Поиск преподавателей по имени или email для приглашения в группу.
    Если query пуст, возвращает список доступных преподавателей.
    Исключает тех, кто уже в группе.
    """
    from sqlalchemy import or_, and_, not_
    from app.models.teacher_group import TeacherGroup
    from app.models.group_teacher import GroupTeacher
    
    # Результирующий запрос
    q_base = db.query(User).filter(User.role == "teacher")
    
    # 1. Исключаем текущего пользователя (он и так владелец или уже в группе)
    q_base = q_base.filter(User.id != current_user.id)
    
    # 2. Если передан group_id, исключаем тех, кто уже там (владелец и со-преподаватели)
    if group_id:
        group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
        if group:
            # Исключаем основного владельца
            q_base = q_base.filter(User.id != group.teacher_id)
            
            # Исключаем тех, кто уже в group_teachers
            subq = db.query(GroupTeacher.teacher_id).filter(GroupTeacher.group_id == group_id).subquery()
            q_base = q_base.filter(not_(User.id.in_(subq)))
    
    # 3. Фильтр по поисковому запросу
    if query and len(query.strip()) >= 2:
        q_base = q_base.filter(
            or_(
                User.full_name.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%")
            )
        )
    
    # Лимит для списка по умолчанию или результатов поиска
    teachers = q_base.order_by(User.full_name.asc()).limit(20).all()
    
    return [
        {"id": u.id, "full_name": u.full_name or "", "email": u.email or ""}
        for u in teachers
    ]


@router.get("/groups/{group_id}/gradebook")
def get_group_gradebook(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Матрица оценок: учащиеся × все задания группы (по одному столбцу на задание, по всем темам курса)."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")

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

    # Столбец = одно назначенное задание; порядок как у тем на курсе (без темы — в начале), затем по дате создания.
    topic_order = case(
        (TeacherAssignment.topic_id.is_(None), -1),
        else_=func.coalesce(CourseTopic.order_number, 9999),
    )
    assignments = (
        db.query(TeacherAssignment)
        .options(joinedload(TeacherAssignment.topic))
        .outerjoin(CourseTopic, TeacherAssignment.topic_id == CourseTopic.id)
        .filter(TeacherAssignment.group_id == group_id)
        .order_by(topic_order.asc(), TeacherAssignment.created_at.asc())
        .all()
    )
    assignment_cols = [
        {
            "id": a.id,
            "title": a.title,
            "topic_id": a.topic_id,
            "topic_title": (a.topic.title if getattr(a, "topic", None) else None),
            "deadline": _deadline_to_iso_utc(a.deadline),
            "max_points": a.max_points or 100,
            "created_at": _dt_to_utc_z(a.created_at) if a.created_at else None,
        }
        for a in assignments
    ]

    aid_list = [a.id for a in assignments]
    subs: list[AssignmentSubmission] = []
    if aid_list:
        subs = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id.in_(aid_list)).all()

    now = datetime.now(timezone.utc)

    def _assignment_deadline_passed(a: TeacherAssignment) -> bool:
        if not a.deadline:
            return False
        dl = a.deadline
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        return now > dl

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
                overdue_no_turn_in = _assignment_deadline_passed(a)
                cells[key] = {
                    "submission_id": None,
                    "grade": None,
                    "submitted": False,
                    "graded": False,
                    "missing": overdue_no_turn_in,
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
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    if not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    gs = db.query(GroupStudent).filter(GroupStudent.group_id == group_id, GroupStudent.student_id == student_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="errorStudentNotInGroup")
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
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
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
    out = []
    for r in rows:
        in_group = (
            db.query(GroupStudent)
            .filter(
                GroupStudent.group_id == r.group_id,
                GroupStudent.student_id == r.student_id,
            )
            .first()
            is not None
        )
        out.append(
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
                "student_in_group": in_group,
            }
        )
    return out


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
        raise HTTPException(status_code=404, detail="errorTaskNotFound")
    if task.status == "done":
        return {"ok": True, "message": "Уже выполнено"}
    gs = db.query(GroupStudent).filter(
        GroupStudent.group_id == task.group_id,
        GroupStudent.student_id == task.student_id,
    ).first()
    if not gs:
        raise HTTPException(
            status_code=400,
            detail="errorAddStudentToGroupFirst",
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
            "deadline": _deadline_to_iso_utc(r.deadline),
            "closed_at": _dt_to_utc_z(closed_at) if closed_at else None,
            "is_closed": _is_assignment_closed(r),
            "created_at": _dt_to_utc_z(r.created_at) if r.created_at else None,
            "is_synopsis": bool(getattr(r, "is_synopsis", False)),
            "is_supplementary": bool(getattr(r, "is_supplementary", False)),
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
            "created_at": _dt_to_utc_z(r.created_at) if r.created_at else None,
            "is_supplementary": bool(getattr(r, "is_supplementary", False)),
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
            "created_at": _dt_to_utc_z(r.created_at) if r.created_at else None,
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
        raise HTTPException(status_code=403, detail={"code": "no_access_group"})
    if body.course_id != g.course_id:
        raise HTTPException(status_code=400, detail={"code": "course_group_mismatch"})
    topic = db.query(CourseTopic).filter(CourseTopic.id == body.topic_id, CourseTopic.course_id == body.course_id).first()
    if not topic:
        raise HTTPException(status_code=400, detail={"code": "topic_not_in_course"})
    deadline = None
    if body.deadline:
        try:
            deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
        except Exception:
            pass
    test_id_val = None
    if body.test_questions:
        test_title = f"Тест: {body.title}"
        if len(test_title) > 255:
            test_title = test_title[:252] + "..."
            
        test = Test(
            course_id=body.course_id,
            topic_id=body.topic_id,
            title=test_title,
            passing_score=body.test_passing_score or 70,
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
    if body.is_synopsis and not body.is_supplementary:
        # Check if a MAIN synopsis already exists for this topic in this group
        existing = db.query(TeacherAssignment).filter(
            TeacherAssignment.group_id == body.group_id,
            TeacherAssignment.topic_id == body.topic_id,
            TeacherAssignment.is_synopsis == True,
            TeacherAssignment.is_supplementary == False
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail={"code": "synopsis_assignment_exists"})

    is_supp = body.is_supplementary
    target_ids = json.dumps(body.target_student_ids) if body.target_student_ids else None
    
    a = TeacherAssignment(
        teacher_id=current_user.id,
        group_id=body.group_id,
        course_id=body.course_id,
        topic_id=body.topic_id,
        title=body.title,
        description=body.description,
        deadline=deadline,
        attachment_urls=json.dumps(body.attachment_urls) if body.attachment_urls else None,
        attachment_links=json.dumps(body.attachment_links) if body.attachment_links else None,
        video_urls=json.dumps(body.video_urls) if body.video_urls else None,
        test_id=test_id_val,
        reject_submissions_after_deadline=body.reject_submissions_after_deadline,
        is_synopsis=body.is_synopsis,
        is_supplementary=is_supp,
        max_points=100 if body.is_synopsis else body.max_points,
        target_student_ids=target_ids,
    )
    db.add(a)
    db.flush()

    # Move files to permanent storage
    if body.attachment_urls:
        new_urls = move_files_to_permanent_storage("assignments", a.id, body.attachment_urls)
        a.attachment_urls = json.dumps(new_urls)
    if body.video_urls:
        new_video_urls = move_files_to_permanent_storage("assignments", a.id, body.video_urls)
        a.video_urls = json.dumps(new_video_urls)
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
    notif_msg = f"Преподаватель создал задание «{a.title}» для группы «{g.group_name}»."
    if len(notif_msg) > 1000: # Safe limit for message
        notif_msg = notif_msg[:997] + "..."
        
    for gs in g.students:
        notif = Notification(
            user_id=gs.student_id,
            type="assignment_created",
            title="Новое задание",
            message=notif_msg,
            link=f"/app/courses/{a.course_id}?tab=classwork&assignmentId={a.id}",
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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    rubric = [_rubric_row_to_api(c) for c in a.rubric_criteria]
    return {
        "id": a.id,
        "group_id": a.group_id,
        "course_id": a.course_id,
        "topic_id": a.topic_id,
        "title": a.title,
        "description": a.description or "",
        "deadline": _deadline_to_iso_utc(a.deadline),
        "closed_at": a.closed_at.isoformat() if a.closed_at else None,
        "is_closed": _is_assignment_closed(a),
        "max_points": a.max_points,
        "attachment_urls": json.loads(a.attachment_urls) if a.attachment_urls else [],
        "attachment_links": json.loads(a.attachment_links) if a.attachment_links else [],
        "video_urls": json.loads(a.video_urls) if a.video_urls else [],
        "rubric": rubric,
        "reject_submissions_after_deadline": bool(getattr(a, "reject_submissions_after_deadline", True)),
        "is_synopsis": bool(getattr(a, "is_synopsis", False)),
        "is_supplementary": bool(getattr(a, "is_supplementary", False)),
    }


@router.get("/rubrics/reusable")
def list_reusable_assignment_rubrics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    course_id: int | None = Query(None),
    exclude_assignment_id: int | None = Query(None),
):
    """Assignments in the teacher's groups that have saved rubric rows (reuse picker)."""
    from app.models.course import Course

    is_admin = current_user.role in ("admin", "director", "curator")
    if is_admin:
        q_groups = db.query(TeacherGroup)
    else:
        co_ids = [
            row[0]
            for row in db.query(GroupTeacher.group_id)
            .filter(GroupTeacher.teacher_id == current_user.id)
            .distinct()
            .all()
        ]
        if co_ids:
            q_groups = db.query(TeacherGroup).filter(
                or_(TeacherGroup.teacher_id == current_user.id, TeacherGroup.id.in_(co_ids))
            )
        else:
            q_groups = db.query(TeacherGroup).filter(TeacherGroup.teacher_id == current_user.id)
    group_ids = [g.id for g in q_groups.all()]
    if not group_ids:
        return []

    q = (
        db.query(TeacherAssignment)
        .join(TeacherGroup, TeacherGroup.id == TeacherAssignment.group_id)
        .filter(TeacherAssignment.group_id.in_(group_ids))
    )
    if course_id is not None:
        q = q.filter(TeacherAssignment.course_id == course_id)
    if exclude_assignment_id is not None:
        q = q.filter(TeacherAssignment.id != exclude_assignment_id)

    assignments = q.order_by(TeacherAssignment.id.desc()).limit(120).all()
    if not assignments:
        return []

    course_ids = list({a.course_id for a in assignments})
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()} if course_ids else {}

    out: list[dict] = []
    for a in assignments:
        g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
        if not g or not _can_manage_group(current_user, g):
            continue
        rubric_rows = db.query(TeacherAssignmentRubric).filter(TeacherAssignmentRubric.assignment_id == a.id).all()
        if not rubric_rows:
            continue
        rubric = [_rubric_row_to_api(c) for c in rubric_rows]
        total_pts = sum(float(c.max_points) for c in rubric_rows)
        co = courses.get(a.course_id)
        out.append(
            {
                "assignment_id": a.id,
                "title": a.title,
                "course_id": a.course_id,
                "course_title": co.title if co else "",
                "group_name": g.group_name,
                "criteria_count": len(rubric_rows),
                "total_points": total_pts,
                "rubric": rubric,
            }
        )
    return out


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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    
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
            raise HTTPException(status_code=400, detail="errorInvalidDateFormat")
    
    a.deadline = deadline
    db.commit()
    db.refresh(a)
    return {
        "id": a.id,
        "deadline": _deadline_to_iso_utc(a.deadline),
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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")

    if body.title is not None:
        a.title = body.title
    if body.description is not None:
        a.description = body.description
    if body.max_points is not None:
        a.max_points = body.max_points
    if "topic_id" in body.__fields_set__:
        if body.topic_id and body.topic_id != 0:
            topic = db.query(CourseTopic).filter(
                CourseTopic.id == body.topic_id, CourseTopic.course_id == a.course_id
            ).first()
            if not topic:
                raise HTTPException(status_code=400, detail={"code": "topic_not_in_course"})
            a.topic_id = body.topic_id
        else:
            a.topic_id = None
    if body.deadline is not None:
        deadline = None
        if body.deadline:
            try:
                deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(status_code=400, detail="errorInvalidDateFormat")
        a.deadline = deadline
    if body.attachment_urls is not None:
        new_urls = move_files_to_permanent_storage("assignments", a.id, body.attachment_urls)
        a.attachment_urls = json.dumps(new_urls) if new_urls else None
    if body.attachment_links is not None:
        a.attachment_links = json.dumps(body.attachment_links) if body.attachment_links else None
    if body.video_urls is not None:
        new_video_urls = move_files_to_permanent_storage("assignments", a.id, body.video_urls)
        a.video_urls = json.dumps(new_video_urls) if new_video_urls else None
    if body.reject_submissions_after_deadline is not None:
        a.reject_submissions_after_deadline = body.reject_submissions_after_deadline
    if body.is_synopsis is not None:
        a.is_synopsis = body.is_synopsis
        if a.is_synopsis:
            a.max_points = 100
    if body.is_supplementary is not None:
        a.is_supplementary = body.is_supplementary
    if body.target_student_ids is not None:
        a.target_student_ids = json.dumps(body.target_student_ids) if body.target_student_ids else None

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


@router.delete("/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Удалить задание группы (вместе с сдачами)."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.get("/assignments/{assignment_id}/submissions")
def list_submissions(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
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
            has_work = _submission_has_student_work(r)
            if r.grade is not None:
                st = "graded"
            elif has_work:
                st = "pending"
            else:
                st = "not_submitted"
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
                "returned_at": r.returned_at.isoformat() if getattr(r, "returned_at", None) else None,
                "rubric_grades": submission_grades.get(r.id, []),
                "status": st
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
                "returned_at": None,
                "rubric_grades": [],
                "status": "not_submitted"
            })

    assignment_details = {
        "title": a.title,
        "description": a.description,
        "max_points": a.max_points,
        "deadline": _deadline_to_iso_utc(a.deadline),
        "group_name": g.group_name,
        "group_id": a.group_id,
    }

    return {"submissions": submissions, "rubric": rubric, "assignment": assignment_details}


@router.post("/assignments/{assignment_id}/submissions/bootstrap-absent")
def bootstrap_absent_submission(
    assignment_id: int,
    body: BootstrapAbsentSubmissionBody,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Создать запись сдачи без работы студента, чтобы можно было выставить оценку (например 0) после дедлайна."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    student_ids = {gs.student_id for gs in g.students}
    if body.student_id not in student_ids:
        raise HTTPException(status_code=400, detail="errorStudentNotInGroup")

    existing = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.student_id == body.student_id,
        )
        .first()
    )
    if existing:
        return {"id": existing.id}

    if a.deadline is None:
        raise HTTPException(status_code=400, detail="errorNoDeadlineSet")
    now = datetime.now(timezone.utc)
    dl = a.deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    if dl >= now:
        raise HTTPException(status_code=400, detail="errorDeadlineNotPassed")

    placeholder = AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=body.student_id,
        submission_text=None,
        file_url=None,
        file_urls=None,
        submitted_at=None,
    )
    db.add(placeholder)
    db.commit()
    db.refresh(placeholder)
    return {"id": placeholder.id}





@router.get("/groups/{group_id}/progress/excel")
def export_group_progress_excel(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = (
        db.query(TeacherGroup)
        .options(joinedload(TeacherGroup.course))
        .filter(TeacherGroup.id == group_id)
        .first()
    )
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="errorGroupNotFound")
    student_ids = [gs.student_id for gs in g.students]
    course_title = g.course.title if g.course else ""

    roster_headers = ["User ID", "Full Name", "Email", "Course"]
    progress_headers = ["User ID", "Full Name", "Email", "Course", "Topic ID", "Completed", "Score"]

    roster_rows: list[list] = []
    progress_rows: list[list] = []

    if student_ids:
        users_list = db.query(User).filter(User.id.in_(student_ids)).all()
        users = {u.id: u for u in users_list}
        for u in sorted(users_list, key=lambda x: (x.full_name or "").lower()):
            roster_rows.append([u.id, u.full_name or "", u.email or "", course_title])

        q = (
            db.query(StudentProgress)
            .filter(
                StudentProgress.user_id.in_(student_ids),
                StudentProgress.course_id == g.course_id,
            )
            .order_by(StudentProgress.user_id, StudentProgress.topic_id)
        )
        for r in q.all():
            u = users.get(r.user_id)
            progress_rows.append(
                [
                    r.user_id,
                    u.full_name if u else "",
                    u.email if u else "",
                    course_title,
                    r.topic_id,
                    r.is_completed,
                    r.test_score,
                ]
            )

    return generate_multi_sheet_xlsx_response(
        [
            ("Students", roster_headers, roster_rows),
            ("Progress", progress_headers, progress_rows),
        ],
        f"group_{group_id}_progress",
    )


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
        raise HTTPException(status_code=404, detail="errorRecordNotFound")
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == sub.assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
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
    sub.teacher_comment_author_id = current_user.id
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
    db.commit()
    # Send notification on grade
    n = Notification(
        user_id=sub.student_id,
        type="assignment_graded",
        title="Работа оценена",
        message=f"Ваша работа по заданию «{a.title}» оценена: {final_grade}. {body.teacher_comment or ''}",
        link=f"/app/courses/{a.course_id}?tab=classwork&assignmentId={a.id}",
    )
    db.add(n)
    db.commit()

    return {
        "ok": True,
        "submission_id": sub.id,
        "assignment_id": a.id,
        "student_id": sub.student_id,
        "grade": float(sub.grade) if sub.grade is not None else None,
        "teacher_comment": sub.teacher_comment,
        "graded_at": sub.graded_at.isoformat() if sub.graded_at else None,
        "returned_at": sub.returned_at.isoformat() if sub.returned_at else None,
        "is_returned": bool(sub.returned_at),
    }


@router.post("/submissions/{submission_id}/return")
def return_submission_to_student(
    submission_id: int,
    body: SubmissionGrade,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Опубликовать оценку и комментарий студенту (действие «Вернуть»)."""
    from datetime import datetime, timezone

    sub = db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="errorRecordNotFound")
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == sub.assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")

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
    sub.teacher_comment_author_id = current_user.id
    now = datetime.now(timezone.utc)
    sub.graded_at = now
    sub.returned_at = now

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

    grade_payload = None if final_grade is None else float(final_grade)
    n = Notification(
        user_id=sub.student_id,
        type="assignment_returned",
        title="assignment_returned",
        message=json.dumps(
            {
                "grade": grade_payload,
                "comment": (body.teacher_comment or "").strip(),
            },
            ensure_ascii=False,
        ),
        link=f"/app/courses/{a.course_id}?tab=classwork&assignmentId={a.id}",
    )
    db.add(n)
    db.commit()
    return {
        "ok": True,
        "submission_id": sub.id,
        "assignment_id": a.id,
        "student_id": sub.student_id,
        "grade": float(sub.grade) if sub.grade is not None else None,
        "teacher_comment": sub.teacher_comment,
        "graded_at": sub.graded_at.isoformat() if sub.graded_at else None,
        "returned_at": sub.returned_at.isoformat() if sub.returned_at else None,
        "is_returned": True,
    }


@router.post("/assignments/{assignment_id}/mark-reviewed")
def mark_assignment_reviewed(
    assignment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Отметить все сдачи задания как проверенные (поставить 0 тем, кто не сдал, или просто пометить)."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")

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
    """Отметить задание как непроверенное. Сбрасывает только автоматические оценки (0), выставленные через 'Mark Reviewed'."""
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")

    # Сбрасываем только те оценки, которые были выставлены автоматически
    # Ориентируемся на комментарии "Auto-graded as reviewed" и "Not submitted, marked as reviewed"
    submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.grade == 0,
        AssignmentSubmission.teacher_comment.in_([
            "Auto-graded as reviewed", 
            "Not submitted, marked as reviewed"
        ])
    ).all()
    
    for s in submissions:
        s.grade = None
        s.teacher_comment = None
        s.graded_at = None
        # Если это была пустая сдача (без текста и файла), которую мы создали автоматически, удаляем её
        if not s.submission_text and not s.file_url and not s.file_urls:
            db.delete(s)

    db.commit()
    return {"ok": True}


@router.get("/groups/{group_id}/synopses")
def list_group_synopses(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Список конспектов студентов группы для проверки."""
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    
    # Темы курса
    topics = db.query(CourseTopic).filter(CourseTopic.course_id == g.course_id).order_by(CourseTopic.order_number).all()
    topic_map = {t.id: t.title for t in topics}
    
    # Студенты группы
    student_ids = [gs.student_id for gs in g.students]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}
    
    # Все сдачи конспектов студентов этой группы по этому курсу
    # 1. Сдачи из новой унифицированной таблицы (TeacherAssignment + AssignmentSubmission)
    unified_assignments = db.query(TeacherAssignment).filter(
        TeacherAssignment.group_id == group_id,
        TeacherAssignment.is_synopsis == True,
        TeacherAssignment.is_supplementary == False
    ).all()
    unified_assignment_ids = [a.id for a in unified_assignments]
    
    unified_submissions = []
    if unified_assignment_ids:
        unified_submissions = db.query(AssignmentSubmission).filter(
            AssignmentSubmission.assignment_id.in_(unified_assignment_ids),
            AssignmentSubmission.student_id.in_(student_ids)
        ).all()

    # 2. Сдачи из старой легаси таблицы (TopicSynopsisSubmission)
    legacy_submissions = db.query(TopicSynopsisSubmission).filter(
        TopicSynopsisSubmission.topic_id.in_(topic_map.keys()),
        TopicSynopsisSubmission.user_id.in_(student_ids)
    ).all()
    
    result = []
    
    # Добавляем унифицированные
    for s in unified_submissions:
        a = s.assignment
        result.append({
            "id": f"unified-{s.id}", # Префикс чтобы фронт различал
            "user_id": s.student_id,
            "student_name": users[s.student_id].full_name if s.student_id in users else "Unknown",
            "topic_id": a.topic_id,
            "topic_title": topic_map.get(a.topic_id, a.title or "Unknown"),
            "file_url": s.file_url or (json.loads(s.file_urls)[0] if s.file_urls and json.loads(s.file_urls) else None),
            "note_text": s.submission_text,
            "grade": float(s.grade) if s.grade is not None else None,
            "teacher_comment": s.teacher_comment,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "graded_at": None, # В AssignmentSubmission нет отдельного graded_at
            "is_unified": True,
            "assignment_id": a.id
        })
        
    # Добавляем легаси
    for r in legacy_submissions:
        result.append({
            "id": f"legacy-{r.id}",
            "user_id": r.user_id,
            "student_name": users[r.user_id].full_name if r.user_id in users else "Unknown",
            "topic_id": r.topic_id,
            "topic_title": topic_map.get(r.topic_id, "Unknown"),
            "file_url": r.file_url,
            "note_text": r.note_text,
            "grade": float(r.grade) if r.grade is not None else None,
            "teacher_comment": r.teacher_comment,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "graded_at": r.graded_at.isoformat() if r.graded_at else None,
            "is_unified": False
        })

    # Сортируем всё по дате сдачи
    result.sort(key=lambda x: x["submitted_at"] or "", reverse=True)
    return result


@router.put("/synopses/{synopsis_id}/grade")
def grade_synopsis(
    synopsis_id: int,
    body: SubmissionGrade,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Оценить конспект студента."""
    from datetime import datetime, timezone
    r = db.query(TopicSynopsisSubmission).filter(TopicSynopsisSubmission.id == synopsis_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="errorSynopsisNotFound")
    
    # Проверка доступа к группе студента
    topic = r.topic
    if not topic:
        raise HTTPException(status_code=404, detail="topicNotFound")
    
    # Находим группу студента по этому курсу
    gs = db.query(GroupStudent).join(TeacherGroup, TeacherGroup.id == GroupStudent.group_id).filter(
        GroupStudent.student_id == r.user_id,
        TeacherGroup.course_id == topic.course_id
    ).first()
    
    if not gs or not _can_manage_group(current_user, gs.group):
        raise HTTPException(status_code=403, detail="errorNoAccessToStudentReview")
    
    r.grade = body.grade
    r.teacher_comment = body.teacher_comment
    r.graded_by_id = current_user.id
    r.graded_at = datetime.now(timezone.utc)
    
    # Уведомление студенту
    n = Notification(
        user_id=r.user_id,
        type="synopsis_graded",
        title="Конспект проверен",
        message=f"Ваш конспект по теме «{topic.title}» проверен. Статус: Проверено. {body.teacher_comment or ''}",
        link=f"/app/courses/{topic.course_id}/topic/{topic.id}",
    )
    db.add(n)
    
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
        raise HTTPException(status_code=403, detail={"code": "no_access_group"})
    if body.course_id != g.course_id:
        raise HTTPException(status_code=400, detail={"code": "course_group_mismatch"})
    if body.topic_id is not None:
        topic = db.query(CourseTopic).filter(
            CourseTopic.id == body.topic_id, CourseTopic.course_id == body.course_id
        ).first()
        if not topic:
            raise HTTPException(status_code=400, detail={"code": "topic_not_in_course"})
    target_ids = json.dumps(body.target_student_ids) if body.target_student_ids else None
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
        is_supplementary=body.is_supplementary,
        target_student_ids=target_ids,
    )
    db.add(m)
    db.flush()

    # Move files to permanent storage
    if body.attachment_urls:
        new_urls = move_files_to_permanent_storage("materials", m.id, body.attachment_urls)
        m.attachment_urls = json.dumps(new_urls)
    if body.video_urls:
        new_video_urls = move_files_to_permanent_storage("materials", m.id, body.video_urls)
        m.video_urls = json.dumps(new_video_urls)
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


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Удалить вопрос группы (вместе с ответами)."""
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="errorQuestionNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    db.delete(q)
    db.commit()
    return {"ok": True}


# ---------- Questions ----------
@router.get("/questions")
def list_questions(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    group_id: int | None = Query(None),
):
    is_admin = current_user.role in ("admin", "director", "curator")
    from app.models.group_teacher import GroupTeacher
    q_groups = db.query(TeacherGroup)
    if not is_admin:
        q_groups = q_groups.outerjoin(GroupTeacher).filter(
            (TeacherGroup.teacher_id == current_user.id) | (GroupTeacher.teacher_id == current_user.id)
        ).distinct()
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
        raise HTTPException(status_code=404, detail="errorMaterialNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
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
        "is_supplementary": bool(getattr(m, "is_supplementary", False)),
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
        raise HTTPException(status_code=404, detail="errorMaterialNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    
    if body.title is not None: m.title = body.title
    if body.description is not None: m.description = body.description
    if "topic_id" in body.__fields_set__:
        m.topic_id = body.topic_id if body.topic_id != 0 else None
    if body.video_urls is not None:
        new_video_urls = move_files_to_permanent_storage("materials", m.id, body.video_urls)
        m.video_urls = json.dumps(new_video_urls) if new_video_urls else None
    if body.image_urls is not None: m.image_urls = json.dumps(body.image_urls)
    if body.attachment_urls is not None:
        new_urls = move_files_to_permanent_storage("materials", m.id, body.attachment_urls)
        m.attachment_urls = json.dumps(new_urls) if new_urls else None
    if body.attachment_links is not None: m.attachment_links = json.dumps(body.attachment_links)
    if body.target_student_ids is not None:
        m.target_student_ids = json.dumps(body.target_student_ids) if body.target_student_ids else None
    
    db.commit()
    return {"ok": True}


@router.delete("/materials/{material_id}")
def delete_material(
    material_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Удалить учебный материал группы."""
    m = db.query(TeacherMaterial).filter(TeacherMaterial.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="errorMaterialNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    db.delete(m)
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
        raise HTTPException(status_code=404, detail="errorQuestionNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    return {
        "id": q.id,
        "group_id": q.group_id,
        "course_id": q.course_id,
        "question_text": q.question_text,
        "question_type": _question_type_for_response(q),
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
        raise HTTPException(status_code=404, detail="errorQuestionNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    
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
            "type": _question_type_for_response(q),
            "options": json.loads(q.options) if q.options else [],
            "correct_option": q.correct_option,
            "group_name": g.group_name,
            "allow_student_class_comments": bool(getattr(q, "allow_student_class_comments", True)),
        },
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
        raise HTTPException(status_code=404, detail="errorAnswerNotFound")
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == ans.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="errorQuestionNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")

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
        raise HTTPException(status_code=404, detail="errorAnswerNotFound")
    q = db.query(TeacherQuestion).filter(TeacherQuestion.id == ans.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="errorQuestionNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")

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
        raise HTTPException(status_code=404, detail="errorQuestionNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == q.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    
    if body.question_text is not None: q.question_text = body.question_text
    if body.question_type is not None: q.question_type = body.question_type
    
    if "topic_id" in body.__fields_set__:
        if body.topic_id and body.topic_id != 0:
            topic = db.query(CourseTopic).filter(
                CourseTopic.id == body.topic_id, CourseTopic.course_id == q.course_id
            ).first()
            if not topic:
                raise HTTPException(status_code=400, detail={"code": "topic_not_in_course"})
            q.topic_id = body.topic_id
        else:
            q.topic_id = None
            
    if body.options is not None: q.options = json.dumps(body.options)
    if body.correct_option is not None: q.correct_option = body.correct_option
    
    db.commit()
    return {"ok": True}





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
        raise HTTPException(status_code=404, detail="topicNotFound")
    
    # Check access
    is_admin = current_user.role in ("admin", "director", "curator")
    if not is_admin:
        has_group = db.query(TeacherGroup).filter(
            TeacherGroup.course_id == topic.course_id,
            TeacherGroup.teacher_id == current_user.id
        ).first()
        if not has_group:
            raise HTTPException(status_code=403, detail="errorNoAccess")

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
        raise HTTPException(status_code=404, detail="topicNotFound")
    
    # Check access
    is_admin = current_user.role in ("admin", "director", "curator")
    if not is_admin:
        has_group = db.query(TeacherGroup).filter(
            TeacherGroup.course_id == topic.course_id,
            TeacherGroup.teacher_id == current_user.id
        ).first()
        if not has_group:
            raise HTTPException(status_code=403, detail="errorNoAccess")

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
        raise HTTPException(status_code=404, detail="assignmentNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
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
        raise HTTPException(status_code=404, detail="errorMaterialNotFound")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == m.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="errorNoAccess")
    return {
        "group_id": m.group_id,
        "course_id": m.course_id,
        "topic_id": m.topic_id,
        "title": m.title,
        "description": m.description,
        "video_urls": json.loads(m.video_urls) if m.video_urls else [],
        "image_urls": json.loads(m.image_urls) if m.image_urls else [],
    }
