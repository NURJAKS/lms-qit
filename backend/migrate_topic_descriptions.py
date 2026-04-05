"""
Backfill topic descriptions for Python (course 1) and Web (course 2).
Run from backend dir: python migrate_topic_descriptions.py
Only updates topics that have no description (None or empty).
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import CourseTopic

# Descriptions by course_id, index = order_number - 1 (same as in seed_data)
DESCRIPTIONS_COURSE_1 = [
    "Python — интерпретацияланатын жоғары деңгейлі программалау тілі. Оны 1991 жылы Гвидо ван Россум жасады. Қарапайым синтаксисі, оқуға оңайлығы және үлкен қолдау қоғамымен танымал. Веб-әзірлеу, деректер талдау, автоматтандыру және AI салаларында кең қолданылады. Бұл сабақта сіз видеоны қарап, Python негіздерімен танысасыз.",
    "Айнымалы — деректерді сақтау үшін пайдаланылатын атау. Python-да айнымалы жасау үшін тек атау мен мән беріледі: x = 5. Деректер түрлері: int (бүтін сандар), float (нақты сандар), str (мәтін), bool (True/False), list (тізім), dict (сөздік). Түрді type() функциясымен тексере аласыз.",
    "Арифметикалық: +, -, *, /, //, %, **. Салыстыру: ==, !=, <, >, <=, >=. Логикалық: and, or, not. Тағайындау: =, +=, -=, т.б. Операторлар өрнектерді есептеу үшін қолданылады.",
    "if, elif, else — шартты орындау үшін. if шарт: блок орындалады. elif басқа шартты тексереді. else — ешқандай шарт орындалмаса. Блоктар кеңістікпен (indentation) белгіленеді.",
    "for циклы: for элемент in тізім: — әр элемент үшін орындалады. range(n) 0-ден n-1-ге дейін сандар береді. while циклы: while шарт: — шарт True болғанша қайталанады. break — циклдан шығады, continue — келесі итерацияға өтеді.",
]
DESCRIPTIONS_COURSE_2 = [
    "HTML (HyperText Markup Language) — веб-беттердің құрылымын құруға арналған разметка (белгілеу) тілі; бағдарламалау тілі емес. Браузер HTML кодын оқып парақты көрсетеді; CSS — сыртқы түрі, JavaScript — интерактивтілік. Бұл сабақта сіз HTML не екенін және веб-технологиялар стегін түсінесіз.",
    "HTML (HyperText Markup Language) — веб-беттердің құрылымын сипаттайтын разметка тілі. Тегтер арқылы мәтін, суреттер, сілтемелер, формалар және басқа элементтер анықталады. Браузер осы тегтерді оқып, бетті көрсетеді. Бұл сабақта сіз видеоны қарап, негізгі HTML тегтерімен танысасыз.",
    """HTML формалары пайдаланушыдан деректер жинау үшін қолданылады.

<form> тегі — форманың негізі. action атрибуты деректер жіберілетін сервердің URL-ін көрсетеді. method — GET (URL-ге қосылады) немесе POST (құпия деректер үшін).

Негізгі элементтер:
• <input type="text"> — мәтін енгізу
• <input type="email"> — электрондық пошта
• <input type="password"> — құпия сөз
• <textarea> — ұзын мәтін
• <select> және <option> — тізімнен таңдау
• <button type="submit"> — форманы жіберу

name атрибуты әр элементке қойылуы керек — сервер осы атаулар арқылы деректерді алады. label тегі placeholder ретінде қолданылады.""",
    """Семантикалық HTML — беттің бөліктерінің мағынасын анықтайтын тегтер.

<div> орнына мағыналы тегтер қолдану:
• <header> — беттің немесе бөлімнің басы (логотип, навигация)
• <nav> — навигациялық сілтемелер
• <main> — беттің негізгі мазмұны (бір рет қолданылады)
• <article> — өзіндік мазмұн (мақала, пост)
• <section> — тақырыптық топтасқан бөлім
• <aside> — қосымша ақпарат (жақындағы посттар)
• <footer> — төменгі бөлім (сілтемелер, авторлық құқық)

Артықшылықтары: экран оқу құралдары үшін қолайлы, іздеу жүйелері мазмұнды жақсы түсінеді, код оқуға оңай.""",
    """CSS селекторлары қандай элементтерге стиль қолданылатынын анықтайды.

Негізгі селекторлар:
• p, div — элемент аты бойынша
• .class — класс бойынша (class="class")
• #id — id бойынша (бір элементке)

Комбинаторлар:
• div p — div ішіндегі барлық p (ұрпақтар)
• div > p — тікелей бала p
• h1 + p — h1-ден кейінгі бірінші p (қатардағы)

Псевдокласстар — элементтің күйі:
• :hover — тінтуір үстінде
• :focus — фокус алғанда
• :first-child, :last-child — бірінші/соңғы бала

Псевдоэлементтер — виртуалды бөліктер:
• ::before, ::after — элементтің алдында/артында мазмұн қосу""",
    "display: flex — икемді контейнер. flex-direction: row/column. justify-content — негізгі ось бойынша орналасу. align-items — көлденең ось. flex-wrap — ауысу. flex-grow, flex-shrink — элементтердің өлшемін басқару.",
    "Медиа-сұраныстар: @media (max-width: 768px) { }. viewport meta тегі. Бірліктер: %, vw, vh, rem. min-width, max-width. Мобильді алдымен (mobile-first) тәсілі.",
    "let, const, var — айнымалы жасау. let және const — блок көлемінде. const — қайта тағайындалмайды. Примитивтер: number, string, boolean, null, undefined. Объектілер: object, array, function.",
    "document.getElementById(), querySelector(), querySelectorAll() — элементтерді табу. textContent, innerHTML — мазмұнды өзгерту. addEventListener() — оқиғаларды қосу. createElement(), appendChild() — жаңа элементтер қосу. classList.add/remove — кластарды басқару.",
    "Оқиғалар: click, submit, input, load — addEventListener арқылы өңдеуші тағайындау. Функциялар — қайталанатын код блогы; параметрлер мен return. event.preventDefault() — әдепкі әрекетті болдырмау.",
]


def migrate():
    db = SessionLocal()
    try:
        updated = 0
        for course_id, descriptions in [(1, DESCRIPTIONS_COURSE_1), (2, DESCRIPTIONS_COURSE_2)]:
            topics = db.query(CourseTopic).filter(
                CourseTopic.course_id == course_id,
            ).order_by(CourseTopic.order_number).all()
            for topic in topics:
                idx = topic.order_number - 1
                if idx < 0 or idx >= len(descriptions):
                    continue
                if not (topic.description or topic.description.strip()):
                    topic.description = descriptions[idx]
                    updated += 1
                    print(f"Updated topic id={topic.id} (course {course_id}, order {topic.order_number}): {topic.title[:40]}...")
        db.commit()
        print(f"Done. Updated {updated} topic descriptions.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
