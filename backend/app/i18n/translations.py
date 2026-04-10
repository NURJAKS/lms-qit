"""
Translation dictionary for backend email and SMS notifications.
Supports: ru, kk, en
"""

EMAIL_TRANSLATIONS = {
    "ru": {
        "platform_brand": "Qazaq IT Academy",
        "purchase_pending_subject": "Подтвердите покупку курса «{course}»",
        "purchase_pending_greeting": "Здравствуйте, {name}!",
        "purchase_pending_body1": "Вы оплатили курс",
        "purchase_pending_body2": "Для завершения покупки, пожалуйста, подтвердите её, нажав на кнопку ниже:",
        "purchase_pending_button": "Подтвердить покупку",
        "purchase_pending_link_hint": "Если кнопка не работает, скопируйте эту ссылку в браузер:",
        "parent_credentials_title": "Данные для родителя",
        "course_purchased_subject": "Поздравляем! Вы добавлены на курс «{course}»",
        "course_purchased_greeting": "Поздравляем, {name}!",
        "course_purchased_body": "Вы успешно добавлены на курс",
        "course_purchased_good_luck": "Удачи в обучении!",
        "login_credentials": "Данные для входа:",
        "login": "Логин:",
        "password": "Пароль:",
        "go_to_cabinet": "Войти в кабинет",
        "platform_tagline": "Qazaq IT Academy — образовательная платформа",
        "default_parent_display_name": "Родитель",
    },
    "kk": {
        "platform_brand": "Qazaq IT Academy",
        "purchase_pending_subject": "Курс сатып алуды растаңыз «{course}»",
        "purchase_pending_greeting": "Сәлем, {name}!",
        "purchase_pending_body1": "Сіз курс төледіңіз",
        "purchase_pending_body2": "Сатып алуды аяқтау үшін төмендегі түймені басу арқылы растаңыз:",
        "purchase_pending_button": "Сатып алуды растау",
        "purchase_pending_link_hint": "Егер түйме жұмыс істемесе, осы сілтемені браузерге көшіріңіз:",
        "parent_credentials_title": "Ата-ана үшін деректер",
        "course_purchased_subject": "Құттықтаймыз! Сіз «{course}» курсына қосылдыңыз",
        "course_purchased_greeting": "Құттықтаймыз, {name}!",
        "course_purchased_body": "Сіз курсқа сәтті қосылдыңыз",
        "course_purchased_good_luck": "Оқуда сәттілік!",
        "login_credentials": "Кіру деректері:",
        "login": "Логин:",
        "password": "Құпия сөз:",
        "go_to_cabinet": "Кабинетке кіру",
        "platform_tagline": "Qazaq IT Academy — білім беру платформасы",
        "default_parent_display_name": "Ата-ана",
    },
    "en": {
        "platform_brand": "Qazaq IT Academy",
        "purchase_pending_subject": "Confirm course purchase «{course}»",
        "purchase_pending_greeting": "Hello, {name}!",
        "purchase_pending_body1": "You have paid for the course",
        "purchase_pending_body2": "To complete the purchase, please confirm it by clicking the button below:",
        "purchase_pending_button": "Confirm purchase",
        "purchase_pending_link_hint": "If the button does not work, copy this link to your browser:",
        "parent_credentials_title": "Parent login details",
        "course_purchased_subject": "Congratulations! You have been added to the course «{course}»",
        "course_purchased_greeting": "Congratulations, {name}!",
        "course_purchased_body": "You have been successfully added to the course",
        "course_purchased_good_luck": "Good luck with your studies!",
        "login_credentials": "Login credentials:",
        "login": "Login:",
        "password": "Password:",
        "go_to_cabinet": "Go to cabinet",
        "platform_tagline": "Qazaq IT Academy — educational platform",
        "default_parent_display_name": "Parent",
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


def get_email_translation(key: str, lang: str = "kk", **kwargs) -> str:
    """Get translated email text. Defaults to Kazakh, then Russian."""
    lang = lang if lang in EMAIL_TRANSLATIONS else "kk"
    translations = EMAIL_TRANSLATIONS[lang]
    text = translations.get(key) or EMAIL_TRANSLATIONS["kk"].get(key) or EMAIL_TRANSLATIONS["ru"].get(key, "")
    if kwargs:
        text = text.format(**kwargs)
    return text


def resolve_email_lang(user) -> str:
    """
    ru | kk | en from User.interface_language (Русский / Казахский / Английский).
    По умолчанию kk — основной язык платформы.
    """
    if user is None:
        return "kk"
    raw = getattr(user, "interface_language", None)
    if not raw or not str(raw).strip():
        return "kk"
    s = str(raw).strip().lower()
    if "азах" in s or s == "kk":
        return "kk"
    if "англ" in s or "english" in s or s == "en":
        return "en"
    if "усск" in s or s == "ru":
        return "ru"
    return "kk"
