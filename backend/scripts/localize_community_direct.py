import sqlite3
import os

def localize_community():
    db_path = os.path.join(os.path.dirname(__file__), "..", "education.db")
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        translations = {
            "Добро пожаловать в наше сообщество!": "Біздің қоғамдастыққа қош келдіңіз!",
            "Здесь вы можете задавать вопросы и делиться опытом.": "Мұнда сіз сұрақтар қойып, тәжірибе бөлісе аласыз.",
            "Объявление": "Хабарландыру",
            "Новое задание": "Жаңа тапсырма",
            "Пожалуйста, соблюдайте правила общения.": "Қарым-қатынас ережелерін сақтауыңызды сұраймыз.",
            "Важное сообщение": "Маңызды хабарлама",
            "Опрос": "Сауалнама",
            "Результаты теста": "Тест нәтижелері",
            "Когда я учился на курсе, мне очень помогал короткий конспект после каждого урока. 5-10 минут на запись экономят часы перед тестами.": "Мен курста оқығанда, әр сабақтан кейінгі қысқаша конспект маған көп көмектесті. Жоспарға 5-10 минут жұмсасаңыз, тест алдындағы уақытты айтарлықтай үнемдейсіз.",
            "Я сначала решаю задачу на бумаге, потом пишу pseudo-code и только потом код. Ошибок становится намного меньше, а логика сразу понятна.": "Мен алдымен есепті қағазға шығарамын, содан кейін псевдокод жазамын, содан кейін ғана код жазамын. Қателер әлдеқайда азаяды, ал логика бірден түсінікті болады.",
            "Если застрял на задаче, объясни её вслух другому человеку или даже самому себе. Это реально помогает заметить, где именно ты запутался.": "Егер есепті шығара алмай жатсаңыз, оны басқа адамға немесе тіпті өзіңізге дауыстап түсіндіріп көріңіз. Бұл нақты қай жерде шатасқаныңызды байқауға көмектеседі.",
            "После выпуска я перестал учить всё подряд и начал делать маленькие проекты. Так знания закрепляются намного лучше, чем от одного чтения.": "Бітіргеннен кейін мен бәрін қатарынан оқуды тоқтатып, кішігірім жобалар жасай бастадым. Осылайша білім тек оқуға қарағанда әлдеқайда жақсы бекітіледі.",
            "Не бойтесь задавать вопросы в чате курса. Часто один короткий вопрос экономит целый вечер поиска.": "Курс чатында сұрақ қоюдан қорықпаңыз. Көбінесе бір қысқа сұрақ іздеуге кететін тұтас бір кешті үнемдейді."
        }
        
        updated_count = 0
        
        # 1. Update course_feed_posts
        cursor.execute("SELECT id, title, body FROM course_feed_posts")
        for post_id, title, body in cursor.fetchall():
            new_title = title
            new_body = body
            changed = False
            if title in translations: new_title = translations[title]; changed = True
            if body in translations: new_body = translations[body]; changed = True
            if not changed:
                for ru, kk in translations.items():
                    if title and ru in title: new_title = new_title.replace(ru, kk); changed = True
                    if body and ru in body: new_body = new_body.replace(ru, kk); changed = True
            if changed:
                cursor.execute("UPDATE course_feed_posts SET title = ?, body = ? WHERE id = ?", (new_title, new_body, post_id))
                updated_count += 1

        # 2. Update community_posts
        cursor.execute("SELECT id, text FROM community_posts")
        for post_id, text in cursor.fetchall():
            new_text = text
            changed = False
            if text in translations: new_text = translations[text]; changed = True
            if not changed:
                for ru, kk in translations.items():
                    if text and ru in text: new_text = new_text.replace(ru, kk); changed = True
            if changed:
                cursor.execute("UPDATE community_posts SET text = ? WHERE id = ?", (new_text, post_id))
                updated_count += 1
        
        conn.commit()
        print(f"Successfully updated {updated_count} community posts to Kazakh using direct SQLite.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    localize_community()
