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

AI_CHALLENGE_TRANSLATIONS = {
    "ru": {
        "recommendations_fallback": "Рекомендуем повторить темы: {topics}.",
        "ai_prompt": "Студент прошёл соревнование AI vs Студент по курсу «{course}» и ошибся в темах: {topics}.\nДай краткие рекомендации (2-3 предложения на русском языке): что повторить, на что обратить внимание. Без приветствий и общих фраз.",
    },
    "kk": {
        "recommendations_fallback": "Келесі тақырыптарды қайталауды ұсынамыз: {topics}.",
        "ai_prompt": "Студент «{course}» курсы бойынша AI vs Студент жарысынан өтіп, келесі тақырыптардан қателесті: {topics}.\nҚысқаша ұсыныстар беріңіз (қазақ тілінде 2-3 сөйлем): нені қайталау керек, неге назар аудару керек. Сәлемдесусіз және жалпы фразаларсыз.",
    },
    "en": {
        "recommendations_fallback": "We recommend reviewing the following topics: {topics}.",
        "ai_prompt": "The student completed the AI vs Student challenge for the course \"{course}\" and made mistakes in the following topics: {topics}.\nGive brief recommendations (2-3 sentences in English): what to review, what to pay attention to. No greetings or generic phrases.",
    },
}


def get_email_translation(key: str, lang: str = "ru", **kwargs) -> str:
    """Get translated email text. Defaults to Russian if language not found."""
    translations = EMAIL_TRANSLATIONS.get(lang, EMAIL_TRANSLATIONS["ru"])
    text = translations.get(key, "")
    if kwargs:
        text = text.format(**kwargs)
    return text
