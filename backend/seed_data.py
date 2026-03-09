"""
Seed script: run from backend dir: python seed_data.py
Requires: DATABASE_URL in .env, tables created (run app once or alembic).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.models import (
    User, CourseCategory, Course, CourseModule, CourseTopic,
    Test, TestQuestion, StudentProgress, CourseEnrollment, Certificate,
    AIChallenge, UserActivityLog, StudySchedule, StudentGoal, TeacherGroup,
    GroupStudent, TeacherAssignment, AssignmentSubmission, Notification,
    AIChatHistory,
)
from app.core.security import get_password_hash
from datetime import datetime, date, timezone
from decimal import Decimal

def seed():
    db = SessionLocal()
    try:
        # Users
        if db.query(User).filter(User.email == "admin@edu.kz").first():
            # Add director/curator if missing (for existing DBs)
            if not db.query(User).filter(User.email == "director@edu.kz").first():
                db.add(User(email="director@edu.kz", password_hash=get_password_hash("director123"), full_name="Директор", role="director"))
            if not db.query(User).filter(User.email == "curator@edu.kz").first():
                db.add(User(email="curator@edu.kz", password_hash=get_password_hash("curator123"), full_name="Куратор", role="curator"))
            db.commit()
            print("Director/curator added if missing. Skip full seed.")
            return
        admin_user = User(
            email="admin@edu.kz",
            password_hash=get_password_hash("admin123"),
            full_name="Әкімші (Администратор)",
            role="admin",
        )
        db.add(admin_user)
        db.flush()
        director_user = User(email="director@edu.kz", password_hash=get_password_hash("director123"), full_name="Директор", role="director")
        curator_user = User(email="curator@edu.kz", password_hash=get_password_hash("curator123"), full_name="Куратор", role="curator")
        db.add(director_user)
        db.add(curator_user)
        db.flush()
        teacher1 = User(
            email="teacher1@edu.kz",
            password_hash=get_password_hash("teacher123"),
            full_name="Айгүл Нұрсұлтан",
            role="teacher",
        )
        teacher2 = User(
            email="teacher2@edu.kz",
            password_hash=get_password_hash("teacher123"),
            full_name="Ерлан Қайрат",
            role="teacher",
        )
        db.add(teacher1)
        db.add(teacher2)
        db.flush()
        parent_user = User(
            email="parent@edu.kz",
            password_hash=get_password_hash("parent123"),
            full_name="Ата-ана (Родитель)",
            role="parent",
        )
        db.add(parent_user)
        db.flush()
        for i, name in enumerate(["Айдар Асқар", "Асель Дәулет", "Нұрбол Ерлан", "Гүлнар Серік", "Бекзат Мұрат"], 1):
            u = User(
                email=f"student{i}@edu.kz",
                password_hash=get_password_hash("student123"),
                full_name=name,
                role="student",
                parent_id=parent_user.id if i == 1 else None,
            )
            db.add(u)
        db.commit()
        db.refresh(admin_user)
        db.refresh(teacher1)
        db.refresh(teacher2)
        admin_id = admin_user.id
        t1_id = teacher1.id
        t2_id = teacher2.id
        student_ids = [db.query(User).filter(User.email == f"student{i}@edu.kz").first().id for i in range(1, 6)]

        # Categories
        cats = [
            ("Программалау", "Программирование", "💻"),
            ("Web-әзірлеу", "Веб-разработка", "🌐"),
            ("Деректер ғылымы", "Наука о данных", "📊"),
            ("Мобильді әзірлеу", "Мобильная разработка", "📱"),
            ("Дизайн", "Дизайн", "🎨"),
        ]
        cat_ids = []
        for name, desc, icon in cats:
            c = CourseCategory(name=name, description=desc, icon=icon)
            db.add(c)
            db.flush()
            cat_ids.append(c.id)
        db.commit()

        # Course 1: Python (active)
        c1 = Course(
            title="Python программалау негіздері",
            description="Бұл курс Python программалау тілінің негіздерімен таныстырады. Сіз айнымалылар, деректер түрлері, циклдар және функцияларды үйренесіз.",
            category_id=cat_ids[0],
            is_active=True,
            price=Decimal("30000.00"),
            language="kz",
            created_by=admin_id,
            published_at=datetime.now(timezone.utc),
            image_url="https://codedamn-blog.s3.amazonaws.com/wp-content/uploads/2022/12/10131134/Python-image-with-logo-940x530-1.webp",
        )
        db.add(c1)
        db.flush()
        course1_id = c1.id
        m1_1 = CourseModule(course_id=course1_id, title="Кіріспе", order_number=1, description="Python-ға кіріспе")
        m1_2 = CourseModule(course_id=course1_id, title="Басқару құрылымдары", order_number=2, description="Шартты операторлар және циклдар")
        db.add(m1_1)
        db.add(m1_2)
        db.flush()
        topics1 = [
            (m1_1.id, "Python дегеніміз не?", 1, "/uploads/videos/course1/intro.mp4", 300, None),
            (m1_1.id, "Айнымалылар және деректер түрлері", 2, None, None, "Айнымалы — деректерді сақтау үшін пайдаланылатын атау. Python-да айнымалы жасау үшін тек атау мен мән беріледі: x = 5. Деректер түрлері: int (бүтін сандар), float (нақты сандар), str (мәтін), bool (True/False), list (тізім), dict (сөздік). Түрді type() функциясымен тексере аласыз."),
            (m1_1.id, "Операторлар", 3, None, None, "Арифметикалық: +, -, *, /, //, %, **. Салыстыру: ==, !=, <, >, <=, >=. Логикалық: and, or, not. Тағайындау: =, +=, -=, т.б. Операторлар өрнектерді есептеу үшін қолданылады."),
            (m1_2.id, "Шартты операторлар", 4, None, None, "if, elif, else — шартты орындау үшін. if шарт: блок орындалады. elif басқа шартты тексереді. else — ешқандай шарт орындалмаса. Блоктар кеңістікпен (indentation) белгіленеді."),
            (m1_2.id, "Циклдар", 5, None, None, "for циклы: for элемент in тізім: — әр элемент үшін орындалады. range(n) 0-ден n-1-ге дейін сандар береді. while циклы: while шарт: — шарт True болғанша қайталанады. break — циклдан шығады, continue — келесі итерацияға өтеді."),
        ]
        topic1_ids = []
        for mod_id, title, order, video, dur, desc in topics1:
            t = CourseTopic(course_id=course1_id, module_id=mod_id, title=title, order_number=order, video_url=video, video_duration=dur, description=desc)
            db.add(t)
            db.flush()
            topic1_ids.append(t.id)
        db.commit()

        # Tests for course 1 (per topic + final)
        def add_questions(test_id, count=10):
            qs = [
                ("Python - бұл не?", "a", "Программалау тілі", "Жылан", "Операциялық жүйе", "Деректер базасы"),
                ("Python қай жылы жасалған?", "b", "1985", "1991", "2000", "2010"),
                ("Python интерпретацияланатын тіл ме?", "a", "Иә", "Жоқ", "Кейде", "Білмеймін"),
                ("Айнымалы қалай жасалады?", "a", "x = 5", "var x", "int x", "variable x"),
                ("Тізім қандай жақшада?", "b", "()", "[]", "{}", "<>"),
                ("for циклы қандай көздерді қолданады?", "a", "range()", "loop()", "cycle()", "repeat()"),
                ("if операторы не үшін?", "a", "Шартты тексеру", "Цикл", "Функция", "Тізім"),
                ("Функция def арқылы жасалады ма?", "a", "Иә", "Жоқ", "Кейде", "function()"),
                ("Python-дағы None не?", "b", "0", "Жоқ мән", "Бос тізім", "Қате"),
                ("print() не істейді?", "a", "Экранға шығарады", "Оқиды", "Жазады", "Есептейді"),
            ]
            for i in range(count):
                q = qs[i % len(qs)]
                db.add(TestQuestion(test_id=test_id, question_text=q[0], correct_answer=q[1], option_a=q[2], option_b=q[3], option_c=q[4], option_d=q[5], order_number=i + 1))
        for idx, tid in enumerate(topic1_ids):
            test = Test(topic_id=tid, course_id=course1_id, title=f"Тест {idx+1}", passing_score=70, question_count=10, is_final=0, time_limit_seconds=600)
            db.add(test)
            db.flush()
            add_questions(test.id)
        final1 = Test(topic_id=None, course_id=course1_id, title="Python негіздері - Қорытынды тест", passing_score=70, question_count=20, is_final=1, time_limit_seconds=1200)
        db.add(final1)
        db.flush()
        add_questions(final1.id, 20)
        db.commit()

        # Course 2: Web (active)
        c2 = Course(
            title="Web-әзірлеу негіздері",
            description="HTML, CSS және JavaScript арқылы веб-сайттар жасауды үйреніңіз. Нақты жобалармен практикалық тәжірибе.",
            category_id=cat_ids[1],
            is_active=True,
            price=Decimal("35000.00"),
            language="kz",
            created_by=admin_id,
            published_at=datetime.now(timezone.utc),
            image_url="https://cdn.dribbble.com/userupload/28665909/file/original-ca7a072deb149dfe731d8de63491bfed.png?resize=752x&vertical=center",
        )
        db.add(c2)
        db.flush()
        course2_id = c2.id
        m2_1 = CourseModule(course_id=course2_id, title="HTML негіздері", order_number=1, description="HTML тегтері")
        m2_2 = CourseModule(course_id=course2_id, title="CSS стильдері", order_number=2, description="Веб-беттерді безендіру")
        m2_3 = CourseModule(course_id=course2_id, title="JavaScript негіздері", order_number=3, description="Интерактивті функционалдық")
        db.add(m2_1)
        db.add(m2_2)
        db.add(m2_3)
        db.flush()
        topics2 = [
            (m2_1.id, "HTML тегтері", 1, "/uploads/videos/course2/html-tags.mp4", 294, None),  # 4:54
            (m2_1.id, "Формалар", 2, None, None, """HTML формалары пайдаланушыдан деректер жинау үшін қолданылады.

<form> тегі — форманың негізі. action атрибуты деректер жіберілетін сервердің URL-ін көрсетеді. method — GET (URL-ге қосылады) немесе POST (құпия деректер үшін).

Негізгі элементтер:
• <input type="text"> — мәтін енгізу
• <input type="email"> — электрондық пошта
• <input type="password"> — құпия сөз
• <textarea> — ұзын мәтін
• <select> және <option> — тізімнен таңдау
• <button type="submit"> — форманы жіберу

name атрибуты әр элементке қойылуы керек — сервер осы атаулар арқылы деректерді алады. label тегі placeholder ретінде қолданылады."""),
            (m2_1.id, "Семантикалық HTML", 3, None, None, """Семантикалық HTML — беттің бөліктерінің мағынасын анықтайтын тегтер.

<div> орнына мағыналы тегтер қолдану:
• <header> — беттің немесе бөлімнің басы (логотип, навигация)
• <nav> — навигациялық сілтемелер
• <main> — беттің негізгі мазмұны (бір рет қолданылады)
• <article> — өзіндік мазмұн (мақала, пост)
• <section> — тақырыптық топтасқан бөлім
• <aside> — қосымша ақпарат (жақындағы посттар)
• <footer> — төменгі бөлім (сілтемелер, авторлық құқық)

Артықшылықтары: экран оқу құралдары үшін қолайлы, іздеу жүйелері мазмұнды жақсы түсінеді, код оқуға оңай."""),
            (m2_2.id, "CSS селекторлары", 4, None, None, """CSS селекторлары қандай элементтерге стиль қолданылатынын анықтайды.

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
• ::before, ::after — элементтің алдында/артында мазмұн қосу"""),
            (m2_2.id, "Flexbox", 5, None, None, "display: flex — икемді контейнер. flex-direction: row/column. justify-content — негізгі ось бойынша орналасу. align-items — көлденең ось. flex-wrap — ауысу. flex-grow, flex-shrink — элементтердің өлшемін басқару."),
            (m2_2.id, "Responsive дизайн", 6, None, None, "Медиа-сұраныстар: @media (max-width: 768px) { }. viewport meta тегі. Бірліктер: %, vw, vh, rem. min-width, max-width. Мобильді алдымен (mobile-first) тәсілі."),
            (m2_3.id, "JavaScript айнымалылары", 7, None, None, "let, const, var — айнымалы жасау. let және const — блок көлемінде. const — қайта тағайындалмайды. Примитивтер: number, string, boolean, null, undefined. Объектілер: object, array, function."),
            (m2_3.id, "DOM манипуляциясы", 8, None, None, "document.getElementById(), querySelector(), querySelectorAll() — элементтерді табу. textContent, innerHTML — мазмұнды өзгерту. addEventListener() — оқиғаларды қосу. createElement(), appendChild() — жаңа элементтер қосу. classList.add/remove — кластарды басқару."),
        ]
        for mod_id, title, order, video, dur, desc in topics2:
            t = CourseTopic(course_id=course2_id, module_id=mod_id, title=title, order_number=order, video_url=video, video_duration=dur, description=desc)
            db.add(t)
        db.commit()
        topic2_ids = [t.id for t in db.query(CourseTopic).filter(CourseTopic.course_id == course2_id).order_by(CourseTopic.order_number).all()]
        for idx, tid in enumerate(topic2_ids):
            test = Test(topic_id=tid, course_id=course2_id, title=f"Тест {idx+1}", passing_score=70, question_count=10, is_final=0, time_limit_seconds=600)
            db.add(test)
            db.flush()
            add_questions(test.id)
        final2 = Test(topic_id=None, course_id=course2_id, title="Web негіздері - Қорытынды тест", passing_score=70, question_count=20, is_final=1, time_limit_seconds=1200)
        db.add(final2)
        db.flush()
        add_questions(final2.id, 20)
        db.commit()

        # 18 inactive courses (placeholders)
        inactive = [
            ("Машиналық оқыту негіздері", "Жасанды интеллект пен ML алгоритмдері. Жақында.", cat_ids[2], 45000, "https://www.shutterstock.com/image-illustration/robot-hand-holding-ai-ml-600nw-2661516405.jpg"),
            ("React әзірлеу", "Заманауи веб-қосымшалар жасау. Жақында.", cat_ids[1], 40000, "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80"),
            ("Flutter мобильді әзірлеу", "iOS және Android қосымшалары. Жақында.", cat_ids[3], 42000, "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&q=80"),
            ("UI/UX дизайн", "Пайдаланушы интерфейсін жобалау. Жақында.", cat_ids[4], 38000, "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80"),
            ("SQL және деректер базасы", "PostgreSQL, MySQL негіздері. Жақында.", cat_ids[2], 32000, "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&q=80"),
            ("Docker және контейнерлеу", "DevOps негіздері. Жақында.", cat_ids[0], 48000, "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRIuhHJZ4Dk-nyf6G2z4-VTm__3JSfQ1P21gA&s"),
            ("TypeScript программалау", "JavaScript супер жиыны. Жақында.", cat_ids[0], 36000, "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400&q=80"),
            ("Node.js Backend әзірлеу", "Сервер жағын әзірлеу. Жақында.", cat_ids[0], 44000, "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&q=80"),
            ("Vue.js фреймворкі", "Progressive JavaScript фреймворкі. Жақында.", cat_ids[1], 38000, "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=400&q=80"),
            ("MongoDB NoSQL база", "Құжат-бағытталған деректер базасы. Жақында.", cat_ids[2], 40000, "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&q=80"),
            ("GraphQL API", "Заманауи API дизайны. Жақында.", cat_ids[0], 42000, "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80"),
            ("Figma дизайн құралы", "Веб-дизайн және прототиптеу. Жақында.", cat_ids[4], 35000, "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80"),
            ("Git және GitHub", "Нұсқаларды басқару. Жақында.", cat_ids[0], 25000, "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=400&q=80"),
            ("AWS бұлтты қызметтер", "Amazon Web Services негіздері. Жақында.", cat_ids[0], 55000, "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80"),
            ("Кибер қауіпсіздік негіздері", "Ақпараттық қауіпсіздік. Жақында.", cat_ids[0], 50000, "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&q=80"),
            ("Блокчейн технологиясы", "Криптовалюта және смарт-келісімшарттар. Жақында.", cat_ids[2], 60000, "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80"),
            ("Agile және Scrum", "Жобаларды басқару әдістемесі. Жақында.", cat_ids[0], 28000, "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80"),
            ("Тестілеу және QA", "Бағдарламалық қамтаманы тестілеу. Жақында.", cat_ids[0], 38000, "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&q=80"),
        ]
        for title, desc, cat_id, price, img_url in inactive:
            db.add(Course(title=title, description=desc, category_id=cat_id, is_active=True, price=Decimal(str(price)), language="kz", created_by=admin_id, image_url=img_url, published_at=datetime.now(timezone.utc)))
        db.commit()
        print("Seed completed: users, categories, 2 active courses with modules/topics/tests, 18 mock courses (all open).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
