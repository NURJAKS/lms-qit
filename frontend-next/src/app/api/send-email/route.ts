import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Не указаны обязательные поля: to, subject, html" },
        { status: 400 }
      );
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.warn("EMAIL_USER или EMAIL_PASS не настроены в .env.local");
      return NextResponse.json(
        { error: "SMTP не настроен" },
        { status: 500 }
      );
    }

    // Убираем пробелы из пароля на случай если они были скопированы
    const cleanPassword = emailPass.replace(/\s+/g, "");
    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser.trim(),
        pass: cleanPassword,
      },
    });
    
    // Проверяем подключение перед отправкой
    await transporter.verify();

    const mailOptions = {
      from: `"Qazaq IT Academy" <${emailUser}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: "Письмо успешно отправлено!" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Ошибка при отправке письма:", error);
    const err = error as { message?: string; code?: string };
    const errorMessage = err?.message || "Неизвестная ошибка";
    const errorCode = err?.code || "UNKNOWN";
    
    return NextResponse.json(
      { 
        error: "Не удалось отправить письмо",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}
