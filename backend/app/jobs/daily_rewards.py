"""Ежедневные награды топ-5 рейтинга: 1→1000, 2→700, 3→500, 4→250, 5→100 coins."""
from datetime import date

from app.core.database import SessionLocal
from app.api.routes.analytics import _leaderboard_data
from app.models.daily_leaderboard_reward import DailyLeaderboardReward
from app.services.coins import add_coins

REWARDS = {1: 1000, 2: 700, 3: 500, 4: 250, 5: 100}


def run_daily_leaderboard_rewards() -> int:
    """Распределяет coins топ-5. Возвращает количество начисленных."""
    db = SessionLocal()
    try:
        today = date.today()
        existing = db.query(DailyLeaderboardReward).filter(DailyLeaderboardReward.date == today).first()
        if existing:
            return 0
        data = _leaderboard_data(db, course_id=None, limit=5)
        awarded = 0
        for r in data:
            rank = r["rank"]
            if rank in REWARDS:
                amount = REWARDS[rank]
                add_coins(db, r["user_id"], amount, f"daily_rank_{rank}")
                reward = DailyLeaderboardReward(date=today, user_id=r["user_id"], rank=rank, amount=amount)
                db.add(reward)
                awarded += 1
        db.commit()
        return awarded
    finally:
        db.close()
