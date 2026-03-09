from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, exists, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_admin_or_director, get_current_teacher_user
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import CourseEnrollment
from app.models.progress import StudentProgress
from app.models.certificate import Certificate
from app.models.teacher_group import TeacherGroup
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.add_student_task import AddStudentTask
from app.models.activity_log import UserActivityLog
from app.models.course_category import CourseCategory
from app.models.course_module import CourseModule
from app.models.course_topic import CourseTopic
from app.models.test import Test
from app.models.test_question import TestQuestion
from app.models.course_application import CourseApplication
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.user_purchase import UserPurchase
from app.models.shop_item import ShopItem
from datetime import datetime
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserWithRelationsResponse, ChildInfo, CourseInfo
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseResponse,
    CourseModuleCreate,
    CourseModuleResponse,
    CourseTopicCreate,
    CourseTopicResponse,
    CourseCategoryCreate,
    CourseCategoryResponse,
)
from app.schemas.test import TestCreate, TestUpdate, TestResponse, TestQuestionCreate, TestQuestionUpdate, TestQuestionResponse
from app.services.activity_log import log_activity

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- Users ----------
@router.get("/overview")
def admin_overview(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Обзор процессов и отделов платформы."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func
    
    users_count = db.query(User).count()
    courses_count = db.query(Course).filter(Course.is_active == True).count()
    enrollments_count = db.query(CourseEnrollment).count()
    progress_count = db.query(StudentProgress).filter(StudentProgress.is_completed == True).count()
    certificates_count = db.query(Certificate).count()
    groups_count = db.query(TeacherGroup).count()
    assignments_count = db.query(TeacherAssignment).count()
    activity_logs_count = db.query(UserActivityLog).count()
    
    # Статистика по ролям
    role_stats = db.query(
        User.role,
        func.count(User.id).label('count')
    ).group_by(User.role).all()
    users_by_role = {role: count for role, count in role_stats}
    
    # Новые пользователи за последние 7 дней
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_week = db.query(User).filter(User.created_at >= week_ago).count()
    
    # Новые записи на курсы за последние 7 дней
    new_enrollments_week = db.query(CourseEnrollment).filter(CourseEnrollment.enrolled_at >= week_ago).count()
    
    # Активные курсы (с записями)
    active_courses = db.query(Course).filter(
        Course.is_active == True,
        Course.id.in_(db.query(CourseEnrollment.course_id).distinct())
    ).count()
    
    # Ожидающие одобрения пользователи
    pending_users = db.query(User).filter(User.is_approved == False).count()
    
    # Ожидающие модерации курсы
    pending_courses = db.query(Course).filter(Course.is_moderated == False).count()

    departments = [
        {"id": "users", "name": "Пользователи", "count": users_count, "importance": "high", "description": "Управление пользователями, ролями"},
        {"id": "courses", "name": "Курсы", "count": courses_count, "importance": "high", "description": "Каталог курсов, модули, темы"},
        {"id": "enrollments", "name": "Записи на курсы", "count": enrollments_count, "importance": "high", "description": "Студенты и их курсы"},
        {"id": "progress", "name": "Прогресс", "count": progress_count, "importance": "high", "description": "Завершённые темы, тесты"},
        {"id": "certificates", "name": "Сертификаты", "count": certificates_count, "importance": "medium", "description": "Выданные сертификаты"},
        {"id": "groups", "name": "Группы", "count": groups_count, "importance": "medium", "description": "Учебные группы преподавателей"},
        {"id": "assignments", "name": "Домашние задания", "count": assignments_count, "importance": "medium", "description": "Тапсырмалар и сдача"},
        {"id": "activity", "name": "Журнал активности", "count": activity_logs_count, "importance": "low", "description": "Логи действий пользователей"},
    ]
    
    return {
        "departments": departments,
        "total_users": users_count,
        "total_courses": courses_count,
        "users_by_role": users_by_role,
        "new_users_week": new_users_week,
        "new_enrollments_week": new_enrollments_week,
        "active_courses": active_courses,
        "pending_users": pending_users,
        "pending_courses": pending_courses,
    }


@router.post("/trigger-daily-rewards")
def trigger_daily_rewards(
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Ручной запуск ежедневных наград топ-5 рейтинга (для тестирования)."""
    from app.jobs.daily_rewards import run_daily_leaderboard_rewards
    awarded = run_daily_leaderboard_rewards()
    return {"awarded": awarded, "message": f"Начислено наград: {awarded}"}


# ---------- Course Applications (Список заявок) ----------
@router.get("/applications")
def list_applications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    status: str | None = Query(None, description="pending, approved, rejected"),
):
    q = db.query(CourseApplication).order_by(CourseApplication.created_at.desc())
    if status:
        q = q.filter(CourseApplication.status == status)
    apps = q.all()
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_([a.course_id for a in apps])).all()}
    users = {u.id: u for u in db.query(User).filter(User.id.in_([a.user_id for a in apps])).all()}
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "course_id": a.course_id,
            "status": a.status,
            "email": a.email,
            "full_name": a.full_name,
            "phone": a.phone or "",
            "city": getattr(a, "city", None) or "",
            "parent_email": getattr(a, "parent_email", None) or "",
            "parent_full_name": getattr(a, "parent_full_name", None) or "",
            "parent_phone": getattr(a, "parent_phone", None) or "",
            "parent_city": getattr(a, "parent_city", None) or "",
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "approved_at": a.approved_at.isoformat() if a.approved_at else None,
            "course_title": courses.get(a.course_id).title if courses.get(a.course_id) else None,
        }
        for a in apps
    ]


@router.post("/applications/{app_id}/approve")
def approve_application(
    app_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    from datetime import datetime, timezone
    app = db.query(CourseApplication).filter(CourseApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже обработана")
    user = db.query(User).filter(User.id == app.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    course = db.query(Course).filter(Course.id == app.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    is_first_approval = not user.is_approved
    user.is_approved = True
    amount = float(course.price or 0)
    existing_enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == user.id,
        CourseEnrollment.course_id == app.course_id,
    ).first()
    if not existing_enrollment:
        if amount > 0:
            # Создаём pending payment — студент оплатит на дашборде
            existing_payment = db.query(Payment).filter(
                Payment.user_id == user.id,
                Payment.course_id == app.course_id,
                Payment.status == "pending",
            ).first()
            if not existing_payment:
                payment = Payment(
                    user_id=user.id,
                    course_id=app.course_id,
                    amount=amount,
                    status="pending",
                )
                db.add(payment)
        else:
            # Бесплатный курс — сразу даём доступ
            enrollment = CourseEnrollment(
                user_id=user.id,
                course_id=app.course_id,
                payment_confirmed=True,
                payment_amount=0,
            )
            db.add(enrollment)
    app.status = "approved"
    app.approved_at = datetime.now(timezone.utc)
    app.approved_by = current_user.id

    new_password = None
    if is_first_approval:
        from app.core.security import get_password_hash
        import secrets
        import string
        new_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
        user.password_hash = get_password_hash(new_password)

    pay_msg = f"Оплатите {amount}₸ по курсу «{course.title}» для доступа к материалам. " if amount > 0 else ""
    creds_msg = f" Логин: {user.email}, пароль: {new_password}." if new_password else ""
    notif = Notification(
        user_id=user.id,
        type="application_approved",
        title="Заявка одобрена",
        message=f"Ваша заявка одобрена. {pay_msg}{creds_msg}".strip(),
        link="/app",
    )
    db.add(notif)
    if user.parent_id:
        parent_notif = Notification(
            user_id=user.parent_id,
            type="application_approved",
            title="Заявка ребёнка одобрена",
            message=f"Заявка на курс «{course.title}» одобрена. Вы можете войти в личный кабинет и отслеживать прогресс обучения.",
            link="/app/parent-dashboard",
        )
        db.add(parent_notif)
    db.commit()
    result = {
        "message": "Заявка одобрена",
        "login": user.email,
        "user_id": user.id,
        "course_id": app.course_id,
    }
    if new_password:
        result["password"] = new_password
    return result


class AssignCuratorRequest(BaseModel):
    group_id: int


@router.post("/applications/{app_id}/assign-curator")
def assign_curator(
    app_id: int,
    body: AssignCuratorRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Назначить куратору/учителю задачу добавить студента в группу (для оплаченных заявок)."""
    app = db.query(CourseApplication).filter(CourseApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if app.status != "paid":
        raise HTTPException(status_code=400, detail="Только оплаченные заявки можно назначить куратору")
    student = db.query(User).filter(User.id == app.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    group = db.query(TeacherGroup).filter(TeacherGroup.id == body.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if group.course_id != app.course_id:
        raise HTTPException(status_code=400, detail="Группа не соответствует курсу заявки")
    course = db.query(Course).filter(Course.id == app.course_id).first()
    course_title = course.title if course else "Курс"

    task = AddStudentTask(
        manager_id=current_user.id,
        teacher_id=group.teacher_id,
        student_id=app.user_id,
        group_id=body.group_id,
        status="pending",
    )
    db.add(task)

    notif = Notification(
        user_id=group.teacher_id,
        type="add_student_task",
        title="Добавьте студента в группу",
        message=f"Студент {student.full_name or student.email} оплатил курс «{course_title}». Добавьте его в группу «{group.group_name}».",
        link="/app/teacher?tab=students",
    )
    db.add(notif)

    db.commit()
    return {"message": "Задача назначена куратору", "task_id": task.id}


@router.post("/applications/{app_id}/reject")
def reject_application(
    app_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    from datetime import datetime, timezone
    app = db.query(CourseApplication).filter(CourseApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже обработана")
    app.status = "rejected"
    app.approved_at = datetime.now(timezone.utc)
    app.approved_by = current_user.id
    db.commit()
    return {"message": "Заявка отклонена"}


@router.get("/activity-logs")
def list_activity_logs(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    limit: int = 50,
):
    logs = db.query(UserActivityLog).order_by(UserActivityLog.created_at.desc()).limit(limit).all()
    users = {u.id: u.full_name for u in db.query(User).filter(User.id.in_([l.user_id for l in logs if l.user_id])).all()}
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_name": users.get(l.user_id) if l.user_id else None,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/users", response_model=list[UserWithRelationsResponse])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_teacher_user)],
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    role: str | None = None,
    include_children: bool = Query(False, description="Include children information for parents"),
    include_relations: bool = Query(False, description="Include full relations for all roles"),
):
    q = db.query(User)
    if search:
        q = q.filter(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    if role:
        q = q.filter(User.role == role)
    users = q.offset(skip).limit(limit).all()
    
    should_include = include_children or include_relations
    if not should_include:
        return users

    # Pre-fetch relations for efficiency
    user_ids = [u.id for u in users]
    
    # Groups for teachers/curators
    teacher_groups = db.query(TeacherGroup).filter(TeacherGroup.teacher_id.in_(user_ids)).all()
    groups_by_teacher = {}
    for tg in teacher_groups:
        if tg.teacher_id not in groups_by_teacher:
            groups_by_teacher[tg.teacher_id] = []
        groups_by_teacher[tg.teacher_id].append(tg)
        
    # Students for those groups
    tg_ids = [tg.id for tg in teacher_groups]
    group_students = []
    if tg_ids:
        group_students = db.query(GroupStudent).filter(GroupStudent.group_id.in_(tg_ids)).all()
    
    student_ids_for_teachers = [gs.student_id for gs in group_students]
    students_data = {}
    if student_ids_for_teachers:
        students_list = db.query(User).filter(User.id.in_(student_ids_for_teachers)).all()
        students_data = {s.id: s for s in students_list}

    # Relations for students (their groups and teachers)
    student_memberships = db.query(GroupStudent).filter(GroupStudent.student_id.in_(user_ids)).all()
    membership_group_ids = [ms.group_id for ms in student_memberships]
    membership_groups = {}
    if membership_group_ids:
        m_groups = db.query(TeacherGroup).filter(TeacherGroup.id.in_(membership_group_ids)).all()
        membership_groups = {g.id: g for g in m_groups}
    
    teacher_ids_for_students = [g.teacher_id for g in membership_groups.values()]
    teachers_data = {}
    if teacher_ids_for_students:
        teachers_list = db.query(User).filter(User.id.in_(teacher_ids_for_students)).all()
        teachers_data = {t.id: t for t in teachers_list}

    # Children for parents
    parent_ids = [u.id for u in users if u.role == "parent"]
    children_by_parent = {}
    if parent_ids:
        children = db.query(User).filter(User.parent_id.in_(parent_ids), User.role == "student").all()
        for child in children:
            if child.parent_id not in children_by_parent:
                children_by_parent[child.parent_id] = []
            children_by_parent[child.parent_id].append(child)
            
    # All relevant student IDs for extra info (children + students of teachers)
    all_student_ids = set()
    for child_list in children_by_parent.values():
        all_student_ids.update([c.id for c in child_list])
    all_student_ids.update(student_ids_for_teachers)
    
    # Extra info for students (courses, progress)
    enrollments = {}
    if all_student_ids:
        enrollments_list = db.query(CourseEnrollment).filter(CourseEnrollment.user_id.in_(list(all_student_ids))).all()
        for e in enrollments_list:
            if e.user_id not in enrollments:
                enrollments[e.user_id] = []
            enrollments[e.user_id].append(e.course_id)
            
    course_ids = set()
    for c_list in enrollments.values():
        course_ids.update(c_list)
    courses_dict = {}
    if course_ids:
        courses = db.query(Course).filter(Course.id.in_(list(course_ids))).all()
        courses_dict = {c.id: c for c in courses}
        
    completed_courses = {}
    if all_student_ids:
        certs = db.query(Certificate).filter(Certificate.user_id.in_(list(all_student_ids))).all()
        for cert in certs:
            if cert.user_id not in completed_courses:
                completed_courses[cert.user_id] = set()
            completed_courses[cert.user_id].add(cert.course_id)

    # Re-fetch child memberships for children list
    child_memberships = {}
    if all_student_ids:
        cms = db.query(GroupStudent).filter(GroupStudent.student_id.in_(list(all_student_ids))).all()
        for cm in cms:
            if cm.student_id not in child_memberships:
                child_memberships[cm.student_id] = []
            child_memberships[cm.student_id].append(cm.group_id)

    result = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "photo_url": user.photo_url,
            "description": user.description,
            "phone": user.phone,
            "birth_date": user.birth_date,
            "city": user.city,
            "address": user.address,
            "parent_id": user.parent_id,
            "points": user.points or 0,
            "is_premium": user.is_premium or 0,
            "is_approved": user.is_approved,
            "has_group_access": None,
            "created_at": user.created_at,
            "children": None,
            "students": None,
            "teachers_curators": None,
            "groups": None,
        }

        # Populate children (for parents)
        if user.role == "parent" and user.id in children_by_parent:
            clist = []
            for child in children_by_parent[user.id]:
                # Unique courses
                seen_course_ids = set()
                c_courses = []
                for cid in enrollments.get(child.id, []):
                    if cid in courses_dict and cid not in seen_course_ids:
                        c_courses.append({"id": cid, "title": courses_dict[cid].title})
                        seen_course_ids.add(cid)
                
                g_name, t_name = None, None
                if child.id in child_memberships:
                    gid = child_memberships[child.id][0] # Just first group for compatibility
                    if gid in membership_groups:
                        g_name = membership_groups[gid].group_name
                        tid = membership_groups[gid].teacher_id
                        if tid in teachers_data:
                            t_name = teachers_data[tid].full_name
                
                clist.append({
                    "id": child.id,
                    "full_name": child.full_name,
                    "email": child.email,
                    "courses": c_courses,
                    "group_name": g_name,
                    "teacher_name": t_name,
                    "courses_count": len(enrollments.get(child.id, [])),
                    "completed_courses_count": len(completed_courses.get(child.id, set())),
                })
            user_dict["children"] = clist

        # Populate students (for teachers/curators)
        if user.role in ["teacher", "curator"] and user.id in groups_by_teacher:
            slist = []
            groups_seen = set()
            added_student_ids = set()
            for tg in groups_by_teacher[user.id]:
                groups_seen.add(tg.group_name)
                for gs in group_students:
                    if gs.group_id == tg.id and gs.student_id in students_data:
                        s = students_data[gs.student_id]
                        if s.id not in added_student_ids:
                            added_student_ids.add(s.id)
                            slist.append({
                                "id": s.id,
                                "full_name": s.full_name,
                                "email": s.email,
                                "role": s.role
                            })
            user_dict["students"] = slist
            user_dict["groups"] = list(groups_seen)

        # Populate teachers/curators (for students)
        if user.role == "student":
            tlist = []
            glist = []
            added_teacher_ids = set()
            for ms in student_memberships:
                if ms.student_id == user.id and ms.group_id in membership_groups:
                    tg = membership_groups[ms.group_id]
                    glist.append(tg.group_name)
                    if tg.teacher_id in teachers_data:
                        t = teachers_data[tg.teacher_id]
                        if t.id not in added_teacher_ids:
                            added_teacher_ids.add(t.id)
                            tlist.append({
                                "id": t.id,
                                "full_name": t.full_name,
                                "email": t.email,
                                "role": t.role
                            })
            user_dict["teachers_curators"] = tlist
            user_dict["groups"] = list(set(glist))

        result.append(user_dict)
    
    return result


@router.post("/users", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_or_director)],
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email уже занят")
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        photo_url=data.photo_url,
        description=data.description,
        phone=data.phone,
        birth_date=data.birth_date,
        address=data.address,
        parent_id=data.parent_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, current_user.id, "user_created", "user", user.id, {"email": user.email, "role": user.role})
    return user


@router.get("/users/{user_id}/detail")
def get_user_detail(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Полная информация о пользователе: профиль, родитель (если студент), заявки."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    parent = None
    if user.parent_id:
        parent = db.query(User).filter(User.id == user.parent_id).first()
    apps = db.query(CourseApplication).filter(CourseApplication.user_id == user_id).order_by(CourseApplication.created_at.desc()).all()
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_([a.course_id for a in apps])).all()}
    applications = [
        {
            "id": a.id,
            "course_id": a.course_id,
            "course_title": courses.get(a.course_id).title if courses.get(a.course_id) else None,
            "status": a.status,
            "email": a.email,
            "full_name": a.full_name,
            "phone": a.phone or "",
            "city": getattr(a, "city", None) or "",
            "parent_email": getattr(a, "parent_email", None) or "",
            "parent_full_name": getattr(a, "parent_full_name", None) or "",
            "parent_phone": getattr(a, "parent_phone", None) or "",
            "parent_city": getattr(a, "parent_city", None) or "",
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "approved_at": a.approved_at.isoformat() if a.approved_at else None,
        }
        for a in apps
    ]
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "phone": user.phone or "",
            "address": user.address or "",
            "birth_date": user.birth_date.isoformat() if user.birth_date else None,
            "parent_id": user.parent_id,
            "is_approved": user.is_approved,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "parent": {
            "id": parent.id,
            "email": parent.email,
            "full_name": parent.full_name,
            "phone": parent.phone or "",
            "address": parent.address or "",
        } if parent else None,
        "applications": applications,
    }


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_or_director)],
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.photo_url is not None:
        user.photo_url = data.photo_url
    if data.description is not None:
        user.description = data.description
    if "phone" in data.model_dump(exclude_unset=True):
        user.phone = data.phone
    if "birth_date" in data.model_dump(exclude_unset=True):
        user.birth_date = data.birth_date
    if "address" in data.model_dump(exclude_unset=True):
        user.address = data.address
    if "parent_id" in data.model_dump(exclude_unset=True):
        user.parent_id = data.parent_id
    if data.password is not None and data.password.strip():
        user.password_hash = get_password_hash(data.password)
    db.commit()
    db.refresh(user)
    log_activity(db, current_user.id, "user_updated", "user", user_id, {"full_name": user.full_name, "role": user.role})
    return user


@router.get("/users/export/csv")
def export_users_csv(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_or_director)],
):
    import csv
    import io
    users = db.query(User).order_by(User.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Email", "Full Name", "Role", "Created At"])
    for u in users:
        writer.writerow([u.id, u.email, u.full_name, u.role, u.created_at.isoformat() if u.created_at else ""])
    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()  # UTF-8 BOM для корректного отображения в Excel
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=users.csv"},
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_or_director)],
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    log_activity(db, current_user.id, "user_deleted", "user", user_id, {"email": user.email})
    db.delete(user)
    db.commit()
    return {"ok": True}


# ---------- Students without group ----------
@router.get("/students-without-group")
def list_students_without_group(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Студенты с CourseEnrollment, но без GroupStudent по этому курсу."""
    subq = (
        select(1)
        .select_from(GroupStudent)
        .join(TeacherGroup, GroupStudent.group_id == TeacherGroup.id)
        .where(
            and_(
                TeacherGroup.course_id == CourseEnrollment.course_id,
                GroupStudent.student_id == CourseEnrollment.user_id,
            )
        )
    )
    rows = (
        db.query(CourseEnrollment, User, Course)
        .join(User, CourseEnrollment.user_id == User.id)
        .join(Course, CourseEnrollment.course_id == Course.id)
        .filter(~exists(subq))
        .order_by(CourseEnrollment.enrolled_at.desc())
        .all()
    )
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone or "",
            "course_id": c.id,
            "course_title": c.title,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
        }
        for e, u, c in rows
    ]


class AddStudentTaskCreate(BaseModel):
    student_id: int
    teacher_id: int
    group_id: int


@router.get("/teacher-groups")
def list_teacher_groups_for_course(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    course_id: int = Query(..., description="Course ID to filter groups"),
):
    """Группы учителей по курсу (для модалки назначения)."""
    rows = (
        db.query(TeacherGroup, User)
        .join(User, TeacherGroup.teacher_id == User.id)
        .filter(TeacherGroup.course_id == course_id)
        .order_by(TeacherGroup.group_name)
        .all()
    )
    return [
        {
            "id": g.id,
            "group_name": g.group_name,
            "teacher_id": g.teacher_id,
            "teacher_name": u.full_name or u.email,
        }
        for g, u in rows
    ]


@router.post("/add-student-tasks")
def create_add_student_task(
    data: AddStudentTaskCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Создать задачу «добавить студента в группу» и уведомить учителя."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == data.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    if group.teacher_id != data.teacher_id:
        raise HTTPException(status_code=400, detail="Группа не принадлежит указанному учителю")
    student = db.query(User).filter(User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.user_id == data.student_id,
        CourseEnrollment.course_id == group.course_id,
    ).first()
    if not enrollment:
        # Разрешаем назначение при одобренной заявке (студент ещё может не оплатить)
        app = db.query(CourseApplication).filter(
            CourseApplication.user_id == data.student_id,
            CourseApplication.course_id == group.course_id,
            CourseApplication.status == "approved",
        ).first()
        if not app:
            raise HTTPException(status_code=400, detail="Студент не записан на курс группы")
    teacher = db.query(User).filter(User.id == data.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Учитель не найден")

    task = AddStudentTask(
        manager_id=current_user.id,
        teacher_id=data.teacher_id,
        student_id=data.student_id,
        group_id=data.group_id,
        status="pending",
    )
    db.add(task)
    db.flush()

    notif = Notification(
        user_id=data.teacher_id,
        type="add_student_task",
        title="Добавьте студента в группу",
        message=f"Менеджер назначил задачу: добавить {student.full_name or student.email} в группу «{group.group_name}».",
        link="/app/teacher?tab=students",
    )
    db.add(notif)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "status": task.status}


# ---------- Categories ----------
@router.get("/categories", response_model=list[CourseCategoryResponse])
def list_categories(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    return db.query(CourseCategory).all()


@router.post("/categories", response_model=CourseCategoryResponse)
def create_category(
    data: CourseCategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_or_director)],
):
    cat = CourseCategory(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ---------- Courses ----------
@router.get("/courses", response_model=list[CourseResponse])
def list_courses_admin(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    is_active: bool | None = None,
):
    q = db.query(Course)
    if is_active is not None:
        q = q.filter(Course.is_active == is_active)
    return q.order_by(Course.id).all()


@router.post("/courses", response_model=CourseResponse)
def create_course(
    data: CourseCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    course = Course(
        **data.model_dump(exclude_unset=True),
        created_by=current_user.id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    log_activity(db, current_user.id, "course_created", "course", course.id, {"title": course.title})
    return course


@router.get("/courses/{course_id}", response_model=CourseResponse)
def get_course_admin(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return course


@router.patch("/courses/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    data: CourseUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    log_activity(db, current_user.id, "course_updated", "course", course_id, {"title": course.title})
    return course


@router.delete("/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_or_director)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    log_activity(db, current_user.id, "course_deleted", "course", course_id, {"title": course.title})
    db.delete(course)
    db.commit()
    return {"ok": True}



@router.get("/moderation/courses")
def list_unmoderated_courses(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """List courses where is_moderated=False."""
    rows = db.query(Course).filter(Course.is_moderated == False).order_by(Course.id).all()
    return [{"id": r.id, "title": r.title, "description": r.description, "is_active": r.is_active} for r in rows]


# ---------- Modules ----------
@router.post("/courses/{course_id}/modules", response_model=CourseModuleResponse)
def create_module(
    course_id: int,
    data: CourseModuleCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    if data.course_id != course_id:
        raise HTTPException(status_code=400, detail="course_id не совпадает")
    mod = CourseModule(**data.model_dump())
    db.add(mod)
    db.commit()
    db.refresh(mod)
    return mod


@router.patch("/modules/{module_id}", response_model=CourseModuleResponse)
def update_module(
    module_id: int,
    data: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    mod = db.query(CourseModule).filter(CourseModule.id == module_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Модуль не найден")
    for k, v in data.items():
        if hasattr(mod, k):
            setattr(mod, k, v)
    db.commit()
    db.refresh(mod)
    return mod


# ---------- Topics ----------
@router.post("/courses/{course_id}/topics", response_model=CourseTopicResponse)
def create_topic(
    course_id: int,
    data: CourseTopicCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    if data.course_id != course_id:
        raise HTTPException(status_code=400, detail="course_id не совпадает")
    topic = CourseTopic(**data.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


@router.patch("/topics/{topic_id}", response_model=CourseTopicResponse)
def update_topic(
    topic_id: int,
    data: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    for k, v in data.items():
        if hasattr(topic, k):
            setattr(topic, k, v)
    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/video", response_model=CourseTopicResponse)
async def upload_topic_video(
    topic_id: int,
    file: Annotated[UploadFile, File()],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    if not file.filename or not file.filename.lower().endswith((".mp4", ".webm", ".mov")):
        raise HTTPException(status_code=400, detail="Только видео файлы (mp4, webm, mov)")
    uploads = Path(__file__).resolve().parent.parent.parent / "uploads" / "videos"
    course_dir = uploads / f"course{topic.course_id}"
    course_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "video").suffix or ".mp4"
    dest = course_dir / f"topic{topic_id}{ext}"
    content = await file.read()
    dest.write_bytes(content)
    topic.video_url = f"/uploads/videos/course{topic.course_id}/topic{topic_id}{ext}"
    db.commit()
    db.refresh(topic)
    return topic


# ---------- Tests ----------
@router.get("/courses/{course_id}/tests", response_model=list[TestResponse])
def list_tests_for_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return db.query(Test).filter(Test.course_id == course_id).order_by(Test.id).all()


@router.post("/courses/{course_id}/tests", response_model=TestResponse)
def create_test(
    course_id: int,
    data: TestCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    if data.course_id != course_id:
        raise HTTPException(status_code=400, detail="course_id не совпадает")
    test = Test(
        topic_id=data.topic_id,
        course_id=data.course_id,
        title=data.title,
        passing_score=data.passing_score,
        question_count=data.question_count,
        is_final=1 if data.is_final else 0,
        time_limit_seconds=data.time_limit_seconds,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@router.patch("/tests/{test_id}", response_model=TestResponse)
def update_test(
    test_id: int,
    data: TestUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "is_final":
            setattr(test, k, 1 if v else 0)
        else:
            setattr(test, k, v)
    db.commit()
    db.refresh(test)
    return test


@router.delete("/tests/{test_id}")
def delete_test(
    test_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    db.delete(test)
    db.commit()
    return {"ok": True}


@router.post("/tests/{test_id}/questions", response_model=TestQuestionResponse)
def add_question(
    test_id: int,
    data: TestQuestionCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    if data.test_id != test_id:
        raise HTTPException(status_code=400, detail="test_id не совпадает")
    q = TestQuestion(**data.model_dump())
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.get("/tests/{test_id}/questions", response_model=list[TestQuestionResponse])
def list_questions(
    test_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    return db.query(TestQuestion).filter(TestQuestion.test_id == test_id).order_by(TestQuestion.order_number).all()


@router.patch("/tests/{test_id}/questions/{question_id}", response_model=TestQuestionResponse)
def update_question(
    test_id: int,
    question_id: int,
    data: TestQuestionUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    q = db.query(TestQuestion).filter(
        TestQuestion.id == question_id,
        TestQuestion.test_id == test_id,
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(q, k, v)
    db.commit()
    db.refresh(q)
    return q


@router.delete("/tests/{test_id}/questions/{question_id}")
def delete_question(
    test_id: int,
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    q = db.query(TestQuestion).filter(
        TestQuestion.id == question_id,
        TestQuestion.test_id == test_id,
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Вопрос не найден")
    db.delete(q)
    db.commit()
    return {"ok": True}


# ---------- Shop Purchases Management ----------
@router.get("/shop/purchases")
def list_shop_purchases(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    user_id: int | None = Query(None, description="Filter by user ID"),
    delivery_status: str | None = Query(None, description="Filter by delivery status: pending, processing, shipped, delivered"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Список всех покупок студентов с фильтрами."""
    q = db.query(UserPurchase).order_by(UserPurchase.purchased_at.desc())
    
    if user_id:
        q = q.filter(UserPurchase.user_id == user_id)
    if delivery_status:
        q = q.filter(UserPurchase.delivery_status == delivery_status)
    
    purchases = q.offset(skip).limit(limit).all()
    
    # Get related data
    user_ids = {p.user_id for p in purchases}
    item_ids = {p.shop_item_id for p in purchases}
    courier_ids = {p.courier_id for p in purchases if p.courier_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    items = {i.id: i for i in db.query(ShopItem).filter(ShopItem.id.in_(item_ids)).all()}
    couriers = {u.id: u for u in db.query(User).filter(User.id.in_(courier_ids)).all()} if courier_ids else {}
    
    result = []
    for p in purchases:
        user = users.get(p.user_id)
        item = items.get(p.shop_item_id)
        courier = couriers.get(p.courier_id) if p.courier_id else None
        if user and item:
            result.append({
                "id": p.id,
                "user_id": p.user_id,
                "user_name": user.full_name,
                "user_email": user.email,
                "shop_item_id": p.shop_item_id,
                "item_title": item.title,
                "item_price_coins": item.price_coins,
                "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
                "delivery_status": p.delivery_status,
                "estimated_delivery_date": p.estimated_delivery_date.isoformat() if p.estimated_delivery_date else None,
                "delivered_at": p.delivered_at.isoformat() if p.delivered_at else None,
                "courier_id": p.courier_id,
                "courier_name": courier.full_name if courier else None,
            })
    
    return result


@router.get("/shop/purchases/stats")
def get_shop_purchases_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Статистика по покупкам."""
    total_purchases = db.query(UserPurchase).count()
    pending = db.query(UserPurchase).filter(UserPurchase.delivery_status == "pending").count()
    processing = db.query(UserPurchase).filter(UserPurchase.delivery_status == "processing").count()
    shipped = db.query(UserPurchase).filter(UserPurchase.delivery_status == "shipped").count()
    delivered = db.query(UserPurchase).filter(UserPurchase.delivery_status == "delivered").count()
    
    return {
        "total_purchases": total_purchases,
        "pending": pending,
        "processing": processing,
        "shipped": shipped,
        "delivered": delivered,
    }


class DeliveryStatusUpdate(BaseModel):
    delivery_status: str  # pending, processing, shipped, delivered


class AssignCourierRequest(BaseModel):
    courier_id: int


@router.patch("/shop/purchases/{purchase_id}/delivery-status")
def update_delivery_status(
    purchase_id: int,
    data: DeliveryStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Обновить статус доставки покупки."""
    valid_statuses = ["pending", "processing", "shipped", "delivered"]
    if data.delivery_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Неверный статус. Допустимые значения: {', '.join(valid_statuses)}"
        )
    
    purchase = db.query(UserPurchase).filter(UserPurchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Покупка не найдена")
    
    purchase.delivery_status = data.delivery_status
    
    # Set delivered_at when status is "delivered"
    if data.delivery_status == "delivered" and not purchase.delivered_at:
        purchase.delivered_at = datetime.utcnow()
    
    db.commit()
    db.refresh(purchase)
    
    return {
        "ok": True,
        "message": "Статус доставки обновлен",
        "purchase_id": purchase.id,
        "delivery_status": purchase.delivery_status,
        "delivered_at": purchase.delivered_at.isoformat() if purchase.delivered_at else None,
    }


@router.get("/shop/purchases/couriers")
def list_couriers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Список всех курьеров с их статистикой доставок."""
    # Получаем только пользователей с ролью 'courier'
    couriers = db.query(User).filter(User.role == "courier").all()
    
    result = []
    for courier in couriers:
        # Статистика доставок для этого курьера
        total_deliveries = db.query(UserPurchase).filter(UserPurchase.courier_id == courier.id).count()
        pending_deliveries = db.query(UserPurchase).filter(
            UserPurchase.courier_id == courier.id,
            UserPurchase.delivery_status.in_(["pending", "processing", "shipped"])
        ).count()
        delivered_count = db.query(UserPurchase).filter(
            UserPurchase.courier_id == courier.id,
            UserPurchase.delivery_status == "delivered"
        ).count()
        
        result.append({
            "id": courier.id,
            "full_name": courier.full_name,
            "email": courier.email,
            "phone": courier.phone,
            "deliveries_count": total_deliveries,
            "pending_deliveries": pending_deliveries,
            "delivered_count": delivered_count,
        })
    
    return result


@router.get("/shop/purchases/available-couriers")
def get_available_couriers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    search: str | None = None,
):
    """Получить список всех пользователей, которые могут быть назначены курьерами."""
    # Получаем только пользователей с ролью 'courier'
    q = db.query(User).filter(User.role == "courier")
    
    if search:
        q = q.filter(
            User.full_name.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%") |
            (User.phone.isnot(None) & User.phone.ilike(f"%{search}%"))
        )
    
    users = q.order_by(User.full_name).limit(100).all()
    
    result = []
    for user in users:
        # Статистика доставок для этого пользователя
        total_deliveries = db.query(UserPurchase).filter(UserPurchase.courier_id == user.id).count()
        
        result.append({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "deliveries_count": total_deliveries,
        })
    
    return result


@router.patch("/shop/purchases/{purchase_id}/assign-courier")
def assign_courier(
    purchase_id: int,
    data: AssignCourierRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    """Назначить курьера на доставку покупки."""
    purchase = db.query(UserPurchase).filter(UserPurchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Покупка не найдена")
    
    # Проверяем, что пользователь существует и является курьером
    courier = db.query(User).filter(User.id == data.courier_id, User.role == "courier").first()
    if not courier:
        raise HTTPException(status_code=404, detail="Курьер не найден или пользователь не является курьером")
    
    purchase.courier_id = data.courier_id
    db.commit()
    db.refresh(purchase)
    
    return {
        "ok": True,
        "message": "Курьер назначен",
        "purchase_id": purchase.id,
        "courier_id": purchase.courier_id,
        "courier_name": courier.full_name,
    }


@router.get("/shop/purchases/courier/{courier_id}")
def get_courier_deliveries(
    courier_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    delivery_status: str | None = Query(None, description="Filter by delivery status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Список доставок конкретного курьера."""
    courier = db.query(User).filter(User.id == courier_id, User.role == "courier").first()
    if not courier:
        raise HTTPException(status_code=404, detail="Курьер не найден или пользователь не является курьером")
    
    q = db.query(UserPurchase).filter(UserPurchase.courier_id == courier_id)
    
    if delivery_status:
        q = q.filter(UserPurchase.delivery_status == delivery_status)
    
    purchases = q.order_by(UserPurchase.purchased_at.desc()).offset(skip).limit(limit).all()
    
    # Get related data
    user_ids = {p.user_id for p in purchases}
    item_ids = {p.shop_item_id for p in purchases}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    items = {i.id: i for i in db.query(ShopItem).filter(ShopItem.id.in_(item_ids)).all()}
    
    result = []
    for p in purchases:
        user = users.get(p.user_id)
        item = items.get(p.shop_item_id)
        if user and item:
            result.append({
                "id": p.id,
                "user_id": p.user_id,
                "user_name": user.full_name,
                "user_email": user.email,
                "shop_item_id": p.shop_item_id,
                "item_title": item.title,
                "item_price_coins": item.price_coins,
                "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
                "delivery_status": p.delivery_status,
                "estimated_delivery_date": p.estimated_delivery_date.isoformat() if p.estimated_delivery_date else None,
                "delivered_at": p.delivered_at.isoformat() if p.delivered_at else None,
            })
    
    return {
        "courier": {
            "id": courier.id,
            "full_name": courier.full_name,
            "email": courier.email,
        },
        "deliveries": result,
    }
