from __future__ import annotations

import smtplib
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings
from app.i18n.translations import get_email_translation


def _get_smtp_client() -> Optional[smtplib.SMTP]:
  """
  Возвращает SMTP‑клиент, если в окружении заданы настройки.

  Ожидаемые переменные в .env (опционально):
  - SMTP_HOST
  - SMTP_PORT (int)
  - SMTP_USER
  - SMTP_PASSWORD
  - SMTP_USE_TLS (bool, по умолчанию True)
  """
  host = getattr(settings, "SMTP_HOST", None)
  port = int(getattr(settings, "SMTP_PORT", 587) or 587)
  user = getattr(settings, "SMTP_USER", None)
  password = getattr(settings, "SMTP_PASSWORD", None)
  use_tls = getattr(settings, "SMTP_USE_TLS", True)

  if not host or not user or not password:
    return None

  client = smtplib.SMTP(host, port, timeout=10)
  try:
    if use_tls:
      client.starttls()
    client.login(user, password)
  except Exception:
    client.quit()
    return None
  return client


def _send_html_email(to_email: str, subject: str, html_body: str) -> None:
  client = _get_smtp_client()
  if not client:
    return

  from_addr = getattr(settings, "SMTP_FROM", getattr(settings, "SMTP_USER", "no-reply@example.com"))

  msg = MIMEMultipart("alternative")
  msg["Subject"] = subject
  msg["From"] = f'"Qazaq IT Academy" <{from_addr}>'
  msg["To"] = to_email
  msg.attach(MIMEText(html_body, "html", "utf-8"))

  try:
    client.send_message(msg)
  except Exception:
    pass
  finally:
    try:
      client.quit()
    except Exception:
      pass


def send_course_purchase_email(
  to_email: str,
  student_name: str,
  course_title: str,
  temp_login: str,
  temp_password: str,
  lang: str = "ru",
) -> None:
  """
  Отправляет письмо с поздравлением и логином/паролем после подтверждения покупки.
  Поддерживает языки: ru, kk, en
  """
  subject = get_email_translation("course_purchased_subject", lang, course=course_title)
  greeting = get_email_translation("course_purchased_greeting", lang, name=student_name)
  body = get_email_translation("course_purchased_body", lang)
  good_luck = get_email_translation("course_purchased_good_luck", lang)
  login_credentials = get_email_translation("login_credentials", lang)
  login_label = get_email_translation("login", lang)
  password_label = get_email_translation("password", lang)
  go_to_cabinet = get_email_translation("go_to_cabinet", lang)
  platform_tagline = get_email_translation("platform_tagline", lang)
  
  html = f"""
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #FF4181, #1a237e); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Qazaq IT Academy</h1>
    </div>
    <div style="padding: 32px; color: #E2E8F0;">
      <h2 style="color: #10B981; margin-top: 0;">{greeting}</h2>
      <p style="font-size: 16px; line-height: 1.6;">
        {body} <strong style="color: #60A5FA;">«{course_title}»</strong>. {good_luck}
      </p>
      <div style="background: #1E293B; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #334155;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: white;">{login_credentials}</p>
        <p style="margin: 4px 0; color: #94A3B8;">{login_label} <strong style="color: #60A5FA;">{temp_login}</strong></p>
        <p style="margin: 4px 0; color: #94A3B8;">{password_label} <strong style="color: #60A5FA;">{temp_password}</strong></p>
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <a href="http://localhost:3000/login" style="background: linear-gradient(135deg, #FF4181, #1a237e); color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">{go_to_cabinet}</a>
      </div>
      <p style="color: #64748B; font-size: 13px; margin-top: 32px; text-align: center;">
        {platform_tagline}
      </p>
    </div>
  </div>
  """
  _send_html_email(to_email, subject, html)

