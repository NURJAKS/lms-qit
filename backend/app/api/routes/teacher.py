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


class GroupCreate(BaseModel):
    course_id: int
    group_name: str


class AddStudent(BaseModel):
    student_id: int


class RubricCriterionCreate(BaseModel):
    name: str
    max_points: float


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


class MaterialCreate(BaseModel):
    group_id: int
    course_id: int
    topic_id: int | None = None
    title: str
    description: str | None = None
    video_urls: list[str] | None = None
    image_urls: list[str] | None = None


class QuestionCreate(BaseModel):
    group_id: int
    course_id: int
    question_text: str
    question_type: str = "single_choice"  # single_choice, open
    options: list[str] | None = None
    correct_option: str | None = None


class TopicCreate(BaseModel):
    title: str
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
    """Статистика для дашборда учителя: группы, работы на проверку, студенты."""
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
    return {
        "groups_count": groups_count,
        "pending_submissions_count": pending_submissions_count,
        "students_count": students_count,
    }


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


@router.post("/groups", response_model=dict)
def create_group(
    body: GroupCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    g = TeacherGroup(teacher_id=current_user.id, course_id=body.course_id, group_name=body.group_name)
    db.add(g)
    db.commit()
    db.refresh(g)
    return {"id": g.id, "group_name": g.group_name}


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
    q = db.query(TeacherAssignment).filter(TeacherAssignment.group_id.in_(group_ids))
    if group_id:
        q = q.filter(TeacherAssignment.group_id == group_id)
    rows = q.order_by(TeacherAssignment.id.desc()).all()
    return [
        {
            "id": r.id,
            "group_id": r.group_id,
            "group_name": r.group.group_name if r.group else "",
            "course_id": r.course_id,
            "course_title": r.course.title if r.course else "",
            "title": r.title,
            "description": r.description,
            "deadline": r.deadline.isoformat() if r.deadline else None,
        }
        for r in rows
    ]


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
            r = TeacherAssignmentRubric(assignment_id=a.id, name=c.name, max_points=c.max_points)
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
            link="/app/tasks-calendar?tab=all-assignments",
        )
        db.add(notif)
    db.commit()

    return {"id": a.id, "title": a.title}


@router.patch("/assignments/{assignment_id}/deadline")
def update_assignment_deadline(
    assignment_id: int,
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
):
    """Обновить дедлайн задания."""
    from datetime import datetime
    a = db.query(TeacherAssignment).filter(TeacherAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    g = db.query(TeacherGroup).filter(TeacherGroup.id == a.group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=403, detail="Нет доступа к этому заданию")
    
    deadline = None
    if body.get("deadline"):
        try:
            deadline = datetime.fromisoformat(body["deadline"].replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Неверный формат даты")
    
    a.deadline = deadline
    db.commit()
    db.refresh(a)
    return {
        "id": a.id,
        "deadline": a.deadline.isoformat() if a.deadline else None,
    }


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
    student_ids = [r.student_id for r in rows]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}
    rubric_rows = db.query(TeacherAssignmentRubric).filter(TeacherAssignmentRubric.assignment_id == assignment_id).all()
    rubric = [{"id": c.id, "name": c.name, "max_points": float(c.max_points)} for c in rubric_rows]
    submission_grades = {}
    for sg in db.query(AssignmentSubmissionGrade).filter(
        AssignmentSubmissionGrade.submission_id.in_([r.id for r in rows])
    ).all():
        submission_grades.setdefault(sg.submission_id, []).append({"criterion_id": sg.criterion_id, "points": float(sg.points)})
    submissions = [
        {
            "id": r.id,
            "student_id": r.student_id,
            "student_name": (u.full_name or "") if (u := users.get(r.student_id)) else "",
            "submission_text": r.submission_text,
            "file_url": r.file_url,
            "file_urls": json.loads(r.file_urls) if r.file_urls else [],
            "grade": float(r.grade) if r.grade else None,
            "teacher_comment": r.teacher_comment,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "rubric_grades": submission_grades.get(r.id, []),
        }
        for r in rows
    ]
    return {"submissions": submissions, "rubric": rubric}


@router.get("/groups/{group_id}/progress/csv")
def export_group_progress_csv(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    course_id: int | None = Query(None),
):
    import csv
    import io
    g = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not g or not _can_manage_group(current_user, g):
        raise HTTPException(status_code=404, detail="Группа не найдена")
    student_ids = [gs.student_id for gs in g.students]
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Full Name", "Email", "Topic ID", "Completed", "Score"])
    
    if student_ids:
        users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()}
        q = db.query(StudentProgress).filter(StudentProgress.user_id.in_(student_ids))
        if course_id:
            q = q.filter(StudentProgress.course_id == course_id)
        rows = q.all()
        for r in rows:
            u = users.get(r.user_id)
            writer.writerow([r.user_id, u.full_name if u else "", u.email if u else "", r.topic_id, r.is_completed, r.test_score])
    
    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()  # UTF-8 BOM для корректного отображения в Excel
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=group_progress.csv"},
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
        link="/app/tasks-calendar?tab=all-assignments",
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
    rubric = [{"name": c.name, "max_points": float(c.max_points)} for c in a.rubric_criteria]
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
