#!/usr/bin/env python3
"""Update shop items: prices, images, and add new products. Run: python update_shop_items.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.shop_item import ShopItem

# Same ITEMS as seed_shop.py - used for update
ITEMS = [
    {"title": "Программирование кітабы", "description": "Python негіздері", "price_coins": 2500, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80"},
    {"title": "Web дамыту кітабы", "description": "HTML, CSS, JavaScript", "price_coins": 3000, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80"},
    {"title": "Q Academy сувенир", "description": "Брендтік брелок", "price_coins": 450, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"},
    {"title": "Стикерлер жинағы", "description": "Программист стикерлері", "price_coins": 400, "category": "souvenir", "icon_name": "Sparkles", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"},
    {"title": "Q Academy кепка", "description": "Брендтік кепка", "price_coins": 1200, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80"},
    {"title": "Үлестірме дәптер", "description": "A5 дәптер 96 бет", "price_coins": 350, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"},
    {"title": "A4 қағаз пачка", "description": "500 пара", "price_coins": 280, "category": "a4", "icon_name": "File", "image_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"},
    {"title": "Құлаққап", "description": "Қонақүй сапасындағы наушник", "price_coins": 5200, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"},
    {"title": "Қызмет көрсету құлаққаптары", "description": "Онлайн сабақтарға арналған микрофонды құлаққап", "price_coins": 2200, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80"},
    {"title": "Пернетақта", "description": "Механикалық пернетақта", "price_coins": 8500, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400&q=80"},
    {"title": "Ноутбук", "description": "IT студенттерге арналған", "price_coins": 65000, "category": "laptop", "icon_name": "Laptop", "image_url": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80"},
    {"title": "Монитор 24\"", "description": "Full HD дисплей, екінші экран үшін", "price_coins": 42000, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"},
    {"title": "Қосымша экран қорғағышы", "description": "Ноутбук экранын қорғау", "price_coins": 1500, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80"},
    {"title": "Компьютерлі тышқан", "description": "Ойын және жұмыс үшін", "price_coins": 3200, "category": "mouse", "icon_name": "Mouse", "image_url": "/uploads/shop/mouse.png"},
    {"title": "Веб-камера HD", "description": "Онлайн сабақтарға арналған", "price_coins": 6500, "category": "webcam", "icon_name": "Video", "image_url": "/uploads/shop/webcam.png"},
    {"title": "Ноутбук сөмкесі", "description": "Қорғанышты рюкзак", "price_coins": 4800, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80"},
    {"title": "USB флешка 32GB", "description": "Деректерді сақтау үшін", "price_coins": 1800, "category": "other", "icon_name": "HardDrive", "image_url": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"},
    {"title": "Қалам жинағы", "description": "5 түсті маркер", "price_coins": 250, "category": "other", "icon_name": "Pen", "image_url": "/uploads/shop/pen-set.jpeg"},
    {"title": "Ноутбук тұғыры", "description": "Эргономикалық тұғыр", "price_coins": 2800, "category": "other", "icon_name": "Layout", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"},
    {"title": "Power bank 20000mAh", "description": "Ұялы зарядтағыш", "price_coins": 3500, "category": "other", "icon_name": "Battery", "image_url": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80"},
]


def main():
    db = SessionLocal()
    try:
        existing_titles = {i.title: i for i in db.query(ShopItem).all()}
        updated = 0
        added = 0

        for d in ITEMS:
            title = d["title"]
            if title in existing_titles:
                item = existing_titles[title]
                item.price_coins = d["price_coins"]
                item.description = d["description"]
                item.category = d["category"]
                item.icon_name = d["icon_name"]
                item.image_url = d["image_url"]
                updated += 1
            else:
                db.add(ShopItem(**d))
                added += 1

        db.commit()
        print(f"Updated {updated} shop items, added {added} new items.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
