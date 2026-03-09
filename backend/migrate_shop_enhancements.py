#!/usr/bin/env python3
"""
Миграция: добавление таблиц user_favorites, cart_items и полей delivery_status, 
estimated_delivery_date, delivered_at в user_purchases.
Запустить: cd backend && python migrate_shop_enhancements.py
"""
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import random

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text, create_engine
from app.core.config import settings
from app.models.user_favorite import UserFavorite
from app.models.cart_item import CartItem
from app.core.database import Base


def run():
    engine = create_engine(settings.DATABASE_URL)
    is_sqlite = "sqlite" in settings.DATABASE_URL

    with engine.connect() as conn:
        # Create user_favorites table
        if is_sqlite:
            r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_favorites'"))
        else:
            r = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'user_favorites'
            """))
        
        if not r.fetchone():
            UserFavorite.__table__.create(engine, checkfirst=True)
            print("Created user_favorites table")
        else:
            print("user_favorites table already exists")

        # Create cart_items table
        if is_sqlite:
            r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='cart_items'"))
        else:
            r = conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'cart_items'
            """))
        
        if not r.fetchone():
            CartItem.__table__.create(engine, checkfirst=True)
            print("Created cart_items table")
        else:
            print("cart_items table already exists")

        # Add delivery fields to user_purchases
        if is_sqlite:
            r = conn.execute(text("PRAGMA table_info(user_purchases)"))
            cols = {row[1] for row in r.fetchall()}
        else:
            r = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'user_purchases' AND table_schema = 'public'
            """))
            cols = {row[0] for row in r.fetchall()}

        if "delivery_status" not in cols:
            conn.execute(text("ALTER TABLE user_purchases ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'pending' NOT NULL"))
            conn.commit()
            print("Added user_purchases.delivery_status")
        else:
            print("user_purchases.delivery_status already exists")

        if "estimated_delivery_date" not in cols:
            conn.execute(text("ALTER TABLE user_purchases ADD COLUMN estimated_delivery_date DATETIME"))
            conn.commit()
            print("Added user_purchases.estimated_delivery_date")
        else:
            print("user_purchases.estimated_delivery_date already exists")

        if "delivered_at" not in cols:
            conn.execute(text("ALTER TABLE user_purchases ADD COLUMN delivered_at DATETIME"))
            conn.commit()
            print("Added user_purchases.delivered_at")
        else:
            print("user_purchases.delivered_at already exists")

        # Set estimated_delivery_date for existing purchases without it
        if is_sqlite:
            conn.execute(text("""
                UPDATE user_purchases 
                SET estimated_delivery_date = datetime(purchased_at, '+' || (6 + abs(random() % 2)) || ' days')
                WHERE estimated_delivery_date IS NULL
            """))
        else:
            conn.execute(text("""
                UPDATE user_purchases 
                SET estimated_delivery_date = purchased_at + INTERVAL '6 days' + (RANDOM() * INTERVAL '1 day')
                WHERE estimated_delivery_date IS NULL
            """))
        conn.commit()
        print("Set estimated_delivery_date for existing purchases")

    print("Migration completed successfully!")


if __name__ == "__main__":
    run()
