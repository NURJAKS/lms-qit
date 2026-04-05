"""
Миграция: обновить видео и тесты для курса Web (course 2).
- Видео уже скопировано в uploads/videos/course2/html-tags.mp4
- Заменить вопросы теста темы "HTML тегтері" с Python на HTML
- Заменить вопросы финального теста Web с Python на HTML/CSS/JS
Запуск: cd backend && python migrate_html_topic.py
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import Course, CourseTopic, Test, TestQuestion

WEB_COURSE_TITLE = "Web-әзірлеу негіздері"
HTML_TAGS_TOPIC_TITLE = "HTML тегтері"

# Вопросы по HTML (Kazakh)
HTML_QUESTIONS = [
    ("HTML дегеніміз не?", "a", "HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyper Transfer Markup Language"),
    ("HTML тегтері қандай жақшада жазылады?", "b", "()", "<>", "[]", "{}"),
    ("<p> тегі не үшін қолданылады?", "a", "Параграф", "Кесте", "Сілтеме", "Сурет"),
    ("<a> тегі не үшін қолданылады?", "c", "Параграф", "Тақырып", "Сілтеме (link)", "Тізім"),
    ("<img> тегі қандай атрибутпен міндетті?", "a", "src", "href", "alt", "class"),
    ("<h1> — <h6> тегтері не үшін?", "b", "Параграф", "Тақырыптар (headings)", "Тізім", "Кесте"),
    ("<ul> тегі не үшін?", "a", "Нұсқалар тізімі", "Нөмірленген тізім", "Кесте", "Параграф"),
    ("<ol> тегі не үшін?", "b", "Нұсқалар тізімі", "Нөмірленген тізім", "Кесте", "Параграф"),
    ("<div> тегі не үшін қолданылады?", "a", "Блоктық контейнер", "Мәтін", "Сілтеме", "Сурет"),
    ("HTML құжаты қай тегпен басталады?", "a", "<!DOCTYPE html>", "<html>", "<head>", "<body>"),
]

# Вопросы для финального теста Web (HTML + CSS + JS)
WEB_FINAL_QUESTIONS = [
    ("HTML дегеніміз не?", "a", "HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyper Transfer Markup Language"),
    ("HTML тегтері қандай жақшада жазылады?", "b", "()", "<>", "[]", "{}"),
    ("<p> тегі не үшін қолданылады?", "a", "Параграф", "Кесте", "Сілтеме", "Сурет"),
    ("<a> тегі не үшін қолданылады?", "c", "Параграф", "Тақырып", "Сілтеме (link)", "Тізім"),
    ("<img> тегі қандай атрибутпен міндетті?", "a", "src", "href", "alt", "class"),
    ("<h1> — <h6> тегтері не үшін?", "b", "Параграф", "Тақырыптар (headings)", "Тізім", "Кесте"),
    ("<ul> тегі не үшін?", "a", "Нұсқалар тізімі", "Нөмірленген тізім", "Кесте", "Параграф"),
    ("<ol> тегі не үшін?", "b", "Нұсқалар тізімі", "Нөмірленген тізім", "Кесте", "Параграф"),
    ("<div> тегі не үшін қолданылады?", "a", "Блоктық контейнер", "Мәтін", "Сілтеме", "Сурет"),
    ("HTML құжаты қай тегпен басталады?", "a", "<!DOCTYPE html>", "<html>", "<head>", "<body>"),
    # CSS
    ("CSS дегеніміз не?", "b", "Программалау тілі", "Стиль кестелер тілі", "Деректер базасы", "Фреймворк"),
    ("CSS селектор не?", "a", "Элементті таңдау құралы", "Цикл", "Функция", "Айнымалы"),
    ("Flexbox не үшін қолданылады?", "b", "Мәтінді стильдеу", "Элементтерді орналастыру", "Сұраныс жасау", "Анимация"),
    ("Responsive дизайн не?", "a", "Барлық құрылғыларға бейімделу", "Тек мобильді", "Тек компьютер", "Тек планшет"),
    ("CSS-та түс қалай көрсетіледі?", "c", "color: red", "color = red", "color: red;", "color(red)"),
    # JavaScript
    ("JavaScript дегеніміз не?", "a", "Скрипт тілі", "Стиль тілі", "Разметка тілі", "Деректер базасы"),
    ("JavaScript айнымалысы қалай жасалады?", "b", "int x", "let x", "var x = 5", "variable x"),
    ("DOM дегеніміз не?", "a", "Document Object Model", "Data Object Model", "Design Object Model", "Dynamic Object Model"),
    ("addEventListener не үшін?", "c", "Стиль қосу", "Мәтінді өзгерту", "Оқиғаны тыңдау", "Сурет қосу"),
    ("console.log() не істейді?", "a", "Консольға шығарады", "Экранға жазады", "Файлға жазады", "Ештеңе істемейді"),
]


def migrate():
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
        if not course:
            print(f'Course "{WEB_COURSE_TITLE}" not found.')
            return
        topic = (
            db.query(CourseTopic)
            .filter(
                CourseTopic.course_id == course.id,
                CourseTopic.title == HTML_TAGS_TOPIC_TITLE,
            )
            .first()
        )
        if not topic:
            print(f'Topic "{HTML_TAGS_TOPIC_TITLE}" not found for Web course.')
            return

        # Обновить video_url (если нужно)
        topic.video_url = "/uploads/videos/course2/html-tags.mp4"
        # video_duration — можно оставить или обновить (420 или реальная длительность)
        if not topic.video_duration or topic.video_duration < 60:
            topic.video_duration = 3600  # 1 час по умолчанию
        db.commit()

        # Найти тест для этой темы
        test = db.query(Test).filter(
            Test.topic_id == topic.id,
            Test.is_final == 0,
        ).first()
        if not test:
            print("Test for topic not found.")
            return

        # Удалить старые вопросы
        db.query(TestQuestion).filter(TestQuestion.test_id == test.id).delete()
        db.commit()

        # Добавить HTML вопросы
        for i, q in enumerate(HTML_QUESTIONS):
            db.add(TestQuestion(
                test_id=test.id,
                question_text=q[0],
                correct_answer=q[1],
                option_a=q[2],
                option_b=q[3],
                option_c=q[4],
                option_d=q[5],
                order_number=i + 1,
            ))
        db.commit()
        test.question_count = len(HTML_QUESTIONS)
        db.commit()
        print(f"Migrated: topic {topic.id} (HTML тегтері), test {test.id} — {len(HTML_QUESTIONS)} HTML questions.")

        # Финальный тест Web курса — заменить Python на HTML/CSS/JS
        final_test = db.query(Test).filter(
            Test.course_id == course.id,
            Test.is_final == 1,
        ).first()
        if final_test:
            db.query(TestQuestion).filter(TestQuestion.test_id == final_test.id).delete()
            db.commit()
            for i, q in enumerate(WEB_FINAL_QUESTIONS):
                db.add(TestQuestion(
                    test_id=final_test.id,
                    question_text=q[0],
                    correct_answer=q[1],
                    option_a=q[2],
                    option_b=q[3],
                    option_c=q[4],
                    option_d=q[5],
                    order_number=i + 1,
                ))
            db.commit()
            final_test.question_count = len(WEB_FINAL_QUESTIONS)
            db.commit()
            print(f"Migrated: Web final test {final_test.id} — {len(WEB_FINAL_QUESTIONS)} HTML/CSS/JS questions.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
