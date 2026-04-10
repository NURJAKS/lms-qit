import json
import random
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.test_question import TestQuestion
from app.models.progress import StudentProgress
from app.models.ai_challenge import AIChallenge
from app.models.notification import Notification
from app.models.course_topic import CourseTopic
from app.models.course import Course
from app.services.ai_service import get_challenge_recommendations, solve_quiz_questions
from app.data.challenge_questions import (
    get_questions_by_mode,
    CHALLENGE_CATEGORIES,
    CATEGORY_LABELS,
)

router = APIRouter(prefix="/challenge", tags=["ai_challenge"])

AI_CHALLENGE_ERRORS = {
    "no_topics": {
        "ru": "В выбранном курсе нет доступных тем с вопросами.",
        "kk": "Таңдалған курста сұрақтары бар қолжетімді тақырыптар жоқ.",
        "en": "There are no available topics with questions in the selected course.",
    },
    "web_requirement": {
        "ru": "Для Web-соревнования нужно пройти хотя бы одну тему в курсе «Web-әзірлеу негіздері».",
        "kk": "Web-жарыс үшін «Web-әзірлеу негіздері» курсында кемінде бір тақырыпты аяқтау керек.",
        "en": "For the Web challenge, you need to complete at least one topic in the 'Web Development Basics' course.",
    },
    "informatics_requirement": {
        "ru": "Для трека «Информатика» пройдите хотя бы одну тему курса «Информатика және ақпараттық технологиялар негіздері».",
        "kk": "«Информатика» трегі үшін «Информатика және ақпараттық технологиялар негіздері» курсының кемінде бір тақырыбын аяқтаңыз.",
        "en": "For the 'Informatics' track, complete at least one topic of the 'Informatics and IT Basics' course.",
    },
    "cybersecurity_requirement": {
        "ru": "Для трека «Основы кибербезопасности» пройдите хотя бы одну тему в соответствующем курсе.",
        "kk": "«Киберқауіпсіздік негіздері» трегі үшін тиісті курста кемінде бір тақырыпты аяқтаңыз.",
        "en": "For the 'Cybersecurity Fundamentals' track, complete at least one topic in the corresponding course.",
    },
    "python_requirement": {
        "ru": "Для Python-соревнования нужно пройти хотя бы одну тему в курсе «Python программалау негіздері».",
        "kk": "Python-жарысы үшін «Python программалау негіздері» курсында кемінде бір тақырыпты аяқтау керек.",
        "en": "For the Python challenge, you need to complete at least one topic in the 'Python Programming Basics' course.",
    },
    "memory_web": {
        "ru": "Для игры «Память» (Web) пройдите хотя бы одну тему.",
        "kk": "«Жад» ойыны үшін (Web) кемінде бір тақырыпты аяқтаңыз.",
        "en": "To play 'Memory' (Web), please complete at least one topic.",
    },
    "memory_informatics": {
        "ru": "Для игры «Память» (Информатика) пройдите хотя бы одну тему.",
        "kk": "«Жад» ойыны үшін (Информатика) кемінде бір тақырыпты аяқтаңыз.",
        "en": "To play 'Memory' (Informatics), please complete at least one topic.",
    },
    "memory_cybersecurity": {
        "ru": "Для игры «Память» (кибербезопасность) пройдите хотя бы одну тему соответствующего курса.",
        "kk": "«Жад» ойыны үшін (киберқауіпсіздік) тиісті курстың кемінде бір тақырыбын аяқтаңыз.",
        "en": "To play 'Memory' (cybersecurity), please complete at least one topic in the corresponding course.",
    },
    "memory_python": {
        "ru": "Для игры «Память» (Python) пройдите хотя бы одну тему.",
        "kk": "«Жад» ойыны үшін (Python) кемінде бір тақырыпты аяқтаңыз.",
        "en": "To play 'Memory' (Python), please complete at least one topic.",
    },
    "memory_more_topics": {
        "ru": "Пройдите больше тем для игры «Память».",
        "kk": "«Жад» ойыны үшін көбірек тақырыпты аяқтаңыз.",
        "en": "Complete more topics to play 'Memory'.",
    },
    "challenge_not_found": {
        "ru": "Челлендж не найден",
        "kk": "Челлендж табылмады",
        "en": "Challenge not found",
    },
    "unknown_mode": {
        "ru": "Неизвестный режим: {mode}",
        "kk": "Белгісіз режим: {mode}",
        "en": "Unknown mode: {mode}",
    },
    "not_enough_questions": {
        "ru": "Недостаточно вопросов для этого режима.",
        "kk": "Бұл режим үшін сұрақтар жеткіліксіз.",
        "en": "Not enough questions for this mode.",
    },
    "new_modes_only": {
        "ru": "Этот эндпоинт только для новых режимов",
        "kk": "Бұл эндпоинт тек жаңа режимдерге арналған",
        "en": "This endpoint is only for new modes",
    },
    "web_not_found": {
        "ru": "Web-курс не найден в базе. Обратитесь к администратору.",
        "kk": "Web-курс базадан табылмады. Администраторға хабарласыңыз.",
        "en": "Web course not found. Please contact administrator.",
    },
    "web_no_questions": {
        "ru": "В Web-курсе нет тестовых вопросов для AI Challenge.",
        "kk": "Web-курсында AI Challenge үшін тест сұрақтары жоқ.",
        "en": "There are no test questions for AI Challenge in the Web course.",
    },
    "informatics_not_found": {
        "ru": "Курс информатики не найден. Обратитесь к администратору.",
        "kk": "Информатика курсы табылмады. Администраторға хабарласыңыз.",
        "en": "Informatics course not found. Please contact administrator.",
    },
    "informatics_no_questions": {
        "ru": "В курсе информатики нет тестовых вопросов для AI Challenge.",
        "kk": "Информатика курсында AI Challenge үшін тест сұрақтары жоқ.",
        "en": "There are no test questions for AI Challenge in the Informatics course.",
    },
    "cyber_not_found": {
        "ru": "Курс по кибербезопасности не найден. Обратитесь к администратору.",
        "kk": "Киберқауіпсіздік курсы табылмады. Администраторға хабарласыңыз.",
        "en": "Cybersecurity course not found. Please contact administrator.",
    },
    "cyber_no_questions": {
        "ru": "В курсе по кибербезопасности нет тестовых вопросов для AI Challenge.",
        "kk": "Киберқауіпсіздік курсында AI Challenge үшін тест сұрақтары жоқ.",
        "en": "There are no test questions for AI Challenge in the Cybersecurity course.",
    },
    "python_not_found": {
        "ru": "Python курс не найден.",
        "kk": "Python курсы табылмады.",
        "en": "Python course not found.",
    },
    "notif_title_classic": {
        "ru": "AI vs Студент - результат",
        "kk": "AI vs Студент - нәтиже",
        "en": "AI vs Student - result",
    },
    "notif_message_classic": {
        "ru": "Вы: {user_correct}/{total}. AI: {ai_correct}/{total}. Время: Вы {user_time:.1f}с, AI {ai_time:.1f}с.",
        "kk": "Сіз {user_correct}/{total} дұрыс. AI: {ai_correct}/{total}. Уақыт: сіз {user_time:.1f}с, AI {ai_time:.1f}с.",
        "en": "You: {user_correct}/{total}. AI: {ai_correct}/{total}. Time: You {user_time:.1f}s, AI {ai_time:.1f}s.",
    },
    "notif_title_new": {
        "ru": "AI vs Студент — {mode}",
        "kk": "AI vs Студент — {mode}",
        "en": "AI vs Student — {mode}",
    },
    "notif_message_new": {
        "ru": "Вы: {user_correct}/{total}. AI: {ai_correct}/{total}.",
        "kk": "Сіз {user_correct}/{total} дұрыс. AI: {ai_correct}/{total}.",
        "en": "You: {user_correct}/{total}. AI: {ai_correct}/{total}.",
    },
    "find_bug": {"ru": "Найди баг", "kk": "Багты тап", "en": "Find bug"},
    "guess_output": {"ru": "Угадай вывод", "kk": "Нәтижені тап", "en": "Guess output"},
    "speed_code": {"ru": "Скоростной код", "kk": "Жылдам код", "en": "Speed code"},
}

def get_error_msg(key: str, lang: str | None = "ru", **kwargs) -> str:
    locale = lang if lang in ("ru", "kk", "en") else "ru"
    msg = AI_CHALLENGE_ERRORS.get(key, {}).get(locale, AI_CHALLENGE_ERRORS.get(key, {}).get("ru", key))
    if kwargs:
        return msg.format(**kwargs)
    return msg


def _get_localized_field(payload: dict, base_key: str, lang: str | None = "ru") -> str:
    locale = lang if lang in ("ru", "kk", "en") else "ru"
    if locale == "kk":
        return payload.get(f"{base_key}_kk") or payload.get(base_key, "")
    if locale == "en":
        return payload.get(f"{base_key}_en") or payload.get(base_key, "")
    return payload.get(base_key, "")

AI_LEVELS = ("beginner", "intermediate", "expert")
AI_TIME_RANGES = {
    "beginner": (3.0, 4.0),
    "intermediate": (2.0, 3.0),
    "expert": (1.2, 2.0),
}
ROUND_TIME_LIMIT = 90
ROUND_TIME_LIMIT_BY_LEVEL = {
    "beginner": 90,
    "intermediate": 130,
    "expert": 150,
}
QUESTIONS_LIMIT_BY_LEVEL = {
    "beginner": 4,
    "intermediate": 7,
    "expert": 12,
}
MIN_QUESTIONS_TO_START = 1

LOCAL_CLASSIC_TRACK_QUESTIONS: dict[str, list[dict]] = {
    "informatics": [
        {
            "id": -1001,
            "question_text": "Что такое алгоритм?",
            "option_a": "База данных",
            "option_b": "Последовательность шагов для решения задачи",
            "option_c": "Язык разметки",
            "option_d": "Тип вируса",
            "correct_answer": "b",
            "question_text_kk": "Алгоритм деген не?",
            "option_a_kk": "Деректер қоры",
            "option_b_kk": "Мәселені шешу үшін қадамдар тізбегі",
            "option_c_kk": "Белгілеу тілі",
            "option_d_kk": "Вирус түрі",
        },
        {
            "id": -1002,
            "question_text": "Какое устройство отвечает за временное хранение данных во время работы программ?",
            "option_a": "SSD",
            "option_b": "HDD",
            "option_c": "Оперативная память (RAM)",
            "option_d": "Видеокарта",
            "correct_answer": "c",
            "question_text_kk": "Бағдарламалар жұмысы кезінде деректерді уақытша сақтайтын құрылғы қандай?",
            "option_a_kk": "SSD",
            "option_b_kk": "HDD",
            "option_c_kk": "Жедел жад (RAM)",
            "option_d_kk": "Бейне карта",
        },
        {
            "id": -1003,
            "question_text": "Что означает CPU?",
            "option_a": "Central Processing Unit",
            "option_b": "Control Program Utility",
            "option_c": "Computer Power Unit",
            "option_d": "Central Program Update",
            "correct_answer": "a",
            "question_text_kk": "CPU деген не білдіреді?",
            "option_a_kk": "Central Processing Unit",
            "option_b_kk": "Control Program Utility",
            "option_c_kk": "Computer Power Unit",
            "option_d_kk": "Central Program Update",
        },
        {
            "id": -1004,
            "question_text": "Какой формат используется для структурированного обмена данными в вебе?",
            "option_a": "PDF",
            "option_b": "JPEG",
            "option_c": "JSON",
            "option_d": "MP3",
            "correct_answer": "c",
            "question_text_kk": "Вебте құрылымдық деректер алмасу үшін қандай формат қолданылады?",
            "option_a_kk": "PDF",
            "option_b_kk": "JPEG",
            "option_c_kk": "JSON",
            "option_d_kk": "MP3",
        },
        {
            "id": -1005,
            "question_text": "Какой протокол обычно используют для защищенной передачи данных в браузере?",
            "option_a": "FTP",
            "option_b": "HTTP",
            "option_c": "SMTP",
            "option_d": "HTTPS",
            "correct_answer": "d",
            "question_text_kk": "Браузерде деректерді қауіпсіз жіберу үшін әдетте қандай хаттама қолданылады?",
            "option_a_kk": "FTP",
            "option_b_kk": "HTTP",
            "option_c_kk": "SMTP",
            "option_d_kk": "HTTPS",
        },
        {
            "id": -1006,
            "question_text": "Что такое переменная в программировании?",
            "option_a": "Фиксированная константа",
            "option_b": "Именованная область памяти для хранения значения",
            "option_c": "Графический элемент",
            "option_d": "Сетевой кабель",
            "correct_answer": "b",
            "question_text_kk": "Бағдарламалауда айнымалы деген не?",
            "option_a_kk": "Тұрақты мән",
            "option_b_kk": "Мән сақталатын атауы бар жад аймағы",
            "option_c_kk": "Графикалық элемент",
            "option_d_kk": "Желілік кабель",
        },
        {
            "id": -1007,
            "question_text": "Какая структура данных хранит пары ключ-значение?",
            "option_a": "Массив",
            "option_b": "Стек",
            "option_c": "Словарь (map/dict)",
            "option_d": "Очередь",
            "correct_answer": "c",
            "question_text_kk": "Қандай деректер құрылымы кілт-мән жұптарын сақтайды?",
            "option_a_kk": "Массив",
            "option_b_kk": "Стек",
            "option_c_kk": "Сөздік (map/dict)",
            "option_d_kk": "Кезек",
        },
        {
            "id": -1008,
            "question_text": "Что делает оператор сравнения '=='?",
            "option_a": "Присваивает значение",
            "option_b": "Сравнивает значения на равенство",
            "option_c": "Удаляет переменную",
            "option_d": "Увеличивает число",
            "correct_answer": "b",
            "question_text_kk": "'==' салыстыру операторы не істейді?",
            "option_a_kk": "Мән меншіктейді",
            "option_b_kk": "Мәндерді теңдік бойынша салыстырады",
            "option_c_kk": "Айнымалыны жояды",
            "option_d_kk": "Санды арттырады",
        },
    ],
    "cybersecurity": [
        {
            "id": -2001,
            "question_text": "Что такое фишинг?",
            "option_a": "Метод резервного копирования",
            "option_b": "Попытка выманить данные через поддельные сообщения/сайты",
            "option_c": "Тип шифрования",
            "option_d": "Антивирусное сканирование",
            "correct_answer": "b",
            "question_text_kk": "Фишинг деген не?",
            "option_a_kk": "Сақтық көшірме әдісі",
            "option_b_kk": "Жалған хабарлама/сайт арқылы дерек алдау",
            "option_c_kk": "Шифрлау түрі",
            "option_d_kk": "Антивирустық сканерлеу",
        },
        {
            "id": -2002,
            "question_text": "Какой пароль считается более надежным?",
            "option_a": "12345678",
            "option_b": "qwerty",
            "option_c": "N7!kP2@zL9",
            "option_d": "password",
            "correct_answer": "c",
            "question_text_kk": "Қандай құпия сөз сенімдірек саналады?",
            "option_a_kk": "12345678",
            "option_b_kk": "qwerty",
            "option_c_kk": "N7!kP2@zL9",
            "option_d_kk": "password",
        },
        {
            "id": -2003,
            "question_text": "Зачем нужна двухфакторная аутентификация (2FA)?",
            "option_a": "Чтобы ускорить вход",
            "option_b": "Чтобы добавить второй шаг подтверждения и снизить риск взлома",
            "option_c": "Чтобы отключить пароль",
            "option_d": "Чтобы удалить аккаунт",
            "correct_answer": "b",
            "question_text_kk": "Екі факторлы аутентификация (2FA) не үшін керек?",
            "option_a_kk": "Кіруді жылдамдату үшін",
            "option_b_kk": "Растаудың екінші қадамын қосып, бұзу қаупін азайту үшін",
            "option_c_kk": "Құпия сөзді өшіру үшін",
            "option_d_kk": "Аккаунтты жою үшін",
        },
        {
            "id": -2004,
            "question_text": "Что делает антивирус?",
            "option_a": "Ускоряет интернет",
            "option_b": "Хранит пароли",
            "option_c": "Обнаруживает и блокирует вредоносное ПО",
            "option_d": "Шифрует видео",
            "correct_answer": "c",
            "question_text_kk": "Антивирус не істейді?",
            "option_a_kk": "Интернетті жылдамдатады",
            "option_b_kk": "Құпия сөздерді сақтайды",
            "option_c_kk": "Зиянды бағдарламаларды анықтайды және бұғаттайды",
            "option_d_kk": "Бейнені шифрлайды",
        },
        {
            "id": -2005,
            "question_text": "Что такое VPN в базовом понимании?",
            "option_a": "Видеоплеер",
            "option_b": "Защищенный туннель для сетевого трафика",
            "option_c": "Файловый архив",
            "option_d": "Тип процессора",
            "correct_answer": "b",
            "question_text_kk": "VPN деген не (негізгі түсінік)?",
            "option_a_kk": "Бейне ойнатқыш",
            "option_b_kk": "Желілік трафик үшін қорғалған туннель",
            "option_c_kk": "Файл мұрағаты",
            "option_d_kk": "Процессор түрі",
        },
        {
            "id": -2006,
            "question_text": "Как безопаснее всего получать программы?",
            "option_a": "Случайные форумы",
            "option_b": "Неофициальные репаки",
            "option_c": "Только из официальных источников",
            "option_d": "Из вложений письма",
            "correct_answer": "c",
            "question_text_kk": "Бағдарламаларды қалай алу қауіпсіз?",
            "option_a_kk": "Кездейсоқ форумдар",
            "option_b_kk": "Ресми емес репактар",
            "option_c_kk": "Тек ресми дереккөздерден",
            "option_d_kk": "Хат тіркемелерінен",
        },
        {
            "id": -2007,
            "question_text": "Что такое социальная инженерия?",
            "option_a": "Настройка роутера",
            "option_b": "Манипуляция людьми для получения доступа/данных",
            "option_c": "Создание резервной копии",
            "option_d": "Шифрование диска",
            "correct_answer": "b",
            "question_text_kk": "Әлеуметтік инженерия деген не?",
            "option_a_kk": "Роутер баптауы",
            "option_b_kk": "Қол жеткізу/дерек алу үшін адамдарды манипуляциялау",
            "option_c_kk": "Сақтық көшірме жасау",
            "option_d_kk": "Дискті шифрлау",
        },
        {
            "id": -2008,
            "question_text": "Почему важно обновлять ОС и приложения?",
            "option_a": "Только для нового дизайна",
            "option_b": "Обновления закрывают уязвимости безопасности",
            "option_c": "Чтобы удалить файлы",
            "option_d": "Чтобы отключить интернет",
            "correct_answer": "b",
            "question_text_kk": "ЖО мен бағдарламаларды жаңарту не үшін маңызды?",
            "option_a_kk": "Тек жаңа дизайн үшін",
            "option_b_kk": "Жаңартулар қауіпсіздік осалдықтарын жояды",
            "option_c_kk": "Файлдарды жою үшін",
            "option_d_kk": "Интернетті өшіру үшін",
        },
    ],
}


def _localize_local_classic_question(q: dict, lang: str | None) -> dict:
    """Возвращает копию вопроса с полями question_text/option_* для выбранной локали (kk или ru)."""
    loc = (lang or "ru").strip().lower()
    if loc == "kk":
        return {
            "id": q["id"],
            "correct_answer": q["correct_answer"],
            "question_text": q.get("question_text_kk") or q["question_text"],
            "option_a": q.get("option_a_kk") or q["option_a"],
            "option_b": q.get("option_b_kk") or q["option_b"],
            "option_c": q.get("option_c_kk") or q["option_c"],
            "option_d": q.get("option_d_kk") or q["option_d"],
        }
    return {
        "id": q["id"],
        "correct_answer": q["correct_answer"],
        "question_text": q["question_text"],
        "option_a": q["option_a"],
        "option_b": q["option_b"],
        "option_c": q["option_c"],
        "option_d": q["option_d"],
    }


def _get_local_track_questions(track: str, limit: int, ai_level: str = "intermediate") -> list[dict]:
    bank = LOCAL_CLASSIC_TRACK_QUESTIONS.get(track, [])
    if not bank:
        return []
    items = bank[:]
    if ai_level == "expert":
        items = list(reversed(items))
    elif ai_level == "intermediate":
        random.Random(42).shuffle(items)
    return items[:max(1, min(limit, len(items)))]


def _answer_text_from_question_like(q: TestQuestion | dict) -> str:
    if isinstance(q, dict):
        key = (q.get("correct_answer") or "a").strip().lower()
        return {"a": q.get("option_a"), "b": q.get("option_b"), "c": q.get("option_c"), "d": q.get("option_d")}.get(key, q.get("option_a") or "")
    return _get_answer_text(q)

# Классикалық режимдер үшін сұрақ қай курстан алынатыны (URLдағы course_id — тек навигация)
CLASSIC_TRACK_PYTHON = "python"
CLASSIC_TRACK_WEB = "web"
CLASSIC_TRACK_INFORMATICS = "informatics"
CLASSIC_TRACK_CYBERSECURITY = "cybersecurity"
CLASSIC_TRACKS = (
    CLASSIC_TRACK_PYTHON,
    CLASSIC_TRACK_WEB,
    CLASSIC_TRACK_INFORMATICS,
    CLASSIC_TRACK_CYBERSECURITY,
)
PYTHON_COURSE_TITLE = "Python программалау негіздері"
WEB_COURSE_TITLE = "Web-әзірлеу негіздері"
INFORMATICS_COURSE_TITLE = "Информатика және ақпараттық технологиялар негіздері"
# Резервті іздеу (атауы өзгертілген немесе басқа тілдегі БД)
_INFORMATICS_TITLE_ILIKE_PATTERNS = (
    "%информатика%",
    "%ақпараттық технология%",
    "%Информатика%",
)
_WEB_TITLE_ILIKE_PATTERNS = (
    "%Web-әзірлеу негіздері%",
    "%Web-әзірлеу%",
    "%Веб-разработка%",
    "%веб-разработка%",
    "%Web әзірлеу%",
)

CYBER_COURSE_TITLE = "Кибер қауіпсіздік негіздері"
_CYBER_TITLE_ILIKE_PATTERNS = (
    "%Кибер қауіпсіздік%",
    "%кибер%",
    "%қауіпсіздік%",
    "%cybersecurity%",
    "%кибербезопасност%",
)


def _course_has_nonfinal_topic_questions(db: Session, course_id: int) -> bool:
    """Курста topic-тесттерінде кем дегенде бір MCQ бар ма (AI challenge үшін)."""
    from app.models.test import Test

    row = (
        db.query(TestQuestion.id)
        .join(Test, TestQuestion.test_id == Test.id)
        .filter(
            Test.course_id == course_id,
            Test.is_final == 0,
            Test.topic_id.isnot(None),
        )
        .first()
    )
    return row is not None


def _resolve_web_content_course_id(db: Session, lang: str | None = "ru") -> int:
    """Курс Web с непустыми topic-тестами. Иначе HTTP 400 с пояснением."""
    if settings.AI_CHALLENGE_WEB_COURSE_ID is not None and settings.AI_CHALLENGE_WEB_COURSE_ID > 0:
        cid = int(settings.AI_CHALLENGE_WEB_COURSE_ID)
        c = db.query(Course).filter(Course.id == cid).first()
        if not c:
            raise HTTPException(
                status_code=400,
                detail=get_error_msg("web_not_found", lang),
            )
        if not _course_has_nonfinal_topic_questions(db, cid):
            raise HTTPException(status_code=400, detail=get_error_msg("web_no_questions", lang))
        return cid

    exact = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
    if exact and _course_has_nonfinal_topic_questions(db, exact.id):
        return exact.id

    q = db.query(Course).filter(
        or_(*[Course.title.ilike(p) for p in _WEB_TITLE_ILIKE_PATTERNS])
    )
    for c in q.order_by(Course.id).all():
        if _course_has_nonfinal_topic_questions(db, c.id):
            return c.id

    if exact:
        raise HTTPException(status_code=400, detail=get_error_msg("web_no_questions", lang))
    if db.query(Course).filter(or_(*[Course.title.ilike(p) for p in _WEB_TITLE_ILIKE_PATTERNS])).first():
        raise HTTPException(status_code=400, detail=get_error_msg("web_no_questions", lang))
    raise HTTPException(status_code=400, detail=get_error_msg("web_not_found", lang))


def _resolve_informatics_content_course_id(db: Session, lang: str | None = "ru") -> int:
    """Курс «Информатика» с непустыми topic-тестами (жалпы ИТ, не Python)."""
    if settings.AI_CHALLENGE_INFORMATICS_COURSE_ID is not None and settings.AI_CHALLENGE_INFORMATICS_COURSE_ID > 0:
        cid = int(settings.AI_CHALLENGE_INFORMATICS_COURSE_ID)
        c = db.query(Course).filter(Course.id == cid).first()
        if not c:
            raise HTTPException(
                status_code=400,
                detail=get_error_msg("informatics_not_found", lang),
            )
        if not _course_has_nonfinal_topic_questions(db, cid):
            raise HTTPException(status_code=400, detail=get_error_msg("informatics_no_questions", lang))
        return cid

    exact = db.query(Course).filter(Course.title == INFORMATICS_COURSE_TITLE).first()
    if exact and _course_has_nonfinal_topic_questions(db, exact.id):
        return exact.id

    q = db.query(Course).filter(
        or_(*[Course.title.ilike(p) for p in _INFORMATICS_TITLE_ILIKE_PATTERNS])
    )
    for c in q.order_by(Course.id).all():
        if _course_has_nonfinal_topic_questions(db, c.id):
            return c.id

    if exact:
        raise HTTPException(status_code=400, detail=get_error_msg("informatics_no_questions", lang))
    if db.query(Course).filter(or_(*[Course.title.ilike(p) for p in _INFORMATICS_TITLE_ILIKE_PATTERNS])).first():
        raise HTTPException(status_code=400, detail=get_error_msg("informatics_no_questions", lang))
    raise HTTPException(status_code=400, detail=get_error_msg("informatics_not_found", lang))


def _informatics_course_id_for_navigation(db: Session) -> int | None:
    """Сілтеме үшін course_id (тест сұрақтарының болуы міндетті емес)."""
    if settings.AI_CHALLENGE_INFORMATICS_COURSE_ID is not None and settings.AI_CHALLENGE_INFORMATICS_COURSE_ID > 0:
        cid = int(settings.AI_CHALLENGE_INFORMATICS_COURSE_ID)
        if db.query(Course.id).filter(Course.id == cid).first():
            return cid
        return None
    row = db.query(Course.id).filter(Course.title == INFORMATICS_COURSE_TITLE).first()
    if row:
        return row[0]
    c = (
        db.query(Course)
        .filter(or_(*[Course.title.ilike(p) for p in _INFORMATICS_TITLE_ILIKE_PATTERNS]))
        .order_by(Course.id)
        .first()
    )
    return c.id if c else None


def _resolve_cyber_content_course_id(db: Session, lang: str | None = "ru") -> int:
    """Курс кибербезопасности с непустыми topic-тестами."""
    if settings.AI_CHALLENGE_CYBER_COURSE_ID is not None and settings.AI_CHALLENGE_CYBER_COURSE_ID > 0:
        cid = int(settings.AI_CHALLENGE_CYBER_COURSE_ID)
        c = db.query(Course).filter(Course.id == cid).first()
        if not c:
            raise HTTPException(
                status_code=400,
                detail=get_error_msg("cyber_not_found", lang),
            )
        if not _course_has_nonfinal_topic_questions(db, cid):
            raise HTTPException(status_code=400, detail=get_error_msg("cyber_no_questions", lang))
        return cid

    exact = db.query(Course).filter(Course.title == CYBER_COURSE_TITLE).first()
    if exact and _course_has_nonfinal_topic_questions(db, exact.id):
        return exact.id

    q = db.query(Course).filter(
        or_(*[Course.title.ilike(p) for p in _CYBER_TITLE_ILIKE_PATTERNS])
    )
    for c in q.order_by(Course.id).all():
        if _course_has_nonfinal_topic_questions(db, c.id):
            return c.id

    if exact:
        raise HTTPException(status_code=400, detail=get_error_msg("cyber_no_questions", lang))
    if db.query(Course).filter(or_(*[Course.title.ilike(p) for p in _CYBER_TITLE_ILIKE_PATTERNS])).first():
        raise HTTPException(status_code=400, detail=get_error_msg("cyber_no_questions", lang))
    raise HTTPException(status_code=400, detail=get_error_msg("cyber_not_found", lang))


def _cyber_course_id_for_navigation(db: Session) -> int | None:
    """Сілтеме үшін course_id (тест сұрақтарының болуы міндетті емес)."""
    if settings.AI_CHALLENGE_CYBER_COURSE_ID is not None and settings.AI_CHALLENGE_CYBER_COURSE_ID > 0:
        cid = int(settings.AI_CHALLENGE_CYBER_COURSE_ID)
        if db.query(Course.id).filter(Course.id == cid).first():
            return cid
        return None
    row = db.query(Course.id).filter(Course.title == CYBER_COURSE_TITLE).first()
    if row:
        return row[0]
    c = (
        db.query(Course)
        .filter(or_(*[Course.title.ilike(p) for p in _CYBER_TITLE_ILIKE_PATTERNS]))
        .order_by(Course.id)
        .first()
    )
    return c.id if c else None


def _ai_challenge_anchor_course_id(db: Session) -> int:
    """course_id для AIChallenge при FK на courses: новые мини-игры не привязаны к курсу, но id=0 часто ломает FK."""
    row = db.query(Course.id).filter(Course.is_active == True).order_by(Course.id).first()
    if row:
        return row[0]
    row_any = db.query(Course.id).order_by(Course.id).first()
    if row_any:
        return row_any[0]
    return 1


def _resolve_main_courses(db: Session):
    """Canonical Python және Web курстары (seed бойынша атауы бойынша)."""
    py = db.query(Course).filter(Course.title == PYTHON_COURSE_TITLE).first()
    web = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
    if web is None:
        web = (
            db.query(Course)
            .filter(or_(*[Course.title.ilike(p) for p in _WEB_TITLE_ILIKE_PATTERNS]))
            .order_by(Course.id)
            .first()
        )
    return py, web


def _classic_content_course_ids(db: Session, classic_track: str | None, page_course_id: int, lang: str | None = "ru") -> list[int]:
    """quiz / flashcard / memory үшін сұрақтар алынатын course_id тізімі."""
    track = (classic_track or CLASSIC_TRACK_PYTHON).strip().lower()
    if track not in CLASSIC_TRACKS:
        track = CLASSIC_TRACK_PYTHON
    py, web = _resolve_main_courses(db)
    if track == CLASSIC_TRACK_WEB:
        return [_resolve_web_content_course_id(db, lang)]
    if track == CLASSIC_TRACK_INFORMATICS:
        return [_resolve_informatics_content_course_id(db, lang)]
    if track == CLASSIC_TRACK_CYBERSECURITY:
        return [_resolve_cyber_content_course_id(db, lang)]
    # python: URLдегі курс бойынша сұрақтар болса — сол курсты қолдану (атауы өзгерсе де / id сәйкес келмесе де)
    if _course_has_nonfinal_topic_questions(db, page_course_id):
        return [page_course_id]
    if py and _course_has_nonfinal_topic_questions(db, py.id):
        return [py.id]
    if py:
        return [py.id]
    return [page_course_id]


def _get_completed_topic_ids_for_courses(db: Session, user_id: int, course_ids: list[int]) -> list[int]:
    progs = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.course_id.in_(course_ids),
        StudentProgress.is_completed == True,
    ).all()
    return [p.topic_id for p in progs if p.topic_id]


def _get_all_topic_ids_for_courses(db: Session, course_ids: list[int]) -> list[int]:
    return [
        t.id
        for t in db.query(CourseTopic)
        .filter(CourseTopic.course_id.in_(course_ids))
        .order_by(CourseTopic.course_id, CourseTopic.order_number)
        .all()
    ]


def _calc_bonus_points(correct_sequence: list[bool]) -> int:
    """Бонусы: 2 подряд +1, 3 подряд +2, 4 подряд +3, 5 подряд +4."""
    total = 0
    streak = 0
    for c in correct_sequence:
        if c:
            streak += 1
            if streak >= 2:
                total += streak - 1
        else:
            streak = 0
    return total


def _calc_ai_win_coins(
    user_correct: int,
    total_questions: int,
    user_total_score: int,
    ai_total_score: int,
    user_time: float,
    ai_time: float,
) -> int:
    """
    Dynamic reward up to 200 coins for a win.
    Takes into account accuracy, score advantage, and speed advantage.
    """
    if total_questions <= 0:
        return 0

    accuracy_ratio = max(0.0, min(1.0, user_correct / total_questions))
    score_adv_ratio = 0.0
    if total_questions > 0:
        score_adv_ratio = max(0.0, min(1.0, (user_total_score - ai_total_score) / total_questions))

    speed_adv_ratio = 0.0
    if ai_time > 0 and user_time > 0:
        speed_adv_ratio = max(0.0, min(1.0, (ai_time - user_time) / ai_time))

    # Weighted reward: accuracy has the largest impact.
    coins = int(round(200 * (0.6 * accuracy_ratio + 0.25 * score_adv_ratio + 0.15 * speed_adv_ratio)))
    return max(1, min(200, coins))


class ChallengeStartResponse(BaseModel):
    challenge_id: int
    questions: list[dict]
    ai_times_per_question: list[float]
    round_time_limit_seconds: int
    ai_bonus_points: int


class ChallengeSubmitRequest(BaseModel):
    answers: list[dict]  # [{"question_id": int, "answer": str, "time_seconds": float}]


def _get_completed_topic_ids(db: Session, user_id: int, course_id: int) -> list[int]:
    progs = db.query(StudentProgress).filter(
        StudentProgress.user_id == user_id,
        StudentProgress.course_id == course_id,
        StudentProgress.is_completed == True,
    ).all()
    return [p.topic_id for p in progs if p.topic_id]


def _get_questions_from_topics(
    db: Session,
    course_id: int,
    topic_ids: list[int],
    limit: int = 5,
    ai_level: str = "intermediate",
) -> list:
    return _get_questions_from_topics_multi(db, [course_id], topic_ids, limit, ai_level)


def _get_questions_from_topics_multi(
    db: Session,
    course_ids: list[int],
    topic_ids: list[int],
    limit: int = 5,
    ai_level: str = "intermediate",
) -> list:
    from app.models.test import Test

    if not topic_ids or not course_ids:
        return []
    test_ids = db.query(Test.id).filter(
        Test.course_id.in_(course_ids),
        Test.topic_id.in_(topic_ids),
        Test.is_final == 0,
    ).distinct().all()
    test_ids = [t[0] for t in test_ids]
    if not test_ids:
        return []
    all_q = db.query(TestQuestion).filter(TestQuestion.test_id.in_(test_ids)).all()
    if len(all_q) <= limit:
        return all_q
    sorted_q = sorted(
        all_q,
        key=lambda q: (
            q.order_number is None,
            q.order_number or 0,
            q.id,
        ),
    )
    if ai_level == "beginner":
        return sorted_q[:limit]
    if ai_level == "expert":
        return list(reversed(sorted_q))[:limit]
    n = len(sorted_q)
    start = max(0, (n - limit) // 2)
    end = start + limit
    return sorted_q[start:end]


def _get_topic_ids_by_level(db: Session, course_id: int, base_topic_ids: list[int], ai_level: str) -> list[int]:
    """Фильтрует темы по уровню: beginner=первые ~33%, intermediate=средние ~34%, expert=последние ~33%."""
    if not base_topic_ids:
        return base_topic_ids
    topics = db.query(CourseTopic).filter(
        CourseTopic.id.in_(base_topic_ids),
        CourseTopic.course_id == course_id,
    ).order_by(CourseTopic.order_number).all()
    n = len(topics)
    if n <= 1:
        return base_topic_ids
    third = max(1, n // 3)
    if ai_level == "beginner":
        return [t.id for t in topics[:third]]
    if ai_level == "expert":
        return [t.id for t in topics[-third:]]
    # intermediate: middle band
    if n - 2 * third > 0:
        return [t.id for t in topics[third : n - third]]
    return base_topic_ids


def _get_topic_ids_by_level_multi(db: Session, course_ids: list[int], base_topic_ids: list[int], ai_level: str) -> list[int]:
    """Бірнеше курс темалары үшін деңгей бойынша іріктеу (course_id, order_number бойынша сұрыптау)."""
    if not base_topic_ids:
        return base_topic_ids
    topics = db.query(CourseTopic).filter(
        CourseTopic.id.in_(base_topic_ids),
        CourseTopic.course_id.in_(course_ids),
    ).order_by(CourseTopic.course_id, CourseTopic.order_number).all()
    n = len(topics)
    if n <= 1:
        return base_topic_ids
    third = max(1, n // 3)
    if ai_level == "beginner":
        return [t.id for t in topics[:third]]
    if ai_level == "expert":
        return [t.id for t in topics[-third:]]
    if n - 2 * third > 0:
        return [t.id for t in topics[third : n - third]]
    return base_topic_ids


def _get_all_topic_ids(db: Session, course_id: int) -> list[int]:
    return [t.id for t in db.query(CourseTopic).filter(CourseTopic.course_id == course_id).order_by(CourseTopic.order_number).all()]


GAME_MODES = ("quiz", "flashcard", "memory", "find_bug", "guess_output", "speed_code")
NEW_GAME_MODES = ("find_bug", "guess_output", "speed_code")


def _get_answer_text(q: TestQuestion) -> str:
    """Get the correct option text for flashcard back side."""
    key = (q.correct_answer or "a").strip().lower()
    return {"a": q.option_a, "b": q.option_b, "c": q.option_c, "d": q.option_d}.get(key, q.option_a)


class MemoryCardsResponse(BaseModel):
    cards: list[dict]


class ClassicHelpCourseIdResponse(BaseModel):
    course_id: int


@router.get("/classic-help-course-id", response_model=ClassicHelpCourseIdResponse)
def classic_help_course_id(
    classic_track: str | None = None,
    lang: str | None = "ru",
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    """Классикалық тректер үшін «курсқа өту» сілтемесінің нақты course_id (БД бойынша)."""
    t = (classic_track or CLASSIC_TRACK_PYTHON).strip().lower()
    if t not in CLASSIC_TRACKS:
        t = CLASSIC_TRACK_PYTHON
    if t == CLASSIC_TRACK_WEB:
        try:
            return ClassicHelpCourseIdResponse(course_id=_resolve_web_content_course_id(db, lang))
        except HTTPException:
            exact = db.query(Course).filter(Course.title == WEB_COURSE_TITLE).first()
            if exact:
                return ClassicHelpCourseIdResponse(course_id=exact.id)
            c = (
                db.query(Course)
                .filter(or_(*[Course.title.ilike(p) for p in _WEB_TITLE_ILIKE_PATTERNS]))
                .order_by(Course.id)
                .first()
            )
            if c:
                return ClassicHelpCourseIdResponse(course_id=c.id)
            raise HTTPException(status_code=404, detail=get_error_msg("web_not_found", lang))
    if t == CLASSIC_TRACK_INFORMATICS:
        cid = _informatics_course_id_for_navigation(db)
        if cid is None:
            raise HTTPException(status_code=404, detail=get_error_msg("informatics_not_found", lang))
        return ClassicHelpCourseIdResponse(course_id=cid)
    if t == CLASSIC_TRACK_CYBERSECURITY:
        cid = _cyber_course_id_for_navigation(db)
        if cid is None:
            raise HTTPException(status_code=404, detail=get_error_msg("cyber_not_found", lang))
        return ClassicHelpCourseIdResponse(course_id=cid)
    py, _ = _resolve_main_courses(db)
    if not py:
        raise HTTPException(status_code=404, detail=get_error_msg("python_not_found", lang))
    return ClassicHelpCourseIdResponse(course_id=py.id)


@router.get("/memory", response_model=MemoryCardsResponse)
def get_memory_cards(
    course_id: int,
    classic_track: str | None = None,
    lang: str | None = "ru",
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    norm_track = (classic_track or CLASSIC_TRACK_PYTHON).strip().lower()
    if norm_track not in CLASSIC_TRACKS:
        norm_track = CLASSIC_TRACK_PYTHON
    local_questions = _get_local_track_questions(norm_track, 4)
    if norm_track in (CLASSIC_TRACK_INFORMATICS, CLASSIC_TRACK_CYBERSECURITY) and len(local_questions) >= 4:
        cards: list[dict] = []
        for i, q in enumerate(local_questions[:4]):
            ql = _localize_local_classic_question(q, lang)
            qid, aid = f"q{i}", f"a{i}"
            cards.append({"id": qid, "text": ql["question_text"], "pair_id": aid})
            cards.append({"id": aid, "text": _answer_text_from_question_like(ql), "pair_id": qid})
        random.shuffle(cards)
        return MemoryCardsResponse(cards=cards)

    content_course_ids = _classic_content_course_ids(db, classic_track, course_id, lang)
    is_admin = current_user.role in ("admin", "director", "curator")
    if is_admin:
        base_topic_ids = _get_all_topic_ids_for_courses(db, content_course_ids)
    else:
        base_topic_ids = _get_completed_topic_ids_for_courses(db, current_user.id, content_course_ids)

    questions = _get_questions_from_topics_multi(db, content_course_ids, base_topic_ids, 4)
    # Memory: allow pairs from any topic test in the course (not only completed topics) so the game is playable.
    all_topic_ids = _get_all_topic_ids_for_courses(db, content_course_ids)
    if len(questions) < 4 and all_topic_ids:
        questions = _get_questions_from_topics_multi(db, content_course_ids, all_topic_ids, 4)
    if len(questions) < 4:
        if not all_topic_ids:
            if norm_track == CLASSIC_TRACK_WEB:
                raise HTTPException(status_code=400, detail=get_error_msg("memory_web", lang))
            if norm_track == CLASSIC_TRACK_INFORMATICS:
                raise HTTPException(status_code=400, detail=get_error_msg("memory_informatics", lang))
            if norm_track == CLASSIC_TRACK_CYBERSECURITY:
                raise HTTPException(
                    status_code=400,
                    detail=get_error_msg("memory_cybersecurity", lang),
                )
            raise HTTPException(status_code=400, detail=get_error_msg("memory_python", lang))
        raise HTTPException(status_code=400, detail=get_error_msg("memory_more_topics", lang))
    questions = questions[:4]
    cards: list[dict] = []
    for i, q in enumerate(questions):
        qid, aid = f"q{i}", f"a{i}"
        cards.append({"id": qid, "text": q.question_text, "pair_id": aid})
        cards.append({"id": aid, "text": _get_answer_text(q), "pair_id": qid})
    random.shuffle(cards)
    return MemoryCardsResponse(cards=cards)


@router.post("/start", response_model=ChallengeStartResponse)
def start_challenge(
    course_id: int,
    ai_level: str = "intermediate",
    game_mode: str = "quiz",
    classic_track: str | None = None,
    lang: str | None = "ru",
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    if ai_level not in AI_LEVELS:
        ai_level = "intermediate"
    if game_mode not in GAME_MODES or game_mode == "memory":
        game_mode = "quiz"
    norm_track = (classic_track or CLASSIC_TRACK_PYTHON).strip().lower()
    if norm_track not in CLASSIC_TRACKS:
        norm_track = CLASSIC_TRACK_PYTHON
    local_questions = _get_local_track_questions(norm_track, QUESTIONS_LIMIT_BY_LEVEL.get(ai_level, 7), ai_level)
    if norm_track in (CLASSIC_TRACK_INFORMATICS, CLASSIC_TRACK_CYBERSECURITY) and len(local_questions) >= MIN_QUESTIONS_TO_START:
        questions = local_questions
        effective_limit = len(questions)
        lo, hi = AI_TIME_RANGES[ai_level]
        ai_times = [round(random.uniform(lo, hi), 2) for _ in questions]
        ai_bonus = random.randint(0, 3)
        round_limit = ROUND_TIME_LIMIT_BY_LEVEL.get(ai_level, ROUND_TIME_LIMIT)
        local_answer_map = {str(q["id"]): (q.get("correct_answer") or "a").strip().lower() for q in questions}
        challenge = AIChallenge(
            user_id=current_user.id,
            course_id=course_id,
            ai_total_time=sum(ai_times),
            ai_correct_count=len(questions),
            user_total_time=0,
            user_correct_count=0,
            ai_level=ai_level,
            round_time_limit_seconds=round_limit,
            ai_bonus_points=ai_bonus,
            game_type=game_mode,
            ai_times_json=json.dumps({"times": ai_times, "local_answer_map": local_answer_map}),
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        loc_questions = [_localize_local_classic_question(q, lang) for q in questions]
        if game_mode == "flashcard":
            q_list = [
                {
                    "id": ql["id"],
                    "question_text": ql["question_text"],
                    "answer_text": _answer_text_from_question_like(ql),
                    "option_a": ql["option_a"],
                    "option_b": ql["option_b"],
                    "option_c": ql["option_c"],
                    "option_d": ql["option_d"],
                }
                for ql in loc_questions
            ]
        else:
            q_list = [
                {
                    "id": ql["id"],
                    "question_text": ql["question_text"],
                    "option_a": ql["option_a"],
                    "option_b": ql["option_b"],
                    "option_c": ql["option_c"],
                    "option_d": ql["option_d"],
                }
                for ql in loc_questions
            ]
        return ChallengeStartResponse(
            challenge_id=challenge.id,
            questions=q_list,
            ai_times_per_question=ai_times,
            round_time_limit_seconds=round_limit,
            ai_bonus_points=ai_bonus,
        )

    content_course_ids = _classic_content_course_ids(db, classic_track, course_id, lang)
    is_admin = current_user.role in ("admin", "director", "curator")
    if is_admin:
        base_topic_ids = _get_all_topic_ids_for_courses(db, content_course_ids)
    else:
        base_topic_ids = _get_completed_topic_ids_for_courses(db, current_user.id, content_course_ids)
    
    if len(content_course_ids) == 1:
        topic_ids = _get_topic_ids_by_level(db, content_course_ids[0], base_topic_ids, ai_level)
    else:
        topic_ids = _get_topic_ids_by_level_multi(db, content_course_ids, base_topic_ids, ai_level)
    limit = QUESTIONS_LIMIT_BY_LEVEL.get(ai_level, 7)
    questions = _get_questions_from_topics_multi(db, content_course_ids, topic_ids, limit, ai_level)
    if len(questions) < limit and topic_ids != base_topic_ids:
        questions = _get_questions_from_topics_multi(db, content_course_ids, base_topic_ids, limit, ai_level)
    # Егер деңгей бойынша таңдалған темаларда сұрақ аз болса — барлық қолжетімді темалардан
    # «бастаушы» сұрыптаумен қайта алу (орта деңгейдің ортаңғы бөлігі бос қалған жағдайлар үшін).
    available = len(questions)
    if available < MIN_QUESTIONS_TO_START and base_topic_ids:
        wider = _get_questions_from_topics_multi(db, content_course_ids, base_topic_ids, limit, "beginner")
        if len(wider) > available:
            questions = wider
            available = len(questions)
    # Если вопросов меньше, чем требуется уровнем — стартуем с доступным количеством,
    # но не ниже минимального порога (иначе игра теряет смысл).
    if available < MIN_QUESTIONS_TO_START:
        # Егер сұрақтар мүлдем жоқ болса (тіпті fallback-тен кейін) — нақтырақ хабарлама
        if not base_topic_ids:
            raise HTTPException(status_code=400, detail=get_error_msg("no_topics", lang))
        
        if norm_track == CLASSIC_TRACK_WEB:
            raise HTTPException(
                status_code=400,
                detail=get_error_msg("web_requirement", lang),
            )
        if norm_track == CLASSIC_TRACK_INFORMATICS:
            raise HTTPException(
                status_code=400,
                detail=get_error_msg("informatics_requirement", lang),
            )
        if norm_track == CLASSIC_TRACK_CYBERSECURITY:
            raise HTTPException(
                status_code=400,
                detail=get_error_msg("cybersecurity_requirement", lang),
            )
        raise HTTPException(
            status_code=400,
            detail=get_error_msg("python_requirement", lang),
        )
    effective_limit = min(limit, available)
    questions = questions[:effective_limit]
    # Get real AI results
    ai_results = solve_quiz_questions(
        questions=questions,
        ai_level=ai_level,
        lang=lang or "ru",
        game_mode=game_mode,
        db=db
    )
    
    ai_times = [r.get("thinking_time", 2.0) for r in ai_results]
    ai_correct_count = sum(1 for r in ai_results if r.get("is_correct"))
    # If the AI made a mistake, we need to know WHICH answer it picked if we ever want to show it.
    # For now, we store the local_answer_map as usual, but using AI's chosen answers.
    local_answer_map = {str(r.get("id")): (r.get("answer") or "a").strip().lower() for r in ai_results}
    
    ai_bonus = random.randint(0, 3) 
    round_limit = ROUND_TIME_LIMIT_BY_LEVEL.get(ai_level, ROUND_TIME_LIMIT)
    
    challenge = AIChallenge(
        user_id=current_user.id,
        course_id=course_id,
        ai_total_time=sum(ai_times),
        ai_correct_count=ai_correct_count,
        user_total_time=0,
        user_correct_count=0,
        ai_level=ai_level,
        round_time_limit_seconds=round_limit,
        ai_bonus_points=ai_bonus,
        game_type=game_mode,
        ai_times_json=json.dumps({"times": ai_times, "local_answer_map": local_answer_map}),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    if game_mode == "flashcard":
        q_list = [
            {
                "id": q.id,
                "question_text": q.question_text,
                "answer_text": _get_answer_text(q),
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
            }
            for q in questions
        ]
    else:
        q_list = [
            {"id": q.id, "question_text": q.question_text, "option_a": q.option_a, "option_b": q.option_b, "option_c": q.option_c, "option_d": q.option_d}
            for q in questions
        ]
    return ChallengeStartResponse(
        challenge_id=challenge.id,
        questions=q_list,
        ai_times_per_question=ai_times,
        round_time_limit_seconds=round_limit,
        ai_bonus_points=ai_bonus,
    )


@router.post("/{challenge_id}/submit")
def submit_challenge(
    challenge_id: int,
    body: ChallengeSubmitRequest,
    lang: str | None = "ru",
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    from app.models.test import Test
    from datetime import datetime, timezone

    challenge = db.query(AIChallenge).filter(
        AIChallenge.id == challenge_id,
        AIChallenge.user_id == current_user.id,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail=get_error_msg("challenge_not_found", lang))

    n_q = len(body.answers) if body.answers else 0

    game_type = (challenge.game_type or "quiz").strip().lower()
    is_flashcard = game_type == "flashcard"

    if is_flashcard:
        ai_times = []
        local_answer_map: dict[str, str] = {}
        try:
            parsed_ai_payload = json.loads(challenge.ai_times_json or "[]")
            if isinstance(parsed_ai_payload, dict):
                ai_times = parsed_ai_payload.get("times", []) or []
                local_answer_map = {
                    str(k): str(v).strip().lower()
                    for k, v in (parsed_ai_payload.get("local_answer_map", {}) or {}).items()
                }
            elif isinstance(parsed_ai_payload, list):
                ai_times = parsed_ai_payload
        except (json.JSONDecodeError, TypeError):
            ai_times = []
        if len(ai_times) < len(body.answers):
            ai_times = ai_times + [3.0] * (len(body.answers) - len(ai_times))
        ai_times = ai_times[: len(body.answers)]

        user_correct = 0
        user_time = 0.0
        correct_sequence: list[bool] = []
        wrong_question_ids: list[int] = []
        q_ids = [a["question_id"] for a in body.answers]
        flash_questions = db.query(TestQuestion).filter(TestQuestion.id.in_(q_ids)).all()
        q_by_id = {q.id: q for q in flash_questions}
        for i, a in enumerate(body.answers):
            q = q_by_id.get(a["question_id"])
            answer_key = (a.get("answer") or "").strip().lower()
            if q:
                correct = q.correct_answer.strip().lower() == answer_key
            else:
                correct = local_answer_map.get(str(a["question_id"])) == answer_key
            user_t = float(a.get("time_seconds") or 999.0)
            ai_t = float(ai_times[i]) if i < len(ai_times) else 999.0
            user_wins = correct and user_t < ai_t
            if user_wins:
                user_correct += 1
                correct_sequence.append(True)
            else:
                wrong_question_ids.append(a["question_id"])
                correct_sequence.append(False)
            user_time += user_t
        ai_correct_count = len(body.answers) - user_correct
        user_bonus = _calc_bonus_points(correct_sequence)
        overtime = False
    else:
        local_answer_map: dict[str, str] = {}
        try:
            parsed_ai_payload = json.loads(challenge.ai_times_json or "[]")
            if isinstance(parsed_ai_payload, dict):
                local_answer_map = {
                    str(k): str(v).strip().lower()
                    for k, v in (parsed_ai_payload.get("local_answer_map", {}) or {}).items()
                }
        except (json.JSONDecodeError, TypeError):
            local_answer_map = {}
        q_ids = [a["question_id"] for a in body.answers]
        questions = db.query(TestQuestion).filter(TestQuestion.id.in_(q_ids)).all()
        q_by_id = {q.id: q for q in questions}
        user_correct = 0
        user_time = 0.0
        correct_sequence: list[bool] = []
        wrong_question_ids: list[int] = []
        for a in body.answers:
            q = q_by_id.get(a["question_id"])
            answer_key = (a.get("answer") or "").strip().lower()
            if q:
                correct = q.correct_answer.strip().lower() == answer_key
            else:
                correct = local_answer_map.get(str(a["question_id"])) == answer_key
            if correct:
                user_correct += 1
            else:
                wrong_question_ids.append(a["question_id"])
            correct_sequence.append(correct)
            user_time += float(a.get("time_seconds") or 0)
        ai_correct_count = challenge.ai_correct_count or 0
        user_bonus = _calc_bonus_points(correct_sequence)
        limit = challenge.round_time_limit_seconds or ROUND_TIME_LIMIT
        overtime = user_time > limit

    limit = challenge.round_time_limit_seconds or ROUND_TIME_LIMIT
    if is_flashcard:
        limit = ROUND_TIME_LIMIT
        overtime = False
        challenge.ai_correct_count = ai_correct_count

    user_total_score = user_correct + user_bonus
    ai_total_score = (challenge.ai_correct_count or 0) + (challenge.ai_bonus_points or 0)

    challenge.user_correct_count = user_correct
    challenge.user_total_time = user_time
    challenge.user_bonus_points = user_bonus
    challenge.completed_at = datetime.now(timezone.utc)

    recommendations = ""
    wrong_topics_for_links: list[dict] = []
    if wrong_question_ids:
        wrong_questions = db.query(TestQuestion).filter(TestQuestion.id.in_(wrong_question_ids)).all()
        test_ids = [q.test_id for q in wrong_questions]
        tests = db.query(Test).filter(Test.id.in_(test_ids)).all()
        topic_ids = [t.topic_id for t in tests if t.topic_id]
        topics = db.query(CourseTopic).filter(CourseTopic.id.in_(topic_ids)).all() if topic_ids else []
        topic_titles = list({t.title for t in topics})
        seen_ids: set[int] = set()
        wrong_topics_for_links = []
        for t in topics:
            if t.id not in seen_ids:
                seen_ids.add(t.id)
                wrong_topics_for_links.append({"id": t.id, "title": t.title})
        course = db.query(Course).filter(Course.id == challenge.course_id).first()
        course_title = course.title if course else "Курс"
        recommendations = get_challenge_recommendations(topic_titles, course_title, lang=lang or "ru")
        challenge.recommendations = recommendations

    # Coins за победу в AI vs Student: dynamic reward up to 200
    from app.services.coins import add_coins, has_received_coins_for_reason

    if not (challenge.coins_awarded or 0):
        user_wins = not overtime and (
            user_total_score > ai_total_score
            or (user_total_score == ai_total_score and user_time < float(challenge.ai_total_time or 0))
        )
        if user_wins:
            coins_amount = _calc_ai_win_coins(
                user_correct=user_correct,
                total_questions=n_q,
                user_total_score=user_total_score,
                ai_total_score=ai_total_score,
                user_time=user_time,
                ai_time=float(challenge.ai_total_time or 0),
            )
            add_coins(db, current_user.id, coins_amount, f"ai_challenge_{challenge.id}")
            challenge.coins_awarded = 1

    if n_q > 0 and user_correct == n_q:
        perfect_reason = f"ai_challenge_perfect_{challenge.id}"
        if not has_received_coins_for_reason(db, current_user.id, perfect_reason):
            add_coins(db, current_user.id, 50, perfect_reason)
            db.commit() # Commit immediately after adding coins to ensure it's saved even if later parts fail

    n = Notification(
        user_id=current_user.id,
        type="ai_challenge_result",
        title=get_error_msg("notif_title_classic", lang),
        message=get_error_msg(
            "notif_message_classic",
            lang,
            user_correct=user_correct,
            ai_correct=challenge.ai_correct_count,
            total=n_q,
            user_time=user_time,
            ai_time=float(challenge.ai_total_time or 0),
        ),
        link=f"/app/ai-challenge/{challenge.course_id}",
    )
    db.add(n)
    db.commit()

    user_wins = not overtime and (
        user_total_score > ai_total_score
        or (user_total_score == ai_total_score and user_time < float(challenge.ai_total_time or 0))
    )

    avg_time = user_time / n_q if n_q else 0
    accuracy_pct = (user_correct / n_q * 100) if n_q else 0
    ai_n = challenge.ai_correct_count or 0
    ai_time = float(challenge.ai_total_time or 0)
    ai_avg = ai_time / n_q if n_q else 0
    ai_accuracy = (ai_n / n_q * 100) if n_q else 0

    return {
        "total_questions": n_q,
        "user_correct": user_correct,
        "ai_correct": challenge.ai_correct_count,
        "user_time": user_time,
        "ai_time": ai_time,
        "user_bonus_points": user_bonus,
        "ai_bonus_points": challenge.ai_bonus_points or 0,
        "user_total_score": user_total_score,
        "ai_total_score": ai_total_score,
        "user_wins": user_wins,
        "overtime": overtime,
        "recommendations": recommendations,
        "round_time_limit": limit,
        "wrong_topics": wrong_topics_for_links,
        "metrics": {
            "user_speed_avg_sec": round(avg_time, 2),
            "user_accuracy_pct": round(accuracy_pct, 1),
            "user_strategy_bonus": user_bonus,
            "ai_speed_avg_sec": round(ai_avg, 2),
            "ai_accuracy_pct": round(ai_accuracy, 1),
            "ai_strategy_bonus": challenge.ai_bonus_points or 0,
        },
    }


# ──────────────────────────────────────────────────
# NEW GAME MODES: Find Bug, Guess Output, Speed Code
# ──────────────────────────────────────────────────

NEW_MODE_QUESTIONS_LIMIT = {
    "beginner": 4,
    "intermediate": 6,
    "expert": 8,
}
NEW_MODE_TIME_LIMIT = {
    "beginner": 120,
    "intermediate": 100,
    "expert": 80,
}


@router.get("/categories")
def get_challenge_categories_list(
    lang: str | None = "ru",
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    """Список доступных категорий вопросов для новых мини-игр."""
    locale = lang if lang in ("ru", "kk", "en") else "ru"
    return [
        {"id": cat, "label": CATEGORY_LABELS.get(cat, {}).get(locale, cat)}
        for cat in CHALLENGE_CATEGORIES
    ]


@router.post("/new-game/start")
def start_new_mode_challenge(
    game_mode: str,
    ai_level: str = "intermediate",
    category: str | None = None,
    lang: str | None = "ru",
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    """Начать игру в одном из новых режимов: find_bug, guess_output, speed_code."""
    if game_mode not in NEW_GAME_MODES:
        raise HTTPException(status_code=400, detail=get_error_msg("unknown_mode", lang, mode=game_mode))
    if ai_level not in AI_LEVELS:
        ai_level = "intermediate"

    limit = NEW_MODE_QUESTIONS_LIMIT.get(ai_level, 6)
    time_limit = NEW_MODE_TIME_LIMIT.get(ai_level, 100)
    questions = get_questions_by_mode(game_mode, category=category, level=ai_level, limit=limit)

    if len(questions) < 3:
        # Fallback: попробуем без фильтра по категории
        questions = get_questions_by_mode(game_mode, category=None, level=ai_level, limit=limit)
    if len(questions) < 3:
        # Fallback: попробуем без фильтра по уровню
        questions = get_questions_by_mode(game_mode, category=category, level=None, limit=limit)
    if len(questions) < 2:
        raise HTTPException(status_code=400, detail=get_error_msg("not_enough_questions", lang))

    # Get real AI results
    ai_results = solve_quiz_questions(
        questions=questions,
        ai_level=ai_level,
        lang=lang or "ru",
        game_mode=game_mode,
        db=db
    )
    
    ai_times = [r.get("thinking_time", 2.0) for r in ai_results]
    ai_correct = sum(1 for r in ai_results if r.get("is_correct"))
    local_answer_map = {str(r.get("id")): (r.get("answer") or "a").strip().lower() for r in ai_results}

    anchor_cid = _ai_challenge_anchor_course_id(db)
    challenge = AIChallenge(
        user_id=current_user.id,
        course_id=anchor_cid,
        ai_total_time=sum(ai_times),
        ai_correct_count=ai_correct,
        user_total_time=0,
        user_correct_count=0,
        ai_level=ai_level,
        round_time_limit_seconds=time_limit,
        ai_bonus_points=random.randint(0, 2),
        game_type=game_mode,
        ai_times_json=json.dumps({"times": ai_times, "local_answer_map": local_answer_map}),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # Format questions for frontend
    formatted = []
    locale = lang if lang in ("ru", "kk", "en") else "ru"
    for q in questions:
        item = {"id": q["id"], "category": q.get("category", ""), "level": q.get("level", "")}
        if game_mode == "find_bug":
            item["code"] = q["code"]
            item["total_lines"] = len(q["code"].split("\n"))
        elif game_mode == "guess_output":
            item["code"] = q["code"]
            item["options"] = q["options"]
        elif game_mode == "speed_code":
            if locale == "kk" and "task_kk" in q:
                item["task"] = q["task_kk"]
            elif locale == "en" and "task_en" in q:
                item["task"] = q["task_en"]
            else:
                item["task"] = q["task"]
            item["options"] = q["options"]
        formatted.append(item)

    return {
        "challenge_id": challenge.id,
        "game_mode": game_mode,
        "questions": formatted,
        "ai_times_per_question": ai_times,
        "round_time_limit_seconds": time_limit,
        "ai_correct_count": ai_correct,
        "ai_bonus_points": challenge.ai_bonus_points,
        "total_questions": len(formatted),
    }


class NewModeSubmitRequest(BaseModel):
    answers: list[dict]  # [{"question_id": str, "answer": str, "time_seconds": float}]


@router.post("/new-game/{challenge_id}/submit")
def submit_new_mode_challenge(
    challenge_id: int,
    body: NewModeSubmitRequest,
    lang: str | None = "ru",
    db: Annotated[Session, Depends(get_db)] = ...,
    current_user: Annotated[User, Depends(get_current_user)] = ...,
):
    """Submit ответы для новых мини-игр (find_bug, guess_output, speed_code)."""
    from datetime import datetime, timezone

    challenge = db.query(AIChallenge).filter(
        AIChallenge.id == challenge_id,
        AIChallenge.user_id == current_user.id,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail=get_error_msg("challenge_not_found", lang))

    game_type = (challenge.game_type or "").strip().lower()
    if game_type not in NEW_GAME_MODES:
        raise HTTPException(status_code=400, detail=get_error_msg("new_modes_only", lang))

    # Load questions for verification
    all_questions = get_questions_by_mode(game_type, limit=200)
    q_by_id = {q["id"]: q for q in all_questions}

    user_correct = 0
    user_time = 0.0
    correct_sequence: list[bool] = []
    details: list[dict] = []

    for a in body.answers:
        qid = a.get("question_id", "")
        user_answer = (a.get("answer") or "").strip()
        t = float(a.get("time_seconds") or 0)
        user_time += t

        q = q_by_id.get(qid)
        if not q:
            correct_sequence.append(False)
            details.append({"question_id": qid, "correct": False, "user_answer": user_answer})
            continue

        is_correct = False
        correct_answer = ""
        explanation = ""

        if game_type == "find_bug":
            correct_line = str(q.get("bug_line", ""))
            is_correct = user_answer == correct_line
            correct_answer = correct_line
            explanation = _get_localized_field(q, "explanation", lang)
        elif game_type == "guess_output":
            correct_key = q.get("correct", "a").strip().lower()
            is_correct = user_answer.strip().lower() == correct_key
            correct_answer = correct_key
        elif game_type == "speed_code":
            correct_key = q.get("correct", "a").strip().lower()
            is_correct = user_answer.strip().lower() == correct_key
            correct_answer = correct_key

        if is_correct:
            user_correct += 1
        correct_sequence.append(is_correct)
        detail = {
            "question_id": qid,
            "correct": is_correct,
            "user_answer": user_answer,
            "correct_answer": correct_answer,
        }
        if explanation:
            detail["explanation"] = explanation
            detail["explanation_by_lang"] = {
                "ru": q.get("explanation", ""),
                "kk": q.get("explanation_kk") or q.get("explanation", ""),
                "en": q.get("explanation_en") or q.get("explanation", ""),
            }
        details.append(detail)

    n_q = len(body.answers) if body.answers else 0
    user_bonus = _calc_bonus_points(correct_sequence)
    user_total_score = user_correct + user_bonus
    ai_total_score = (challenge.ai_correct_count or 0) + (challenge.ai_bonus_points or 0)

    time_limit = challenge.round_time_limit_seconds or 100
    overtime = user_time > time_limit

    user_wins = not overtime and (
        user_total_score > ai_total_score
        or (user_total_score == ai_total_score and user_time < float(challenge.ai_total_time or 0))
    )

    challenge.user_correct_count = user_correct
    challenge.user_total_time = user_time
    challenge.user_bonus_points = user_bonus
    challenge.completed_at = datetime.now(timezone.utc)

    from app.services.coins import add_coins, has_received_coins_for_reason

    # Coins за победу: dynamic reward up to 200
    if not (challenge.coins_awarded or 0):
        if user_wins:
            coins_amount = _calc_ai_win_coins(
                user_correct=user_correct,
                total_questions=n_q,
                user_total_score=user_total_score,
                ai_total_score=ai_total_score,
                user_time=user_time,
                ai_time=float(challenge.ai_total_time or 0),
            )
            add_coins(db, current_user.id, coins_amount, f"ai_challenge_{challenge.id}")
            challenge.coins_awarded = 1

    if n_q > 0 and user_correct == n_q:
        perfect_reason = f"ai_challenge_perfect_{challenge.id}"
        if not has_received_coins_for_reason(db, current_user.id, perfect_reason):
            add_coins(db, current_user.id, 50, perfect_reason)
            db.commit() # Commit immediately after adding coins

    # Notification
    mode_label = get_error_msg(game_type, lang)
    n = Notification(
        user_id=current_user.id,
        type="ai_challenge_result",
        title=get_error_msg("notif_title_new", lang, mode=mode_label),
        message=get_error_msg(
            "notif_message_new",
            lang,
            user_correct=user_correct,
            ai_correct=challenge.ai_correct_count,
            total=n_q,
        ),
        link=f"/app/ai-challenge/{challenge.course_id}",
    )
    db.add(n)
    db.commit()

    avg_time = user_time / n_q if n_q else 0
    accuracy_pct = (user_correct / n_q * 100) if n_q else 0
    ai_n = challenge.ai_correct_count or 0
    ai_time = float(challenge.ai_total_time or 0)
    ai_avg = ai_time / n_q if n_q else 0
    ai_accuracy = (ai_n / n_q * 100) if n_q else 0

    return {
        "total_questions": n_q,
        "user_correct": user_correct,
        "ai_correct": challenge.ai_correct_count,
        "user_time": user_time,
        "ai_time": ai_time,
        "user_bonus_points": user_bonus,
        "ai_bonus_points": challenge.ai_bonus_points or 0,
        "user_total_score": user_total_score,
        "ai_total_score": ai_total_score,
        "user_wins": user_wins,
        "overtime": overtime,
        "round_time_limit": time_limit,
        "details": details,
        "metrics": {
            "user_speed_avg_sec": round(avg_time, 2),
            "user_accuracy_pct": round(accuracy_pct, 1),
            "user_strategy_bonus": user_bonus,
            "ai_speed_avg_sec": round(ai_avg, 2),
            "ai_accuracy_pct": round(ai_accuracy, 1),
            "ai_strategy_bonus": challenge.ai_bonus_points or 0,
        },
    }
