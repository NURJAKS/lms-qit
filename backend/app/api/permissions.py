"""
LMS-тегі рөлдер бойынша қолжетімділік құқықтары.

admin     — барлығына толық қолжетімділік
director  — толық қолжетімділік (ұйым басшысы)
curator   — контент және модерация: курстарды/тесттерді көру, өңдеу, модерация. 
            Пайдаланушыларды басқара АЛМАЙДЫ, курстарды жоя АЛМАЙДЫ
teacher   — тек оқытушы панелі (топтар, тапсырмалар)
student   — студент
parent    — ата-ана панелі
"""


def is_admin(user) -> bool:
    """Әкімші — толық қолжетімділік."""
    return user.role == "admin"


def is_director(user) -> bool:
    """Директор — толық қолжетімділік."""
    return user.role == "director"


def is_admin_or_director(user) -> bool:
    """Әкімші немесе директор — пайдаланушыларды басқару, курстарды жою."""
    return user.role in ("admin", "director")


def is_curator_or_above(user) -> bool:
    """Куратор және одан жоғары — админканы көру, контентті өңдеу, модерация."""
    return user.role in ("admin", "director", "curator")


def can_manage_users(user) -> bool:
    """Пайдаланушыларды құру, өңдеу, жою."""
    return is_admin_or_director(user)


def can_delete_course(user) -> bool:
    """Курстарды жою."""
    return is_admin_or_director(user)


def can_manage_categories(user) -> bool:
    """Санаттарды құру, өңдеу, жою."""
    return is_admin_or_director(user)


def can_export_users(user) -> bool:
    """Пайдаланушыларды Excel форматында экспорттау."""
    return is_admin_or_director(user)


def can_view_admin(user) -> bool:
    """Админ-панельге қолжетімділік (көру)."""
    return is_curator_or_above(user)


def can_edit_content(user) -> bool:
    """Курстарды, модульдерді, тақырыптарды, тесттерді өңдеу (курстарды жоюдан басқа)."""
    return is_curator_or_above(user)


def can_moderate(user) -> bool:
    """Контентті модерациялау."""
    return is_curator_or_above(user)