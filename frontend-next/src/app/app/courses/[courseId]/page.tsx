"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import type { TranslationKey } from "@/i18n/translations";
import { Lock, Zap, CreditCard, Smartphone, Loader2, FileQuestion } from "lucide-react";
import { TestComponent } from "@/components/tests/TestComponent";
import { LearningPath, type FlattenedTopic } from "@/components/courses/LearningPath";
import { DailyQuestWidget } from "@/components/dashboard/DailyQuestWidget";
import type { Course } from "@/types";
import { getLocalizedModuleTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";

interface Structure {
  course_id: number;
  modules: Array<{
    id: number;
    title: string;
    order_number: number;
    topics: Array<{ id: number; title: string; order_number: number }>;
  }>;
}

type PaymentStep = "method" | "card" | "loading" | "done";
type LoadingPhase = "connect" | "process" | "confirm";

function PremiumEnrollButton({
  courseId,
  onEnrolled,
  t,
}: {
  courseId: number;
  onEnrolled: () => void;
  t: (k: TranslationKey) => string;
}) {
  const [loading, setLoading] = useState(false);
  const handleEnroll = async () => {
    setLoading(true);
    try {
      await api.post(`/courses/${courseId}/enroll`);
      onEnrolled();
    } catch (e) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("courseError"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleEnroll}
      disabled={loading}
      className="inline-flex items-center gap-2 py-2 px-4 rounded-lg text-white disabled:opacity-70"
      style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {t("coursesEnroll")}
    </button>
  );
}

export default function CourseDetailPage() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const params = useParams();
  const courseId = params.courseId as string;
  const id = Number(courseId);
  const queryClient = useQueryClient();
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("method");
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("connect");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "kaspi" | "halyk" | "eurasian" | "tinkoff" | "jusan" | "forte" | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("4111 1111 1111 1111");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [paying, setPaying] = useState(false);
  const [activeTestId, setActiveTestId] = useState<number | null>(null);

  const { data: course } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data } = await api.get<Course>(`/courses/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: structure } = useQuery({
    queryKey: ["course-structure", id],
    queryFn: async () => {
      const { data } = await api.get<Structure>(`/courses/${id}/structure`);
      return data;
    },
    enabled: !!id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number }>>("/courses/my/enrollments");
      return data;
    },
  });

  const enrolled = enrollments.some((e) => e.course_id === id);

  const { data: progressList = [] } = useQuery({
    queryKey: ["progress", id],
    queryFn: async () => {
      const { data } = await api.get<Array<{ topic_id: number; is_completed: boolean }>>(`/progress/course/${id}`);
      return data;
    },
    enabled: !!id && enrolled,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await api.get<{ points: number; progress_percent: number }>("/dashboard/stats");
      return data;
    },
    enabled: enrolled,
  });

  const flattenedPath = useMemo((): FlattenedTopic[] => {
    if (!structure?.modules) return [];
    const progressByTopic = new Map(progressList.map((p) => [p.topic_id, p]));
    const result: FlattenedTopic[] = [];
    let foundCurrent = false;
    const sortedModules = [...structure.modules].sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
    for (const mod of sortedModules) {
      const sortedTopics = [...(mod.topics || [])].sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
      for (const topic of sortedTopics) {
        const prog = progressByTopic.get(topic.id);
        const completed = prog?.is_completed ?? false;
        const prevCompleted = result.length === 0 ? true : progressByTopic.get(result[result.length - 1].topic_id)?.is_completed ?? false;
        const allowed = result.length === 0 || prevCompleted;
        let nodeType: FlattenedTopic["nodeType"] = "locked";
        if (completed) nodeType = "completed";
        else if (allowed && !foundCurrent) {
          nodeType = "current";
          foundCurrent = true;
        }
        result.push({
          module_id: mod.id,
          module_title: mod.title,
          module_order: mod.order_number ?? 0,
          topic_id: topic.id,
          topic_title: topic.title,
          topic_order: topic.order_number ?? 0,
          nodeType,
        });
      }
    }
    return result;
  }, [structure, progressList]);

  const { data: courseTests = [] } = useQuery({
    queryKey: ["available-tests", id],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          id: number;
          title: string;
          course_title: string;
          is_final: boolean;
          passing_score: number;
          question_count: number;
          can_take?: boolean;
          topics_completed?: boolean;
          topics_completed_count?: number;
          topics_total?: number;
          assignments_completed?: number;
          assignments_total?: number;
        }>
      >(`/tests/available?course_id=${id}`);
      return data;
    },
    enabled: !!id && enrolled,
  });

  const openPaymentModal = () => {
    setPaymentModal(true);
    setPaymentStep("method");
    setPaymentMethod(null);
    setPaymentId(null);
  };

  const handlePay = async () => {
    setPaying(true);
    setPaymentStep("loading");
    setLoadingPhase("connect");
    setTransactionId(null);
    try {
      let pid = paymentId;
      if (!pid) {
        try {
          const { data } = await api.post<{ payment_id?: number; enrollment_id?: number }>(`/courses/${id}/initiate-payment`);
          if (data.enrollment_id) {
            queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
            setPaymentStep("done");
            setPaymentModal(false);
            return;
          }
          pid = data.payment_id!;
          setPaymentId(pid);
        } catch (initErr: unknown) {
          const status = (initErr as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            // Fallback: прямой enroll если payment API недоступен
            await api.post(`/courses/${id}/enroll`);
            setTransactionId(`TXN-${Date.now().toString(36).toUpperCase()}`);
            queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
            setPaymentStep("done");
            setTimeout(() => setPaymentModal(false), 2500);
            return;
          }
          throw initErr;
        }
      }
      // Реалистичные этапы обработки платежа
      await new Promise((r) => setTimeout(r, 800));
      setLoadingPhase("process");
      await new Promise((r) => setTimeout(r, 900));
      setLoadingPhase("confirm");
      try {
        const { data: confirmData } = await api.post<{ transaction_id?: string }>(`/payments/${pid}/confirm`);
        setTransactionId(confirmData?.transaction_id ?? `TXN-${pid.toString().padStart(8, "0")}`);
      } catch (confirmErr: unknown) {
        if ((confirmErr as { response?: { status?: number } })?.response?.status === 404) {
          await api.post(`/courses/${id}/enroll`);
          setTransactionId(`TXN-${pid.toString().padStart(8, "0")}`);
        } else {
          throw confirmErr;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      setPaymentStep("done");
      setTimeout(() => {
        setPaymentModal(false);
      }, 2500);
    } catch (e) {
      setPaymentStep("card");
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("courseError"));
    } finally {
      setPaying(false);
    }
  };

  if (!course) return <p className="text-gray-500">{t("loading")}</p>;

  const isPremiumUser = user?.is_premium === 1;
  const isPremiumOnlyLocked = course.is_premium_only && !isPremiumUser;

  if (isPremiumOnlyLocked) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full bg-gray-700/90 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-gray-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{course.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t("coursePremiumOnlyLock")}</p>
        <Link
          href="/app/premium"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
        >
          <Lock className="w-5 h-5" />
          {t("premiumGetSubscription")}
        </Link>
      </div>
    );
  }

  if (!course.is_active) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{course.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{course.description}</p>
        <p className="text-amber-600 font-medium">🔒 {t("courseSoon")}</p>
        <button disabled className="mt-4 py-2 px-4 rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed">{t("courseUnavailable")}</button>
      </div>
    );
  }

  const courseImageUrl = course.image_url || `https://picsum.photos/seed/course-${id}/300/200`;
  const completedCount = progressList.filter((p) => p.is_completed).length;
  const totalTopics = flattenedPath.length;

  return (
    <div className={enrolled ? "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8" : ""}>
      <div className={enrolled ? "min-w-0" : ""}>
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
          <div className="rounded-xl shadow-xl p-6 max-w-md mx-4 w-full border backdrop-blur-xl bg-white dark:bg-[#1A2238] border-gray-200 dark:border-white/10">
            <h2 id="payment-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {paymentStep === "method" && t("paymentSelectMethod")}
              {paymentStep === "card" && t("paymentCardData")}
              {paymentStep === "loading" && t("paymentProcessing")}
              {paymentStep === "done" && t("paymentSuccess")}
            </h2>

            {paymentStep === "method" && (
              <>
                <p className="mb-4 text-gray-600 dark:text-gray-400">
                  &quot;{course.title}&quot; — {Number(course.price)}₸
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("card"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t("paymentCard")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Visa, Mastercard, MIR</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("kaspi"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Kaspi.kz</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentKaspiConfirm")}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("halyk"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t("halyk")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentHalykFast")}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("eurasian"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t("eurasianBank")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("tinkoff"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t("tinkoff")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("jusan"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t("jusan")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod("forte"); setPaymentStep("card"); }}
                    className="group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left hover:opacity-80 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t("forte")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Банк картасы</p>
                    </div>
                  </button>
                </div>
                <button type="button" onClick={() => setPaymentModal(false)} className="w-full py-2 rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600">
                  {t("cancel")}
                </button>
              </>
            )}

            {paymentStep === "card" && (
              <>
                <p className="text-gray-500 text-sm mb-3">{t("paymentSimulationHint")}</p>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t("paymentCardNumber")}</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="4111 1111 1111 1111"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t("paymentExpiry")}</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">CVV</label>
                      <input
                        type="text"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="123"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPaymentStep("method")} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    Артқа
                  </button>
                  <button type="button" onClick={handlePay} disabled={paying} className="flex-1 py-2 px-4 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--qit-primary)" }}>
                    {t("paymentPay")}
                  </button>
                </div>
              </>
            )}

            {paymentStep === "loading" && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-[var(--qit-primary)] mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                  {loadingPhase === "connect" && t("paymentConnecting")}
                  {loadingPhase === "process" && t("paymentProcessing")}
                  {loadingPhase === "confirm" && t("paymentConfirming")}
                </p>
                <p className="text-gray-500 text-sm">{t("paymentWait")}</p>
              </div>
            )}

            {paymentStep === "done" && (
              <div className="py-4">
                <div className="text-center mb-4">
                  <p className="text-green-600 font-medium text-lg">✓ {t("paymentSuccess")}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm space-y-2">
                  <p className="font-medium text-gray-800 dark:text-white">{t("paymentTransactionDetails")}</p>
                  {transactionId && (
                    <p className="text-gray-600 dark:text-gray-300">
                      <span className="text-gray-500">{t("paymentTransactionId")}:</span> {transactionId}
                    </p>
                  )}
                  <p className="text-gray-600 dark:text-gray-300">
                    <span className="text-gray-500">{t("paymentCourseLabel")}:</span> {course.title}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    <span className="text-gray-500">{t("paymentAmount")}:</span> {Number(course.price)}₸
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6 flex gap-6">
        <div className="w-48 h-32 rounded-xl overflow-hidden bg-[var(--qit-primary)]/10 shrink-0">
          <img src={courseImageUrl} alt={course.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{course.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{course.description}</p>
          <p className="text-[#1a237e] dark:text-[#00b0ff] font-semibold mb-4">
            {course.is_premium_only ? t("premiumOnly") : `${Number(course.price)}₸`}
          </p>
          {!enrolled && (
            course.is_premium_only ? (
              isPremiumUser ? (
                <PremiumEnrollButton courseId={id} onEnrolled={() => queryClient.invalidateQueries({ queryKey: ["my-enrollments"] })} t={t} />
              ) : (
                <Link href="/app/premium" className="inline-flex items-center gap-2 py-2 px-4 rounded-lg text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>
                  <Lock className="w-4 h-4" />
                  {t("premiumGetSubscription")}
                </Link>
              )
            ) : (
              <button type="button" onClick={openPaymentModal} className="py-2 px-4 rounded-lg text-white" style={{ background: "var(--qit-primary)" }}>
                {t("courseBuy")}
              </button>
            )
          )}
          {enrolled && <p className="text-green-600 font-medium">{t("courseEnrolled")}</p>}
        </div>
      </div>

      {enrolled && (
        <div className="mb-6">
          <Link href={`/app/ai-challenge/${id}`} className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
            <Zap className="w-4 h-4" /> {t("aiVsStudent")}
          </Link>
        </div>
      )}

      {enrolled && flattenedPath.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">{t("courseModulesTopics")}</h2>
          <LearningPath courseId={id} items={flattenedPath} />
        </div>
      )}

      {enrolled && (
        <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="border-b dark:border-gray-600 px-4 py-4">
            <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-[var(--qit-primary)]" />
              {t("leaderboardControlTest")}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t("leaderboardControlDesc")}
            </p>
          </div>

          {activeTestId ? (
            <div className="p-4">
              <TestComponent
                testId={activeTestId}
                onComplete={() => setActiveTestId(null)}
                onCancel={() => setActiveTestId(null)}
              />
            </div>
          ) : (
            <div className="p-4">
              {courseTests.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  {t("courseNoTests")}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {courseTests.map((test) => {
                    const canTake = test.can_take !== false;
                    const topicsInfo = test.topics_total !== undefined && test.topics_total > 0
                      ? `${test.topics_completed_count || 0}/${test.topics_total}`
                      : null;
                    const assignmentsInfo = test.assignments_total !== undefined && test.assignments_total > 0
                      ? `${test.assignments_completed || 0}/${test.assignments_total}`
                      : null;
                    
                    const missingItems: string[] = [];
                    if (!test.topics_completed && topicsInfo) {
                      missingItems.push(`темы: ${topicsInfo}`);
                    }
                    if (!test.assignments_completed && assignmentsInfo) {
                      missingItems.push(`задания: ${assignmentsInfo}`);
                    }
                    
                    return (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => canTake && setActiveTestId(test.id)}
                        disabled={!canTake}
                        className={`text-left p-4 rounded-xl border dark:border-gray-600 transition-colors ${
                          canTake
                            ? "hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            : "opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800 dark:text-white flex items-center gap-2">
                              {test.title}
                              {!canTake && <Lock className="w-4 h-4 text-gray-400" />}
                            </div>
                            {test.is_final && (
                              <span className="text-sm text-amber-600 dark:text-amber-400">
                                ({t("leaderboardFinal")})
                              </span>
                            )}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {test.question_count} {t("leaderboardQuestion")} • {test.passing_score}% {t("leaderboardPass")}
                            </div>
                            {!canTake && missingItems.length > 0 && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                Барлық тақырыптар мен тапсырмаларды орындау керек ({missingItems.join(", ")})
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {enrolled && (
        <aside className="lg:order-none order-last">
          <div className="lg:sticky lg:top-24 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">{t("profileCoins")}</h3>
              <div className="flex items-center gap-2">
                <Image src="/icons/coin.png" alt="coins" width={24} height={24} />
                <span className="text-2xl font-bold text-gray-800 dark:text-white">{stats?.points ?? 0}</span>
              </div>
              <Link href="/app/shop" className="mt-2 inline-block text-sm font-medium text-[var(--qit-primary)] hover:underline">
                {t("profileShopLink")}
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">{t("profileCourseProgress")}</h3>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-200 dark:text-gray-600" />
                    <circle
                      cx="18" cy="18" r="15.9"
                      fill="none" stroke="var(--qit-primary)" strokeWidth="2"
                      strokeDasharray={`${totalTopics ? (completedCount / totalTopics) * 100 : 0} 100`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800 dark:text-white">
                    {totalTopics ? Math.round((completedCount / totalTopics) * 100) : 0}%
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {completedCount} / {totalTopics} {t("profileTopic")}
                  </p>
                </div>
              </div>
            </div>
            <DailyQuestWidget />
          </div>
        </aside>
      )}
    </div>
  );
}
