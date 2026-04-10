from __future__ import annotations

import smtplib
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


def _frontend_base_url() -> str:
  return (getattr(settings, "FRONTEND_PUBLIC_URL", None) or "http://localhost:3000").rstrip("/")


def _platform_from_header(lang: str) -> str:
  return get_email_translation("platform_brand", lang)


def _send_html_email(to_email: str, subject: str, html_body: str) -> None:
  client = _get_smtp_client()
  if not client:
    return

  from_addr = getattr(settings, "SMTP_FROM", getattr(settings, "SMTP_USER", "no-reply@example.com"))
  brand = _platform_from_header("kk")

  msg = MIMEMultipart("alternative")
  msg["Subject"] = subject
  msg["From"] = f'"{brand}" <{from_addr}>'
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


def send_purchase_pending_confirmation_email(
  to_email: str,
  student_name: str,
  course_title: str,
  temp_login: str,
  temp_password: str,
  confirm_url: str,
  parent_temp_login: str | None = None,
  parent_temp_password: str | None = None,
  lang: str = "kk",
) -> None:
  """
  Письмо после оплаты: подтвердить покупку по ссылке + временные учётные данные.
  """
  subject = get_email_translation("purchase_pending_subject", lang, course=course_title)
  greeting = get_email_translation("purchase_pending_greeting", lang, name=student_name)
  body1 = get_email_translation("purchase_pending_body1", lang)
  body2 = get_email_translation("purchase_pending_body2", lang)
  btn = get_email_translation("purchase_pending_button", lang)
  link_hint = get_email_translation("purchase_pending_link_hint", lang)
  login_credentials = get_email_translation("login_credentials", lang)
  login_label = get_email_translation("login", lang)
  password_label = get_email_translation("password", lang)
  parent_title = get_email_translation("parent_credentials_title", lang)
  platform_tagline = get_email_translation("platform_tagline", lang)
  brand = get_email_translation("platform_brand", lang)

  parent_credentials_html = ""
  if parent_temp_login and parent_temp_password:
    parent_credentials_html = f"""
      <div style="background: #1E293B; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #334155;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: white;">{parent_title}</p>
        <p style="margin: 4px 0; color: #94A3B8;">{login_label} <strong style="color: #60A5FA;">{parent_temp_login}</strong></p>
        <p style="margin: 4px 0; color: #94A3B8;">{password_label} <strong style="color: #60A5FA;">{parent_temp_password}</strong></p>
      </div>
    """

  html = f"""
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #FF4181, #1a237e); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{brand}</h1>
    </div>
    <div style="padding: 32px; color: #E2E8F0;">
      <h2 style="color: #60A5FA; margin-top: 0;">{greeting}</h2>
      <p style="font-size: 16px; line-height: 1.6;">
        {body1} <strong style="color: #10B981;">«{course_title}»</strong>.
      </p>
      <p style="font-size: 16px; line-height: 1.6;">{body2}</p>
      <div style="background: #1E293B; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #334155;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: white;">{login_credentials}</p>
        <p style="margin: 4px 0; color: #94A3B8;">{login_label} <strong style="color: #60A5FA;">{temp_login}</strong></p>
        <p style="margin: 4px 0; color: #94A3B8;">{password_label} <strong style="color: #60A5FA;">{temp_password}</strong></p>
      </div>
      {parent_credentials_html}
      <div style="text-align: center; margin: 32px 0;">
        <a href="{confirm_url}" style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">{btn}</a>
      </div>
      <p style="color: #94A3B8; font-size: 13px;">
        {link_hint}<br/>
        <a href="{confirm_url}" style="color: #60A5FA; word-break: break-all;">{confirm_url}</a>
      </p>
      <p style="color: #64748B; font-size: 13px; margin-top: 32px; text-align: center;">{platform_tagline}</p>
    </div>
  </div>
  """
  _send_html_email(to_email, subject, html)


def send_course_purchase_email(
  to_email: str,
  student_name: str,
  course_title: str,
  temp_login: str,
  temp_password: str,
  parent_temp_login: str | None = None,
  parent_temp_password: str | None = None,
  lang: str = "kk",
) -> None:
  """
  Письмо после подтверждения покупки по ссылке: зачисление + вход.
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
  brand = get_email_translation("platform_brand", lang)
  parent_title = get_email_translation("parent_credentials_title", lang)
  login_url = f"{_frontend_base_url()}/login"

  parent_credentials_html = ""
  if parent_temp_login and parent_temp_password:
    parent_credentials_html = f"""
      <div style="background: #1E293B; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #334155;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: white;">{parent_title}</p>
        <p style="margin: 4px 0; color: #94A3B8;">{login_label} <strong style="color: #60A5FA;">{parent_temp_login}</strong></p>
        <p style="margin: 4px 0; color: #94A3B8;">{password_label} <strong style="color: #60A5FA;">{parent_temp_password}</strong></p>
      </div>
    """

  html = f"""
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #FF4181, #1a237e); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{brand}</h1>
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
      {parent_credentials_html}
      <div style="text-align: center; margin-top: 24px;">
        <a href="{login_url}" style="background: linear-gradient(135deg, #FF4181, #1a237e); color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">{go_to_cabinet}</a>
      </div>
      <p style="color: #64748B; font-size: 13px; margin-top: 32px; text-align: center;">
        {platform_tagline}
      </p>
    </div>
  </div>
  """
  _send_html_email(to_email, subject, html)
