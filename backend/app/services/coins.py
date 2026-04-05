"""Сервис начисления и списания coins (User.points)."""
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.models.user import User
from app.models.coin_transaction_log import CoinTransactionLog
from app.models.notification import Notification


def add_coins(
    db: Session,
    user_id: int,
    amount: int,
    reason: str,
    *,
    apply_premium_multiplier: bool = True,
) -> bool:
    """Увеличивает User.points на amount, логирует в coin_transaction_log, создаёт уведомление.
    Для Premium при apply_premium_multiplier=True удваивает зачисляемую сумму."""
    if amount <= 0:
        return False
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False

    is_premium = getattr(user, "is_premium", 0) == 1
    actual_amount = amount
    if apply_premium_multiplier and is_premium:
        actual_amount = amount * 2  # 2x бонус (Double Coins)
    
    user.points = (user.points or 0) + actual_amount
    log = CoinTransactionLog(user_id=user_id, amount=actual_amount, reason=reason)
    db.add(log)
    
    # В уведомлении показываем фактическую сумму (с бонусом если есть)
    bonus_text = (
        f" (+{actual_amount - amount} Premium бонус)"
        if apply_premium_multiplier and is_premium and actual_amount > amount
        else ""
    )
    notif = Notification(
        user_id=user_id,
        type="coins_earned",
        title="Қойындар қосылды!",
        message=f"+{actual_amount} coins{bonus_text}",
        link="/app/profile",
    )
    db.add(notif)
    # Flush + refresh чтобы ORM-объекты (включая current_user) видели актуальный баланс
    db.flush()
    db.refresh(user)
    return True


def spend_coins(db: Session, user_id: int, amount: int, reason: str) -> bool:
    """Атомарное списание amount с User.points.
    Использует UPDATE ... WHERE points >= amount для предотвращения race condition.
    Возвращает False если недостаточно баланса."""
    if amount <= 0:
        return False
    # Атомарная операция: UPDATE ... WHERE points >= amount
    result = db.execute(
        update(User)
        .where(User.id == user_id, User.points >= amount)
        .values(points=User.points - amount)
    )
    if result.rowcount == 0:
        return False
    log = CoinTransactionLog(user_id=user_id, amount=-amount, reason=reason)
    db.add(log)
    # CRITICAL FIX: flush pending changes and refresh the User ORM object
    # so all subsequent reads of user.points within the same request
    # reflect the actual DB value after the atomic UPDATE.
    db.flush()
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        db.refresh(user)
    return True


def get_user_balance(db: Session, user_id: int) -> int:
    """Получить актуальный баланс пользователя прямо из БД."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return 0
    db.refresh(user)
    return user.points or 0


def has_received_coins_for_reason(db: Session, user_id: int, reason: str) -> bool:
    """Проверяет, получал ли пользователь уже coins по данной причине (например test_123)."""
    return db.query(CoinTransactionLog).filter(
        CoinTransactionLog.user_id == user_id,
        CoinTransactionLog.reason == reason,
        CoinTransactionLog.amount > 0,
    ).first() is not None
