"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { AppHeader } from "@/components/common/AppHeader";
import { Loader2, Clock, Signal, GraduationCap, Lock, Sparkles, CreditCard, Smartphone } from "lucide-react";
import type { Course } from "@/types";
import { CATEGORY_METRICS, COURSE_CARD_COLORS, courseImageUrl, getCategoryFromCourse, getLocalizedCourseTitle, getLocalizedCourseDesc } from "@/lib/courseUtils";

function CatalogCourseCard({
  c,
  cardIndex,
  isEnrolled,
  isActive,
  isPremiumOnly,
  isPremiumUser,
  t,
  getCourseLink,
  onBuyClick,
}: {
  c: Course;
  cardIndex: number;
  isEnrolled: boolean;
  isActive: boolean;
  isPremiumOnly: boolean;
  isPremiumUser: boolean;
  t: (k: TranslationKey) => string;
  getCourseLink: (id: number) => string;
  onBuyClick?: (course: Course) => void;
}) {
  const imgUrl = courseImageUrl(c);
  const courseLink = getCourseLink(c.id);
  const category = getCategoryFromCourse(c);
  const localizedTitle = getLocalizedCourseTitle(c, t as (k: string) => string);
  const localizedDesc = getLocalizedCourseDesc(c, t as (k: string) => string);
  const accent = COURSE_CARD_COLORS[cardIndex % COURSE_CARD_COLORS.length];
  const metrics = CATEGORY_METRICS[category.key] ?? CATEGORY_METRICS.data;

  const locked = isPremiumOnly && !isPremiumUser;
  const cardBase = "h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border-2 transition-all duration-300 hover:shadow-xl border-gray-200 dark:border-gray-700";
  const cardActive = isActive && !locked ? "hover:border-[#00b0ff]/50 hover:shadow-[0_20px_40px_-12px_rgba(0,176,255,0.2)]" : "opacity-75";

  const CtaButton = () => {
    if (locked) {
      return (
        <Link href="/app/premium" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>
          <Lock className="w-4 h-4" />
          {t("premiumGetSubscription")}
        </Link>
      );
    }
    if (!isActive) {
      return (
        <span className="block w-full py-3 rounded-xl text-center font-semibold bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed">
          {t("viewCourse")}
        </span>
      );
    }
    if (isEnrolled) {
      return (
        <Link href={courseLink} className="block w-full py-3 rounded-xl text-center font-semibold text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #1a237e, #311b92)" }}>
          {t("viewCourse")}
        </Link>
      );
    }
    if (onBuyClick && !isPremiumOnly) {
      return (
        <button type="button" onClick={() => onBuyClick(c)} className="block w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90" style={{ background: "var(--qit-gradient-1)" }}>
          {t("buyCourse")}
        </button>
      );
    }
    return (
      <Link href={courseLink} className="block w-full py-3 rounded-xl text-center font-semibold text-white transition-all hover:opacity-90" style={{ background: "var(--qit-gradient-1)" }}>
        {isPremiumOnly ? t("coursesEnroll") : t("buyCourse")}
      </Link>
    );
  };

  return (
    <div className={`${cardBase} ${cardActive}`} style={{ borderLeftWidth: 4, borderLeftColor: accent }}>
      <div className="relative h-44 shrink-0 overflow-hidden">
        <img src={imgUrl} alt={localizedTitle} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-16 h-16 rounded-full bg-gray-500/90 dark:bg-gray-700/90 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white dark:text-gray-300" />
            </div>
          </div>
        )}
        <span
          className="absolute bottom-3 left-4 px-3 py-1 rounded-full text-xs font-semibold text-white border"
          style={{ background: `${accent}40`, borderColor: `${accent}80` }}
        >
          {locked ? t("premiumBadge") : t(category.labelKey as TranslationKey)}
        </span>
      </div>
      <div className="flex-1 flex flex-col p-5 min-h-0">
        <span
          className="inline-block w-fit px-3 py-1 rounded-full text-xs font-medium mb-3 border"
          style={{ background: `${accent}20`, color: accent, borderColor: `${accent}50` }}
        >
          {t(category.labelKey as TranslationKey)}
        </span>
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2">{localizedTitle}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">{localizedDesc}</p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {t(metrics.durationKey as TranslationKey)}
          </span>
          <span className="flex items-center gap-1">
            <Signal className="w-4 h-4" />
            {t(metrics.levelKey as TranslationKey)}
          </span>
          <span className="flex items-center gap-1">
            <GraduationCap className="w-4 h-4" />
            {metrics.students} {t("coursesStudents")}
          </span>
        </div>
        <p className="text-xl font-bold text-[#00b0ff] mb-4">
          {locked ? t("premiumOnly") : `${Number(c.price)}₸`}
        </p>
        <div className="mt-auto">
          <CtaButton />
        </div>
      </div>
    </div>
  );
}

function CatalogPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isPremiumUser = user?.is_premium === 1;
  const [buyModal, setBuyModal] = useState<Course | null>(null);
  type PaymentMethod = "kaspi" | "halyk" | "card" | "eurasian" | "jusan" | "forte";

  const [submitStep, setSubmitStep] = useState<"form" | "payment_method" | "card_details" | "loading" | "done">("form");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("card");
  const [cardData, setCardData] = useState({ number: "", expiry: "", cvv: "" });
  const [submitError, setSubmitError] = useState("");
  const [paymentProgress, setPaymentProgress] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    city: "",
    student_birth_date: "",
    student_age: "",
    student_iin: "",
    parent_email: "",
    parent_full_name: "",
    parent_phone: "",
    parent_city: "",
    parent_birth_date: "",
    parent_age: "",
    parent_iin: "",
  });

  const { data: courses = [], isLoading: coursesLoading, isError: coursesError } = useQuery({
    queryKey: ["courses-all"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/courses");
      return data;
    },
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number }>>("/courses/my/enrollments");
      return data;
    },
    enabled: !!token,
  });
  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const regularCourses = courses.filter((c) => !c.is_premium_only);
  const premiumCourses = courses.filter((c) => c.is_premium_only);

  const getCourseLink = (id: number) => {
    if (token) return `/app/courses/${id}`;
    return `/login?redirect=${encodeURIComponent(`/app/courses/${id}`)}`;
  };

  const handleBuyClick = async (course: Course) => {
    setBuyModal(course);
    setSubmitError("");
    setEmailError(null);
    setConfirmationToken(null);
    setCardData({ number: "", expiry: "", cvv: "" });
    setPaymentProgress(0);
    setPaymentId(null);
    
    // Если пользователь авторизован, пропускаем форму и сразу инициируем платеж
    if (user && token) {
      setSubmitStep("payment_method");
      await handleInitiatePayment(course.id);
    } else {
      // Не авторизован - показываем форму
      setSubmitStep("form");
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        city: "",
        student_birth_date: "",
        student_age: "",
        student_iin: "",
        parent_email: "",
        parent_full_name: "",
        parent_phone: "",
        parent_city: "",
        parent_birth_date: "",
        parent_age: "",
        parent_iin: "",
      });
    }
  };

  const handleInitiatePayment = React.useCallback(async (courseId: number) => {
    try {
      const { data } = await api.post<{ payment_id?: number; enrollment_id?: number }>(`/courses/${courseId}/initiate-payment`);
      if (data.enrollment_id) {
        // Уже записан на курс
        queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
        setSubmitStep("done");
        return;
      }
      if (data.payment_id) {
        setPaymentId(data.payment_id);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setSubmitError(t("courseNotFound"));
      } else {
        setSubmitError(t("paymentInitError"));
      }
      setSubmitStep("form");
    }
  }, [queryClient]);

  const handlePay = async () => {
    if (!buyModal || submitStep === "loading") return;
    
    // Проверка данных карты
    if (!cardData.number || !cardData.expiry || !cardData.cvv) {
      setSubmitError("Пожалуйста, заполните все поля карты");
      return;
    }

    setSubmitError("");
    setSubmitStep("loading");
    setPaymentProgress(0);

    // Симуляция прогресса обработки платежа от 0% до 100%
    const simulateProgress = () => {
      return new Promise<void>((resolve) => {
        const startTime = Date.now();
        const minDuration = 2000; // Минимальная длительность 2 секунды
        let progress = 0;
        
        const interval = setInterval(() => {
          // Медленнее увеличиваем прогресс: случайный шаг от 2 до 8%
          progress += Math.random() * 6 + 2;
          
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setPaymentProgress(100);
            
            // Гарантируем минимальное время выполнения
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, minDuration - elapsed);
            
            setTimeout(() => resolve(), remaining + 300); // +300мс задержка на 100%
          } else {
            setPaymentProgress(Math.min(progress, 99));
          }
        }, 200); // Обновление каждые 200мс для более плавной и медленной анимации
      });
    };

    try {
      await simulateProgress();

      // Если пользователь авторизован, используем новый flow с payment_id
      if (user && token && paymentId) {
        const response = await api.post<{
          message: string;
          transaction_id?: string;
          enrollment_id?: number;
        }>(`/payments/${paymentId}/confirm`);

        if (response && response.data) {
          // Инвалидируем запросы для обновления списка курсов
          queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
          queryClient.invalidateQueries({ queryKey: ["courses-all"] });
          
          setSubmitStep("done");
        }
      } else {
        // Старый flow для неавторизованных пользователей
        const response = await api.post<{
          message: string;
          confirmation_token: string;
          course_title: string;
          student_name: string;
          student_email: string;
        }>("/applications/pay", {
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          city: formData.city,
          student_birth_date: formData.student_birth_date || null,
          student_age: formData.student_age ? Number(formData.student_age) : null,
          student_iin: formData.student_iin || "",
          course_id: buyModal.id,
          parent_email: formData.parent_email,
          parent_full_name: formData.parent_full_name,
          parent_phone: formData.parent_phone,
          parent_city: formData.parent_city,
          parent_birth_date: formData.parent_birth_date || null,
          parent_age: formData.parent_age ? Number(formData.parent_age) : null,
          parent_iin: formData.parent_iin || "",
          payment_method: selectedPaymentMethod,
        });

        if (response && response.data) {
          const { confirmation_token, course_title, student_name, student_email } = response.data;
          setConfirmationToken(confirmation_token);
          const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
          const confirmUrl = `${baseUrl}/confirm-purchase/${confirmation_token}`;

          try {
            setEmailError(null);
            const emailResponse = await fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: student_email,
                subject: t("emailConfirmPurchaseSubject").replace("{course}", course_title),
                html: `
                  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; border-radius: 16px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #FF4181, #1a237e); padding: 32px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">Qazaq IT Academy</h1>
                    </div>
                    <div style="padding: 32px; color: #E2E8F0;">
                      <h2 style="color: #60A5FA; margin-top: 0;">${t("emailConfirmPurchaseGreeting").replace("{name}", student_name)}</h2>
                      <p style="font-size: 16px; line-height: 1.6;">
                        ${t("emailConfirmPurchaseBody1")} <strong style="color: #10B981;">«${course_title}»</strong>.
                      </p>
                      <p style="font-size: 16px; line-height: 1.6;">
                        ${t("emailConfirmPurchaseBody2")}
                      </p>
                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${confirmUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">${t("emailConfirmPurchaseButton")}</a>
                      </div>
                      <p style="color: #94A3B8; font-size: 13px;">
                        ${t("emailConfirmPurchaseLinkHint")}<br/>
                        <a href="${confirmUrl}" style="color: #60A5FA; word-break: break-all;">${confirmUrl}</a>
                      </p>
                      <p style="color: #64748B; font-size: 13px; margin-top: 32px; text-align: center;">
                        ${t("emailPlatformTagline")}
                      </p>
                    </div>
                  </div>
                `,
              }),
            });
            
            if (!emailResponse.ok) {
              const errorData = await emailResponse.json();
              console.error("Ошибка отправки email:", errorData);
              setEmailError(errorData.details || errorData.error || t("emailSendError"));
            }
          } catch (emailError: any) {
            console.error("Ошибка при отправке письма:", emailError);
            setEmailError(emailError?.message || t("emailServerError"));
          }

          setSubmitStep("done");
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setSubmitError(err.response?.data?.detail ?? t("error"));
      setSubmitStep("card_details");
      setPaymentProgress(0);
    }
  };

  const closeBuyModal = (source?: string) => {
    setBuyModal(null);
    setSubmitStep("form");
    setEmailError(null);
    setConfirmationToken(null);
    setCardData({ number: "", expiry: "", cvv: "" });
    setPaymentProgress(0);
    setPaymentId(null);
    if (searchParams.get("course")) {
      router.replace("/courses");
    }
  };

  const courseIdFromUrl = searchParams.get("course");
  const enrollmentsReady = !token || !enrollmentsLoading;
  const openedForRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (!coursesLoading && enrollmentsReady && courses.length > 0 && courseIdFromUrl) {
      const id = parseInt(courseIdFromUrl, 10);
      const course = courses.find((c) => c.id === id);
      const isEnrolled = enrolledIds.has(id);
      if (course && !isEnrolled && openedForRef.current !== id) {
        openedForRef.current = id;
        setBuyModal(course);
        setSubmitError("");
        setPaymentId(null);
        
        // Если пользователь авторизован, пропускаем форму
        if (user && token) {
          setSubmitStep("payment_method");
          handleInitiatePayment(id);
        } else {
          setSubmitStep("form");
          setFormData({
            email: "",
            full_name: "",
            phone: "",
            city: "",
            student_birth_date: "",
            student_age: "",
            student_iin: "",
            parent_email: "",
            parent_full_name: "",
            parent_phone: "",
            parent_city: "",
            parent_birth_date: "",
            parent_age: "",
            parent_iin: "",
          });
        }
      }
    }
    if (!courseIdFromUrl) openedForRef.current = null;
  }, [coursesLoading, enrollmentsReady, courses.length, courseIdFromUrl, enrollments.length, user, token, handleInitiatePayment]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4 lg:gap-8">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: "var(--qit-gradient-1)" }}
              >
                Q
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white font-montserrat">
                Qazaq IT Academy
              </span>
            </Link>
            <nav className="flex items-center gap-4 lg:gap-6 flex-1 justify-center">
              <Link href="/" className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium whitespace-nowrap">
                {t("navHome")}
              </Link>
              <span className="shrink-0 py-2 text-[#1a237e] dark:text-[#00b0ff] font-semibold whitespace-nowrap">{t("courseCatalog")}</span>
              <div className="flex items-center gap-6 shrink-0">
                <AppHeader />
                {token ? (
                  <Link
                    href="/app"
                    className="px-5 py-2.5 rounded-full font-semibold text-white transition-all hover:opacity-90 whitespace-nowrap"
                    style={{ background: "var(--qit-gradient-3)" }}
                  >
                    {t("navPersonalCabinet")}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="px-5 py-2.5 rounded-full font-semibold text-white transition-all hover:opacity-90 whitespace-nowrap"
                    style={{ background: "var(--qit-gradient-3)" }}
                  >
                    {t("navPersonalCabinet")}
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 font-montserrat">{t("catalogTitle")}</h1>

        {coursesLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-[#00b0ff] mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{t("loading")}</p>
          </div>
        )}

        {coursesError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
            <p className="font-medium text-red-700 dark:text-red-400 mb-2">
              {t("errorLoadingCourses")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("checkBackendRunning")}
            </p>
          </div>
        )}

        {!coursesLoading && !coursesError && courses.length === 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {t("noCoursesYet")}
            </p>
          </div>
        )}

        {!coursesLoading && !coursesError && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {regularCourses.map((c, i) => (
              <CatalogCourseCard
                key={c.id}
                c={c}
                cardIndex={i}
                isEnrolled={enrolledIds.has(c.id)}
                isActive={c.is_active}
                isPremiumOnly={false}
                isPremiumUser={isPremiumUser}
                t={t}
                getCourseLink={getCourseLink}
                onBuyClick={!enrolledIds.has(c.id) ? handleBuyClick : undefined}
              />
            ))}
            {premiumCourses.map((c, i) => (
              <CatalogCourseCard
                key={c.id}
                c={c}
                cardIndex={regularCourses.length + i}
                isEnrolled={enrolledIds.has(c.id)}
                isActive={c.is_active}
                isPremiumOnly={true}
                isPremiumUser={isPremiumUser}
                t={t}
                getCourseLink={getCourseLink}
                onBuyClick={!enrolledIds.has(c.id) ? handleBuyClick : undefined}
              />
            ))}
          </div>
        )}

        {!coursesLoading && !coursesError && premiumCourses.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{t("catalogPremiumOnlyHint")}</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t("catalogPremiumOnlyDesc")}</p>
            <Link
              href="/app/premium"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
            >
              <Lock className="w-4 h-4" />
              {t("premiumGetSubscription")}
            </Link>
          </div>
        )}
      </main>

        {buyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="buy-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeBuyModal("backdrop");
            }
          }}
        >
          <div
            className="rounded-xl shadow-xl p-6 max-w-3xl mx-4 w-full border backdrop-blur-xl bg-white dark:bg-[#1A2238] border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="buy-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center font-montserrat px-4">
              {submitStep === "form" && t("buyCourse")}
              {submitStep === "payment_method" && t("paymentSelectMethod")}
              {submitStep === "card_details" && t("cardDetails")}
              {submitStep === "loading" && t("paymentProcessing")}
              {submitStep === "done" && t("paymentSuccess")}
            </h2>
            {submitStep !== "done" && submitStep !== "loading" && (
              <p className="text-gray-500 dark:text-gray-400 text-center mb-8 px-4">
                {buyModal.title} — <span className="text-[#00b0ff] font-bold">{Number(buyModal.price)} ₸</span>
              </p>
            )}

            {submitStep === "form" && (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  &quot;{buyModal.title}&quot; — {Number(buyModal.price)}₸
                </p>
                <div className="space-y-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {t("studentInfo")}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={t("emailPlaceholder")}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("fullName")} *</label>
                          <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={t("namePlaceholder")}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("birthDate")}</label>
                            <input
                              type="date"
                              value={formData.student_birth_date}
                              onChange={(e) => setFormData((p) => ({ ...p, student_birth_date: e.target.value }))}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("age")}</label>
                            <input
                              type="number"
                              min={5}
                              max={100}
                              value={formData.student_age}
                              onChange={(e) => setFormData((p) => ({ ...p, student_age: e.target.value }))}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="15"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("iin")}</label>
                          <input
                            type="text"
                            maxLength={12}
                            value={formData.student_iin}
                            onChange={(e) => setFormData((p) => ({ ...p, student_iin: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="000000000000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("phone")}</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="+7 777 123 4567"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("city")}</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={t("cityPlaceholder")}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {t("parentDataSection")}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("parentEmail")} *</label>
                          <input
                            type="email"
                            value={formData.parent_email}
                            onChange={(e) => setFormData((p) => ({ ...p, parent_email: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="parent@example.com"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("parentFullName")} *</label>
                          <input
                            type="text"
                            value={formData.parent_full_name}
                            onChange={(e) => setFormData((p) => ({ ...p, parent_full_name: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={t("namePlaceholder")}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("birthDate")}</label>
                            <input
                              type="date"
                              value={formData.parent_birth_date}
                              onChange={(e) => setFormData((p) => ({ ...p, parent_birth_date: e.target.value }))}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("age")}</label>
                            <input
                              type="number"
                              min={18}
                              max={100}
                              value={formData.parent_age}
                              onChange={(e) => setFormData((p) => ({ ...p, parent_age: e.target.value }))}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="35"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("iin")}</label>
                          <input
                            type="text"
                            maxLength={12}
                            value={formData.parent_iin}
                            onChange={(e) => setFormData((p) => ({ ...p, parent_iin: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="000000000000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("parentPhone")}</label>
                          <input
                            type="tel"
                            value={formData.parent_phone}
                            onChange={(e) => setFormData((p) => ({ ...p, parent_phone: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="+7 777 123 4567"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("parentCity")}</label>
                          <input
                            type="text"
                            value={formData.parent_city}
                            onChange={(e) => setFormData((p) => ({ ...p, parent_city: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={t("cityPlaceholder")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {submitError && <p className="text-red-500 text-sm mb-3">{submitError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeBuyModal("cancel");
                    }}
                    className="py-2 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.email.trim() || !formData.full_name.trim() || !formData.parent_email.trim() || !formData.parent_full_name.trim()) return;
                      setSubmitError("");
                      setSubmitStep("payment_method");
                    }}
                    disabled={
                      !formData.email.trim() ||
                      !formData.full_name.trim() ||
                      !formData.parent_email.trim() ||
                      !formData.parent_full_name.trim()
                    }
                    className="flex-1 py-2 px-4 rounded-lg text-white disabled:opacity-50"
                    style={{ background: "var(--qit-primary)" }}
                  >
                    {t("goToPayment")}
                  </button>
                </div>
              </>
            )}

            {submitStep === "payment_method" && (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t("paymentSelectMethodHint")} &quot;{buyModal.title}&quot; — {Number(buyModal.price)}₸
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod("card");
                      setCardData({ number: "", expiry: "", cvv: "" });
                      setSubmitStep("card_details");
                    }}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{t("paymentCard")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Visa, Mastercard, MIR</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod("kaspi");
                      setCardData({ number: "", expiry: "", cvv: "" });
                      setSubmitStep("card_details");
                    }}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-red-500 hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Kaspi.kz</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Төлемді растау</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod("halyk");
                      setCardData({ number: "", expiry: "", cvv: "" });
                      setSubmitStep("card_details");
                    }}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-green-500 hover:bg-green-50/30 dark:hover:bg-green-500/5 transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Halyk Bank</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Жылдам төлем</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod("eurasian");
                      setCardData({ number: "", expiry: "", cvv: "" });
                      setSubmitStep("card_details");
                    }}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{t("eurasianBank")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod("jusan");
                      setCardData({ number: "", expiry: "", cvv: "" });
                      setSubmitStep("card_details");
                    }}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-orange-500 hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{t("jusan")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod("forte");
                      setCardData({ number: "", expiry: "", cvv: "" });
                      setSubmitStep("card_details");
                    }}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{t("forte")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>
                </div>
                {submitError && <p className="text-red-500 text-sm mb-3">{submitError}</p>}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setSubmitStep("form")}
                    className="flex-1 py-4 px-6 rounded-2xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t("back")}
                  </button>
                </div>
              </>
            )}

            {submitStep === "card_details" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      placeholder={t("cardNumberPlaceholder")}
                      value={cardData.number}
                      onChange={(e) => setCardData(prev => ({ ...prev, number: e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19) }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder={t("cardExpiryPlaceholder")}
                      value={cardData.expiry}
                      onChange={(e) => setCardData(prev => ({ ...prev, expiry: e.target.value.replace(/\D/g, '').replace(/(.{2})/, '$1/').trim().slice(0, 5) }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl py-4 px-4 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 dark:text-white"
                    />
                    <input
                      type="password"
                      placeholder={t("cardCvvPlaceholder")}
                      maxLength={3}
                      value={cardData.cvv}
                      onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl py-4 px-4 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {submitError && <p className="text-red-500 text-sm mb-3 text-center">{submitError}</p>}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError("");
                      setSubmitStep("payment_method");
                    }}
                    className="flex-1 py-4 px-6 rounded-2xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t("back")}
                  </button>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={!cardData.number || !cardData.expiry || !cardData.cvv}
                    className="flex-[2] py-4 px-6 rounded-2xl font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all disabled:opacity-50"
                    style={{ background: "var(--qit-gradient-1)" }}
                  >
                    {t("paymentPay")}
                  </button>
                </div>
              </div>
            )}

            {submitStep === "loading" && (
              <div className="flex flex-col items-center py-8 space-y-6">
                <Loader2 className="w-12 h-12 animate-spin text-[var(--qit-primary)]" />
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>{t("paymentProcessing")}</span>
                    <span className="font-bold">{Math.round(paymentProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    {paymentProgress < 30 && "Проверка данных карты..."}
                    {paymentProgress >= 30 && paymentProgress < 60 && "Подключение к банку..."}
                    {paymentProgress >= 60 && paymentProgress < 90 && "Обработка платежа..."}
                    {paymentProgress >= 90 && paymentProgress < 100 && "Завершение транзакции..."}
                    {paymentProgress >= 100 && "Платеж успешно обработан!"}
                  </p>
                </div>
              </div>
            )}

            {submitStep === "done" && (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-6 animate-[bounce_1s_ease-in-out_3]">
                  <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-emerald-500 mb-3">Оплачено!</h3>
                {user && token ? (
                  <>
                    <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-3 px-4">
                      Курс «{buyModal.title}» успешно куплен! Теперь вы можете начать обучение.
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 px-4">
                      Преподаватель получит уведомление и добавит вас в группу. Курс уже доступен в разделе «Мои курсы».
                    </p>
                    <div className="flex gap-4 w-full max-w-sm">
                      <button
                        type="button"
                        onClick={() => {
                          closeBuyModal("done");
                          router.push(`/app/courses/${buyModal.id}`);
                        }}
                        className="flex-1 py-4 rounded-2xl font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
                        style={{ background: "var(--qit-gradient-1)" }}
                      >
                        Перейти к курсу
                      </button>
                      <button
                        type="button"
                        onClick={() => closeBuyModal("done")}
                        className="flex-1 py-4 rounded-2xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Закрыть
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-3 px-4">
                      Оплата прошла успешно.
                    </p>
                    {emailError ? (
                      <div className="w-full max-w-md mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <p className="text-yellow-400 text-sm font-semibold mb-2">⚠️ Письмо не отправлено</p>
                        <p className="text-yellow-300 text-xs mb-2">{emailError}</p>
                        <p className="text-yellow-200 text-xs">
                          Проверьте настройки SMTP в <code className="bg-yellow-900/30 px-1 rounded">.env.local</code> и убедитесь, что EMAIL_PASS — это реальный пароль приложения Gmail.
                        </p>
                        {confirmationToken && (
                          <p className="text-yellow-200 text-xs mt-2">
                            Ссылка для подтверждения: <a href={`${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/confirm-purchase/${confirmationToken}`} className="underline break-all" target="_blank" rel="noopener noreferrer">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/confirm-purchase/{confirmationToken}</a>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 px-4">
                        На ваш email <span className="text-blue-400 font-semibold">{formData.email}</span> отправлено письмо с просьбой подтвердить покупку. Перейдите по ссылке в письме, чтобы получить логин и пароль.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => closeBuyModal("done")}
                      className="w-full max-w-sm py-4 rounded-2xl font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
                      style={{ background: "var(--qit-gradient-1)" }}
                    >
                      Платформаға оралу
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin text-[#00b0ff]" /></div>}>
      <CatalogPageContent />
    </Suspense>
  );
}
