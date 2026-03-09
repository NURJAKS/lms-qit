"""Сервис начисления и списания coins (User.points)."""
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.coin_transaction_log import CoinTransactionLog
from app.models.notification import Notification


def add_coins(db: Session, user_id: int, amount: int, reason: str) -> bool:
    """Увеличивает User.points на amount, логирует в coin_transaction_log, создаёт уведомление.
    Для Premium пользователей добавляет бонус +50%."""
    if amount <= 0:
        return False
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    # Premium бонус: +50% для Premium пользователей
    is_premium = getattr(user, "is_premium", 0) == 1
    actual_amount = amount
    if is_premium:
        actual_amount = int(amount * 1.5)  # +50% бонус
    
    user.points = (user.points or 0) + actual_amount
    log = CoinTransactionLog(user_id=user_id, amount=actual_amount, reason=reason)
    db.add(log)
    
    # В уведомлении показываем фактическую сумму (с бонусом если есть)
    bonus_text = f" (+{actual_amount - amount} Premium бонус)" if is_premium and actual_amount > amount else ""
    notif = Notification(
        user_id=user_id,
        type="coins_earned",
        title="Қойындар қосылды!",
        message=f"+{actual_amount} coins{bonus_text}",
        link="/app/profile",
    )
    db.add(notif)
    return True


def spend_coins(db: Session, user_id: int, amount: int, reason: str) -> bool:
    """Списывает amount с User.points. Возвращает False если недостаточно баланса."""
    if amount <= 0:
        return False
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    balance = user.points or 0
    if balance < amount:
        return False
    user.points = balance - amount
    log = CoinTransactionLog(user_id=user_id, amount=-amount, reason=reason)
    db.add(log)
    return True


def has_received_coins_for_reason(db: Session, user_id: int, reason: str) -> bool:
    """Проверяет, получал ли пользователь уже coins по данной причине (например test_123)."""
    return db.query(CoinTransactionLog).filter(
        CoinTransactionLog.user_id == user_id,
        CoinTransactionLog.reason == reason,
        CoinTransactionLog.amount > 0,
    ).first() is not None
