#!/usr/bin/env python3
"""Update image_url for shop items - matching product to correct image. Run: python3 update_shop_images.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.shop_item import ShopItem

# Product-specific images from Unsplash & Pexels (product -> image)
# Pexels: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&cs=tinysrgb&w=400
# Unsplash: https://images.unsplash.com/photo-{id}?w=400&q=80

IMAGE_MAP = [
    # Books - programming/code books
    ("Программирование", "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80"),
    ("Web дамыту", "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80"),
    ("JavaScript", "https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&q=80"),
    ("SQL ", "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"),
    ("Git ", "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80"),
    ("AI және ML", "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&q=80"),
    ("Киберқауіпсіздік", "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&q=80"),
    ("Мобильді қосымшалар", "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80"),
    # Souvenirs
    ("Q Academy сувенир", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"),
    ("Стикерлер", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"),
    ("сувенир кепка", "https://images.pexels.com/photos/844867/pexels-photo-844867.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("IT магнитик", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"),
    ("Брелок", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"),
    ("IT значок", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"),
    ("кружка", "https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("IT плакат", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80"),
    ("жеңіл кепка", "https://images.pexels.com/photos/844867/pexels-photo-844867.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("сертификаты", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"),
    # Caps
    ("Q Academy кепка", "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80"),
    ("Бейсболка", "https://images.pexels.com/photos/844867/pexels-photo-844867.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("IT кепка", "https://images.pexels.com/photos/260998/pexels-photo-260998.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қызмет көрсету кепка", "https://images.pexels.com/photos/1484807/pexels-photo-1484807.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Жазғы кепка", "https://images.pexels.com/photos/1484802/pexels-photo-1484802.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Snapback", "https://images.pexels.com/photos/1374370/pexels-photo-1374370.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Notebooks
    ("Үлестірме дәптер", "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"),
    ("Код жазу дәптері", "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("A4 дәптер", "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"),
    ("Стикерлі дәптер", "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Молескин", "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"),
    ("Қысқа дәптер", "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("IT дәптер", "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Схема дәптері", "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Paper
    ("A4 қағаз", "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"),
    ("Қағаз стикерлер", "https://images.pexels.com/photos/6193084/pexels-photo-6193084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Картон", "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"),
    ("Қағаз папка", "https://images.pexels.com/photos/6193084/pexels-photo-6193084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қағаз клип", "https://images.pexels.com/photos/6193084/pexels-photo-6193084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қағаз қап", "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"),
    # Headphones
    ("Құлаққап", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"),
    ("Қызмет көрсету құлаққаптары", "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80"),
    ("Bluetooth құлаққап", "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Құлаққап TWS", "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Құлаққап ойын", "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Құлаққап студент", "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80"),
    ("Құлаққап микрофон", "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Құлаққап офис", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"),
    # Keyboards - specific first
    ("Пернетақта ойын", "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Пернетақта мембрана", "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Пернетақта компакт", "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Пернетақта RGB", "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Пернетақта wireless", "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Пернетақта", "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400&q=80"),
    # Laptops
    ("Ноутбук", "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80"),
    ("MacBook", "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80"),
    ("игровой", "https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("тұғыры", "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"),
    ("салқындату", "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"),
    # Monitors
    ("Монитор 24", "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"),
    ("қорғағышы", "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80"),
    ("Монитор 27", "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"),
    ("Монитор тұғыры", "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"),
    ("Қосымша экран", "https://images.pexels.com/photos/1181676/pexels-photo-1181676.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Монитор кабель", "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80"),
    # Mouse
    ("Компьютерлі тышқан", "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80"),
    ("Тышқан ойын", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Тышқан wireless", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Тышқан коврик", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Тышқан вертикаль", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Тышқан трекбол", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Тышқан бюджет", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Тышқан офис", "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Webcam
    ("Веб-камера", "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80"),
    # Bags
    ("Ноутбук сөмкесі", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80"),
    ("Рюкзак IT", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қызмет көрсету портфель", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Сөмке кросовка", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қағаз сөмке", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Ноутбук қап", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Құлаққап сөмке", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("USB рюкзак", "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Other - pens, markers, pencils
    ("Қалам жинағы", "https://images.pexels.com/photos/369449/pexels-photo-369449.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қалам гель", "https://images.pexels.com/photos/261679/pexels-photo-261679.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қалам маркер", "https://images.pexels.com/photos/369449/pexels-photo-369449.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қалам қалам", "https://images.pexels.com/photos/261679/pexels-photo-261679.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Glasses
    ("Көзәйнек", "https://images.pexels.com/photos/3184611/pexels-photo-3184611.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Көзәйнек оқыту", "https://images.pexels.com/photos/3760132/pexels-photo-3760132.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Көзәйнек күн", "https://images.pexels.com/photos/833410/pexels-photo-833410.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Calculator, scissors
    ("Калькулятор", "https://images.pexels.com/photos/5915236/pexels-photo-5915236.jpeg?auto=compress&cs=tinysrgb&w=400"),
    ("Қайшы", "https://images.pexels.com/photos/159644/art-supplies-brushes-rulers-scissors-159644.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # Colored pencils
    ("Қаламша", "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"),
    # USB
    ("USB флешка", "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"),
    ("USB-C кабель", "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"),
    ("USB hub", "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"),
    # Power bank
    ("Power bank", "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80"),
    # Laptop stand
    ("Ноутбук тұғыры", "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"),
]


def main():
    db = SessionLocal()
    try:
        items = db.query(ShopItem).all()
        updated = 0
        for item in items:
            url = None
            for key, image_url in IMAGE_MAP:
                if key in item.title:
                    url = image_url
                    break
            if url and item.image_url != url:
                item.image_url = url
                updated += 1
        db.commit()
        print(f"Updated {updated} shop items with correct product images.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
