#!/usr/bin/env python3
"""Remove video from non-video topics and add descriptions. Run after seed if DB already exists."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.course_topic import CourseTopic

VIDEO_TOPICS = {"Python дегеніміз не?", "HTML тегтері"}

DESCRIPTIONS = {
    "Айнымалылар және деректер түрлері": "Айнымалы — деректерді сақтау үшін пайдаланылатын атау. Python-да айнымалы жасау үшін тек атау мен мән беріледі: x = 5. Деректер түрлері: int (бүтін сандар), float (нақты сандар), str (мәтін), bool (True/False), list (тізім), dict (сөздік). Түрді type() функциясымен тексере аласыз.",
    "Операторлар": "Арифметикалық: +, -, *, /, //, %, **. Салыстыру: ==, !=, <, >, <=, >=. Логикалық: and, or, not. Тағайындау: =, +=, -=, т.б. Операторлар өрнектерді есептеу үшін қолданылады.",
    "Шартты операторлар": "if, elif, else — шартты орындау үшін. if шарт: блок орындалады. elif басқа шартты тексереді. else — ешқандай шарт орындалмаса. Блоктар кеңістікпен (indentation) белгіленеді.",
    "Циклдар": "for циклы: for элемент in тізім: — әр элемент үшін орындалады. range(n) 0-ден n-1-ге дейін сандар береді. while циклы: while шарт: — шарт True болғанша қайталанады. break — циклдан шығады, continue — келесі итерацияға өтеді.",
    "Формалар": 'HTML формалары пайдаланушыдан деректер жинау үшін қолданылады.\n\n<form> тегі — форманың негізі. action атрибуты деректер жіберілетін сервердің URL-ін көрсетеді. method — GET немесе POST.\n\nНегізгі элементтер: <input type="text">, <input type="email">, <input type="password">, <textarea>, <select>, <button>. name атрибуты әр элементке қойылуы керек.',
    "Семантикалық HTML": "Семантикалық HTML — беттің бөліктерінің мағынасын анықтайтын тегтер. <header>, <nav>, <main>, <article>, <section>, <aside>, <footer>. Артықшылықтары: экран оқу құралдары үшін қолайлы, SEO-ға көмектеседі.",
    "CSS селекторлары": "CSS селекторлары қандай элементтерге стиль қолданылатынын анықтайды. Негізгі: элемент (p, div), класс (.class), id (#id). Комбинаторлар: div p, div > p, h1 + p. Псевдокласстар: :hover, :focus. Псевдоэлементтер: ::before, ::after.",
    "Flexbox": "display: flex — икемді контейнер. flex-direction: row/column. justify-content — негізгі ось бойынша орналасу. align-items — көлденең ось. flex-wrap — ауысу. flex-grow, flex-shrink — элементтердің өлшемін басқару.",
    "Responsive дизайн": "Медиа-сұраныстар: @media (max-width: 768px) { }. viewport meta тегі. Бірліктер: %, vw, vh, rem. min-width, max-width. Мобильді алдымен (mobile-first) тәсілі.",
    "JavaScript айнымалылары": "let, const, var — айнымалы жасау. let және const — блок көлемінде. const — қайта тағайындалмайды. Примитивтер: number, string, boolean, null, undefined. Объектілер: object, array, function.",
    "DOM манипуляциясы": "document.getElementById(), querySelector(), querySelectorAll() — элементтерді табу. textContent, innerHTML — мазмұнды өзгерту. addEventListener() — оқиғаларды қосу. createElement(), appendChild() — жаңа элементтер қосу. classList.add/remove — кластарды басқару.",
}


def main():
    db = SessionLocal()
    try:
        topics = db.query(CourseTopic).all()
        updated = 0
        for t in topics:
            if t.title in VIDEO_TOPICS:
                continue
            changed = False
            if t.video_url:
                t.video_url = None
                t.video_duration = None
                changed = True
            if t.title in DESCRIPTIONS and (not t.description or t.description != DESCRIPTIONS[t.title]):
                t.description = DESCRIPTIONS[t.title]
                changed = True
            if changed:
                updated += 1
        db.commit()
        print(f"Updated {updated} topics (removed video, added descriptions for non-video topics)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
