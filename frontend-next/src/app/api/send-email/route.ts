import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.warn("EMAIL_USER or EMAIL_PASS not configured in .env.local");
      return NextResponse.json(
        { error: "SMTP not configured" },
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
      { message: "Email sent successfully!" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const err = error as { message?: string; code?: string };
    const errorMessage = err?.message || "Unknown error";
    const errorCode = err?.code || "UNKNOWN";
    
    return NextResponse.json(
      { 
        error: "Failed to send email",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}
