#!/usr/bin/env python3
"""Миграция: coin_transaction_log, daily_leaderboard_rewards, shop_items, user_purchases, coins_awarded. Запустить: python3 migrate_coins.py"""
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "education.db"
if not db_path.exists():
    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./education.db")
    if "sqlite" in db_url:
        db_path = Path(db_url.replace("sqlite:///", "")).resolve()
    if not db_path.exists():
        print("DB not found.")
        exit(0)

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

# coin_transaction_log
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='coin_transaction_log'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE coin_transaction_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount INTEGER NOT NULL,
            reason VARCHAR(100) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created coin_transaction_log")

# daily_leaderboard_rewards
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_leaderboard_rewards'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE daily_leaderboard_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rank INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("CREATE INDEX ix_daily_leaderboard_rewards_date ON daily_leaderboard_rewards(date)")
    print("Created daily_leaderboard_rewards")

# shop_items
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shop_items'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            price_coins INTEGER NOT NULL,
            category VARCHAR(50) NOT NULL,
            icon_name VARCHAR(50),
            image_url VARCHAR(500),
            is_active INTEGER DEFAULT 1
        )
    """)
    print("Created shop_items")

# user_purchases
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_purchases'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE user_purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            shop_item_id INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Created user_purchases")

# assignment_submissions.coins_awarded
cur.execute("PRAGMA table_info(assignment_submissions)")
cols = [r[1] for r in cur.fetchall()]
if "coins_awarded" not in cols:
    cur.execute("ALTER TABLE assignment_submissions ADD COLUMN coins_awarded INTEGER DEFAULT 0")
    print("Added assignment_submissions.coins_awarded")

# ai_challenges.coins_awarded
cur.execute("PRAGMA table_info(ai_challenges)")
cols = [r[1] for r in cur.fetchall()]
if "coins_awarded" not in cols:
    cur.execute("ALTER TABLE ai_challenges ADD COLUMN coins_awarded INTEGER DEFAULT 0")
    print("Added ai_challenges.coins_awarded")

conn.commit()
conn.close()
print("Migration done.")
