"""
One-off script: soft-delete community posts by specific users (by full_name).
Run from backend dir: python remove_community_posts_by_names.py
Requires: DATABASE_URL in .env.
"""
import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.community_post import CommunityPost
from app.models.user import User


# Имена пользователей (full_name), чьи посты soft-delete в сообществе.
# Не добавляйте сюда «Жандос Сахиев», если не хотите удалять посты автора проекта.
TARGET_NAMES = [
    "Гүлнар Серік",
    "Гулнар Серик",
    "Гулнар Серік",
    "Жандос Қанат",
    "Жандос Канат",
    "Бекзат Мұрат",
    "Бекзат Мурат",
]


def normalize(s: str) -> str:
    s = (s or "").strip()
    # NFD and strip combining chars for loose match (e.g. ұ vs у)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s


def main() -> None:
    db = SessionLocal()
    try:
        target_set = {normalize(n) for n in TARGET_NAMES}
        users = db.query(User).all()
        user_ids_to_remove = [
            u.id for u in users
            if normalize(u.full_name) in target_set or u.full_name.strip() in [n.strip() for n in TARGET_NAMES]
        ]
        if not user_ids_to_remove:
            print("No users found with names:", TARGET_NAMES)
            return

        posts = (
            db.query(CommunityPost)
            .filter(
                CommunityPost.user_id.in_(user_ids_to_remove),
                CommunityPost.is_deleted == False,  # noqa: E712
            )
            .all()
        )
        for p in posts:
            p.is_deleted = True
        db.commit()
        print(f"Soft-deleted {len(posts)} community post(s) for user IDs: {user_ids_to_remove}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
