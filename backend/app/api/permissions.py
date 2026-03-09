"""
Права доступа по ролям LMS.

admin     — полный доступ ко всему
director  — полный доступ (руководитель организации)
curator   — контент и модерация: просмотр, редактирование курсов/тестов, модерация. НЕ может: управлять пользователями, удалять курсы
teacher   — только преподавательская панель (группы, задания)
student   — студент
parent    — родительская панель
"""


def is_admin(user) -> bool:
    """Администратор — полный доступ."""
    return user.role == "admin"


def is_director(user) -> bool:
    """Директор — полный доступ."""
    return user.role == "director"


def is_admin_or_director(user) -> bool:
    """Админ или директор — управление пользователями, удаление курсов."""
    return user.role in ("admin", "director")


def is_curator_or_above(user) -> bool:
    """Куратор и выше — просмотр админки, редактирование контента, модерация."""
    return user.role in ("admin", "director", "curator")


def can_manage_users(user) -> bool:
    """Создание, редактирование, удаление пользователей."""
    return is_admin_or_director(user)


def can_delete_course(user) -> bool:
    """Удаление курсов."""
    return is_admin_or_director(user)


def can_manage_categories(user) -> bool:
    """Создание, редактирование, удаление категорий."""
    return is_admin_or_director(user)


def can_export_users(user) -> bool:
    """Экспорт пользователей в CSV."""
    return is_admin_or_director(user)


def can_view_admin(user) -> bool:
    """Доступ к админ-панели (просмотр)."""
    return is_curator_or_above(user)


def can_edit_content(user) -> bool:
    """Редактирование курсов, модулей, тем, тестов (без удаления курсов)."""
    return is_curator_or_above(user)


def can_moderate(user) -> bool:
    """Модерация контента."""
    return is_curator_or_above(user)
