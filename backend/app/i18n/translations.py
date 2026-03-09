"""
Translation dictionary for backend email and SMS notifications.
Supports: ru, kk, en
"""

EMAIL_TRANSLATIONS = {
    "ru": {
        "course_purchased_subject": "Поздравляем! Вы добавлены на курс «{course}»",
        "course_purchased_greeting": "Поздравляем, {name}!",
        "course_purchased_body": "Вы успешно добавлены на курс",
        "course_purchased_good_luck": "Удачи в обучении!",
        "login_credentials": "Данные для входа:",
        "login": "Логин:",
        "password": "Пароль:",
        "go_to_cabinet": "Войти в кабинет",
        "platform_tagline": "Qazaq IT Academy — образовательная платформа",
    },
    "kk": {
        "course_purchased_subject": "Құттықтаймыз! Сіз курска қосылдыңыз «{course}»",
        "course_purchased_greeting": "Құттықтаймыз, {name}!",
        "course_purchased_body": "Сіз сәтті курска қосылдыңыз",
        "course_purchased_good_luck": "Оқуда сәттілік!",
        "login_credentials": "Кіру деректері:",
        "login": "Логин:",
        "password": "Құпия сөз:",
        "go_to_cabinet": "Кабинетке кіру",
        "platform_tagline": "Qazaq IT Academy — білім беру платформасы",
    },
    "en": {
        "course_purchased_subject": "Congratulations! You have been added to the course «{course}»",
        "course_purchased_greeting": "Congratulations, {name}!",
        "course_purchased_body": "You have been successfully added to the course",
        "course_purchased_good_luck": "Good luck with your studies!",
        "login_credentials": "Login credentials:",
        "login": "Login:",
        "password": "Password:",
        "go_to_cabinet": "Go to cabinet",
        "platform_tagline": "Qazaq IT Academy — educational platform",
    },
}


def get_email_translation(key: str, lang: str = "ru", **kwargs) -> str:
    """Get translated email text. Defaults to Russian if language not found."""
    translations = EMAIL_TRANSLATIONS.get(lang, EMAIL_TRANSLATIONS["ru"])
    text = translations.get(key, "")
    if kwargs:
        text = text.format(**kwargs)
    return text
