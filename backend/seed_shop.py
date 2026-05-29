#!/usr/bin/env python3
"""Seed shop items for Q Market."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.shop_item import ShopItem


# Unsplash: https://images.unsplash.com/photo-{id}?w=400&q=80
# Pexels: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&cs=tinysrgb&w=400
ITEMS = [
    # Books (8)
    {"title": "Программирование кітабы", "description": "Python негіздері", "price_coins": 2500, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80"},
    {"title": "Web дамыту кітабы", "description": "HTML, CSS, JavaScript", "price_coins": 3000, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80"},
    {"title": "JavaScript кітабы", "description": "Современный JS и React", "price_coins": 2800, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&q=80"},
    {"title": "SQL және деректер қоры", "description": "Базалардың негіздері", "price_coins": 2200, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80"},
    {"title": "Git және GitHub", "description": "Версиялық басқару", "price_coins": 1800, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80"},
    {"title": "AI және ML кітабы", "description": "Жасанды интеллект негіздері", "price_coins": 3500, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&q=80"},
    {"title": "Киберқауіпсіздік", "description": "Қауіпсіздік негіздері", "price_coins": 3200, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&q=80"},
    {"title": "Мобильді қосымшалар", "description": "React Native, Flutter", "price_coins": 2900, "category": "book", "icon_name": "BookOpen", "image_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80"},
    # Souvenirs (10)
    {"title": "Q Academy сувенир", "description": "Брендтік брелок", "price_coins": 450, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"},
    {"title": "Стикерлер жинағы", "description": "Программист стикерлері", "price_coins": 400, "category": "souvenir", "icon_name": "Sparkles", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"},
    {"title": "Q Academy сувенир кепка", "description": "Брендтік кепка сувенир", "price_coins": 1100, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.pexels.com/photos/844867/pexels-photo-844867.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "IT магнитик", "description": "Үлестірме магнит", "price_coins": 200, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"},
    {"title": "Брелок код", "description": "{} символы брелок", "price_coins": 350, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80"},
    {"title": "IT значок", "description": "Брендтік badge", "price_coins": 300, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"},
    {"title": "Q Academy кружка", "description": "Логотипті кесе", "price_coins": 800, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "IT плакат", "description": "Мотивациялық плакат", "price_coins": 600, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80"},
    {"title": "Қысқа жеңіл кепка", "description": "Брендтік snapback", "price_coins": 1100, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.pexels.com/photos/844867/pexels-photo-844867.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қызмет көрсету сертификаты", "description": "Қағаз сертификат", "price_coins": 150, "category": "souvenir", "icon_name": "Gift", "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80"},
    # Cap (6)
    {"title": "Q Academy кепка", "description": "Брендтік кепка", "price_coins": 1200, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80"},
    {"title": "Бейсболка", "description": "Қара құлаққап", "price_coins": 900, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.pexels.com/photos/844867/pexels-photo-844867.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "IT кепка", "description": "Белгілі кепка", "price_coins": 1000, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80"},
    {"title": "Қызмет көрсету кепка", "description": "Онлайн сабақтарға арналған", "price_coins": 950, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.pexels.com/photos/1484807/pexels-photo-1484807.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Жазғы кепка", "description": "Белгілі кепка", "price_coins": 750, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80"},
    {"title": "Snapback кепка", "description": "Стильді кепка", "price_coins": 1300, "category": "cap", "icon_name": "Shirt", "image_url": "https://images.pexels.com/photos/1374370/pexels-photo-1374370.jpeg?auto=compress&cs=tinysrgb&w=400"},
    # Notebook (8)
    {"title": "Үлестірме дәптер", "description": "A5 дәптер 96 бет", "price_coins": 350, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"},
    {"title": "Код жазу дәптері", "description": "Қағазды код блоктары", "price_coins": 450, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "A4 дәптер", "description": "96 бет, қақпақ", "price_coins": 400, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"},
    {"title": "Стикерлі дәптер", "description": "Post-it құрамында", "price_coins": 500, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Молескин дәптер", "description": "Классикалық дәптер", "price_coins": 1200, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"},
    {"title": "Қысқа дәптер", "description": "A6 дәптер 48 бет", "price_coins": 250, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "IT дәптер", "description": "Брендтік дәптер", "price_coins": 550, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80"},
    {"title": "Схема дәптері", "description": "Қағазды блоктар", "price_coins": 380, "category": "notebook", "icon_name": "FileText", "image_url": "https://images.pexels.com/photos/207756/pexels-photo-207756.jpeg?auto=compress&cs=tinysrgb&w=400"},
    # A4 / Paper (6)
    {"title": "A4 қағаз пачка", "description": "500 пара", "price_coins": 280, "category": "a4", "icon_name": "File", "image_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"},
    {"title": "Қағаз стикерлер", "description": "Post-it 100 пара", "price_coins": 350, "category": "a4", "icon_name": "File", "image_url": "https://images.pexels.com/photos/6193084/pexels-photo-6193084.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Картон қағаз", "description": "Түрлі түстер", "price_coins": 320, "category": "a4", "icon_name": "File", "image_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"},
    {"title": "Қағаз папка", "description": "10 файл", "price_coins": 400, "category": "a4", "icon_name": "File", "image_url": "https://images.pexels.com/photos/6193084/pexels-photo-6193084.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қағаз клип", "description": "Металл клиптер", "price_coins": 150, "category": "a4", "icon_name": "File", "image_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"},
    {"title": "Қағаз қап", "description": "Қорғанышты қап", "price_coins": 200, "category": "a4", "icon_name": "File", "image_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80"},
    # Headphones (8)
    {"title": "Құлаққап", "description": "Қонақүй сапасындағы наушник", "price_coins": 5200, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"},
    {"title": "Қызмет көрсету құлаққаптары", "description": "Онлайн сабақтарға арналған микрофонды құлаққап", "price_coins": 2200, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80"},
    {"title": "Bluetooth құлаққап", "description": "Қауіпсіз құлаққап", "price_coins": 4500, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Құлаққап TWS", "description": "Қауіпсіз құлаққап", "price_coins": 3800, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"},
    {"title": "Құлаққап ойын", "description": "7.1 surround", "price_coins": 6000, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Құлаққап студент", "description": "Қолайлы баға", "price_coins": 1500, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80"},
    {"title": "Құлаққап микрофон", "description": "Қызмет көрсету құлаққап", "price_coins": 2800, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.pexels.com/photos/18254084/pexels-photo-18254084.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Құлаққап офис", "description": "Қонақүй сапасындағы", "price_coins": 3500, "category": "headphones", "icon_name": "Headphones", "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80"},
    # Keyboard (6)
    {"title": "Пернетақта", "description": "Механикалық пернетақта", "price_coins": 8500, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400&q=80"},
    {"title": "Пернетақта мембрана", "description": "Қолайлы баға", "price_coins": 2500, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Пернетақта компакт", "description": "60% пернетақта", "price_coins": 5500, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400&q=80"},
    {"title": "Пернетақта RGB", "description": "RGB жарық пернетақта", "price_coins": 7200, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Пернетақта wireless", "description": "Қауіпсіз пернетақта", "price_coins": 4800, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400&q=80"},
    {"title": "Пернетақта ойын", "description": "Механикалық ойын", "price_coins": 9500, "category": "keyboard", "icon_name": "Keyboard", "image_url": "https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=400"},
    # Laptop (5)
    {"title": "Ноутбук", "description": "IT студенттерге арналған", "price_coins": 65000, "category": "laptop", "icon_name": "Laptop", "image_url": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80"},
    {"title": "Ноутбук MacBook", "description": "Apple MacBook Air", "price_coins": 120000, "category": "laptop", "icon_name": "Laptop", "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80"},
    {"title": "Ноутбук игровой", "description": "Ойын және дамыту", "price_coins": 85000, "category": "laptop", "icon_name": "Laptop", "image_url": "https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Ноутбук тұғыры", "description": "Эргономикалық тұғыр", "price_coins": 2800, "category": "laptop", "icon_name": "Laptop", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"},
    {"title": "Ноутбук салқындату", "description": "Салқындату тұғыры", "price_coins": 1500, "category": "laptop", "icon_name": "Laptop", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"},
    # Monitor (6)
    {"title": "Монитор 24\"", "description": "Full HD дисплей, екінші экран үшін", "price_coins": 42000, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"},
    {"title": "Қосымша экран қорғағышы", "description": "Ноутбук экранын қорғау", "price_coins": 1500, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80"},
    {"title": "Монитор 27\"", "description": "2K дисплей", "price_coins": 55000, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"},
    {"title": "Монитор тұғыры", "description": "Эргономикалық тұғыр", "price_coins": 3500, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80"},
    {"title": "Қосымша экран", "description": "15.6\" портативті", "price_coins": 25000, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.pexels.com/photos/1181676/pexels-photo-1181676.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Монитор кабель", "description": "HDMI кабель 2м", "price_coins": 800, "category": "monitor", "icon_name": "Monitor", "image_url": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80"},
    # Mouse (8)
    {"title": "Компьютерлі тышқан", "description": "Ойын және жұмыс үшін", "price_coins": 3200, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80"},
    {"title": "Тышқан ойын", "description": "RGB қызмет көрсету", "price_coins": 4500, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Тышқан wireless", "description": "Қауіпсіз тышқан", "price_coins": 2800, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80"},
    {"title": "Тышқан коврик", "description": "Үлкен коврик", "price_coins": 600, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Тышқан вертикаль", "description": "Эргономикалық", "price_coins": 4000, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80"},
    {"title": "Тышқан трекбол", "description": "Трекбол тышқан", "price_coins": 5500, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Тышқан бюджет", "description": "Қолайлы баға", "price_coins": 1200, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80"},
    {"title": "Тышқан офис", "description": "Офис тышқаны", "price_coins": 1800, "category": "mouse", "icon_name": "Mouse", "image_url": "https://images.pexels.com/photos/392018/pexels-photo-392018.jpeg?auto=compress&cs=tinysrgb&w=400"},
    # Webcam (5)
    {"title": "Веб-камера HD", "description": "Онлайн сабақтарға арналған", "price_coins": 6500, "category": "webcam", "icon_name": "Video", "image_url": "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80"},
    {"title": "Веб-камера 4K", "description": "Жоғары сапа", "price_coins": 12000, "category": "webcam", "icon_name": "Video", "image_url": "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80"},
    {"title": "Веб-камера бюджет", "description": "720p", "price_coins": 2500, "category": "webcam", "icon_name": "Video", "image_url": "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80"},
    {"title": "Веб-камера жарық", "description": "Ring light құрамында", "price_coins": 8500, "category": "webcam", "icon_name": "Video", "image_url": "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80"},
    {"title": "Веб-камера микрофон", "description": "Құлаққап құрамында", "price_coins": 5000, "category": "webcam", "icon_name": "Video", "image_url": "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80"},
    # Bag (8)
    {"title": "Ноутбук сөмкесі", "description": "Қорғанышты рюкзак", "price_coins": 4800, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80"},
    {"title": "Рюкзак IT", "description": "Ноутбук құрамында", "price_coins": 4200, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қызмет көрсету портфель", "description": "Портфель", "price_coins": 3500, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80"},
    {"title": "Сөмке кросовка", "description": "Белгілі сөмке", "price_coins": 2800, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қағаз сөмке", "description": "Қағаз сөмке", "price_coins": 1500, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80"},
    {"title": "Ноутбук қап", "description": "Қорғанышты қап", "price_coins": 2000, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Құлаққап сөмке", "description": "Құлаққап құрамында", "price_coins": 3200, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80"},
    {"title": "USB рюкзак", "description": "USB порт құрамында", "price_coins": 5500, "category": "bag", "icon_name": "Briefcase", "image_url": "https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400"},
    # Other - pens, glasses, stationery (25+)
    {"title": "USB флешка 32GB", "description": "Деректерді сақтау үшін", "price_coins": 1800, "category": "other", "icon_name": "HardDrive", "image_url": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"},
    {"title": "Қалам жинағы", "description": "5 түсті маркер", "price_coins": 250, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Ноутбук тұғыры", "description": "Эргономикалық тұғыр", "price_coins": 2800, "category": "other", "icon_name": "Layout", "image_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80"},
    {"title": "Power bank 20000mAh", "description": "Ұялы зарядтағыш", "price_coins": 3500, "category": "other", "icon_name": "Battery", "image_url": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80"},
    {"title": "Қалам гель", "description": "Қара гель қалам", "price_coins": 150, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қалам маркер", "description": "Түрлі түстер", "price_coins": 300, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/369449/pexels-photo-369449.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қалам жинағы 12", "description": "12 түсті маркер", "price_coins": 450, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қалам қалам", "description": "Қағаз қалам", "price_coins": 100, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/261679/pexels-photo-261679.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Көзәйнек", "description": "Қорғанышты көзәйнек", "price_coins": 2200, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400&q=80"},
    {"title": "Көзәйнек оқыту", "description": "Көз қорғау", "price_coins": 1800, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/833410/pexels-photo-833410.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Көзәйнек күн", "description": "Күн көзәйнегі", "price_coins": 1200, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400&q=80"},
    {"title": "Калькулятор", "description": "Ғылыми калькулятор", "price_coins": 800, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/5915236/pexels-photo-5915236.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қайшы", "description": "Офис қайшы", "price_coins": 200, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159644/art-supplies-brushes-rulers-scissors-159644.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша", "description": "Қағаз қаламша", "price_coins": 250, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қалам жинағы 24", "description": "24 түсті маркер", "price_coins": 650, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "USB флешка 64GB", "description": "Үлкен көлем", "price_coins": 2500, "category": "other", "icon_name": "HardDrive", "image_url": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"},
    {"title": "USB флешка 128GB", "description": "Максималды көлем", "price_coins": 4000, "category": "other", "icon_name": "HardDrive", "image_url": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"},
    {"title": "USB-C кабель", "description": "Жылдам зарядтау", "price_coins": 600, "category": "other", "icon_name": "HardDrive", "image_url": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"},
    {"title": "USB hub", "description": "4 порт", "price_coins": 1200, "category": "other", "icon_name": "HardDrive", "image_url": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80"},
    {"title": "Қаламша жинағы 12", "description": "12 түсті қаламша", "price_coins": 350, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша түрлі", "description": "Түрлі түстер", "price_coins": 280, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 24", "description": "24 түсті қаламша", "price_coins": 550, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 36", "description": "36 түсті қаламша", "price_coins": 750, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 48", "description": "48 түсті қаламша", "price_coins": 950, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 60", "description": "60 түсті қаламша", "price_coins": 1200, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 72", "description": "72 түсті қаламша", "price_coins": 1500, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 96", "description": "96 түсті қаламша", "price_coins": 2000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 120", "description": "120 түсті қаламша", "price_coins": 2500, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 150", "description": "150 түсті қаламша", "price_coins": 3000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 200", "description": "200 түсті қаламша", "price_coins": 4000, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 250", "description": "250 түсті қаламша", "price_coins": 5000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 300", "description": "300 түсті қаламша", "price_coins": 6000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 400", "description": "400 түсті қаламша", "price_coins": 8000, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 500", "description": "500 түсті қаламша", "price_coins": 10000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 600", "description": "600 түсті қаламша", "price_coins": 12000, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 700", "description": "700 түсті қаламша", "price_coins": 14000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 800", "description": "800 түсті қаламша", "price_coins": 16000, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
    {"title": "Қаламша жинағы 900", "description": "900 түсті қаламша", "price_coins": 18000, "category": "other", "icon_name": "Pen", "image_url": "https://images.pexels.com/photos/159825/color-pencil-drawing-coloring-colored-pencils-159825.jpeg?auto=compress&cs=tinysrgb&w=400"},
    {"title": "Қаламша жинағы 1000", "description": "1000 түсті қаламша", "price_coins": 20000, "category": "other", "icon_name": "Pen", "image_url": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80"},
]


def main():
    db = SessionLocal()
    try:
        existing_items = {i.title: i for i in db.query(ShopItem).all()}
        added = 0
        for d in ITEMS:
            if d["title"] in existing_items:
                continue
            db.add(ShopItem(**d))
            added += 1
        db.commit()
        if added > 0:
            print(f"Added {added} new shop items. Total in list: {len(ITEMS)}.")
        elif len(existing_items) == 0:
            print(f"Added {len(ITEMS)} shop items.")
        else:
            print(f"Shop already has all {len(ITEMS)} items. No new items added.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
