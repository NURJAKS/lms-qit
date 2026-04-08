"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  BookOpen,
  Crown,
  Zap,
  Shield,
  Check,
  ArrowRight,
  Star,
  CreditCard,
  Loader2,
  Lock,
  X,
  Download,
  FileText,
  Calendar,
  TrendingUp,
  Users,
  DownloadCloud,
  Clock,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/api/client";
import type { TranslationKey } from "@/i18n/translations";
import type { Course } from "@/types";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

type PaymentStep = "method" | "card" | "loading" | "done";
type LoadingPhase = "connect" | "process" | "confirm";

const benefits = [
  { icon: BookOpen, key: "premiumBenefit1" },
  { icon: Zap, key: "premiumBenefit2" },
  { icon: Crown, key: "premiumBenefit3" },
  { icon: Shield, key: "premiumBenefit4" },
];

const premiumFeatures = [
  { icon: BookOpen, key: "premiumFeature1" },
  { icon: Zap, key: "premiumFeature2" },
  { icon: Crown, key: "premiumFeature3" },
  { icon: Shield, key: "premiumFeature4" },
  { icon: Clock, key: "premiumFeature5" },
  { icon: MessageSquare, key: "premiumFeature6" },
  { icon: DownloadCloud, key: "premiumFeature7" },
  { icon: Calendar, key: "premiumFeature8" },
  { icon: TrendingUp, key: "premiumFeature9" },
  { icon: Download, key: "premiumFeature10" },
  { icon: Users, key: "premiumFeature11" },
  { icon: FileText, key: "premiumFeature12" },
];

const freeLimits = [
  "freeLimit1",
  "freeLimit2",
  "freeLimit3",
  "freeLimit4",
  "freeLimit5",
  "freeLimit6",
  "freeLimit7",
  "freeLimit8",
] as const;

export default function PremiumPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { user, setAuth } = useAuthStore();

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  if (user?.role === "parent") {
    return null;
  }
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("method");
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("connect");
  const [cardNumber, setCardNumber] = useState("4111 1111 1111 1111");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [paying, setPaying] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "kaspi" | "halyk" | "eurasian" | "tinkoff" | "jusan" | "forte" | null>(null);

  const { data: config } = useQuery({
    queryKey: ["premium-config"],
    queryFn: async () => {
      const { data } = await api.get<{ price_tenge: number; currency: string }>("/premium/config");
      return data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-all"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/courses");
      return data;
    },
  });
  const premiumCourses = courses.filter((c) => c.is_premium_only);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ message: string; is_premium: boolean; transaction_id?: string }>("/premium/purchase");
      return data;
    },
    onSuccess: async (data) => {
      if (data.is_premium) {
        const { data: me } = await api.get("/users/me");
        const token = useAuthStore.getState().token;
        if (me && token) setAuth(me, token);
      }
      queryClient.invalidateQueries({ queryKey: ["premium-config"] });
    },
  });

  const isPremium = user?.is_premium === 1;
  const price = config?.price_tenge ?? 199999;

  const openPaymentModal = () => {
    setPaymentModal(true);
    setPaymentStep("method");
    setPaymentMethod(null);
    setTransactionId(null);
  };

  const handlePay = async () => {
    setPaying(true);
    setPaymentStep("loading");
    setLoadingPhase("connect");
    setTransactionId(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setLoadingPhase("process");
      await new Promise((r) => setTimeout(r, 900));
      setLoadingPhase("confirm");
      await new Promise((r) => setTimeout(r, 600));

      const data = await purchaseMutation.mutateAsync(undefined);
      if (data.is_premium) {
        const { data: me } = await api.get("/users/me");
        const token = useAuthStore.getState().token;
        if (me && token) setAuth(me, token);
      }
      queryClient.invalidateQueries({ queryKey: ["premium-config"] });
      setTransactionId(data.transaction_id ?? `TXN-${Date.now().toString(36).toUpperCase()}`);
      setPaymentStep("done");
      setTimeout(() => {
        setPaymentModal(false);
      }, 2500);
    } catch (e: unknown) {
      setPaymentStep("card");
      const err = e as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      let msg = err?.response?.data?.detail;
      if (!msg && err?.response?.status === 401) msg = t("authorizationRequired");
      if (!msg && err?.response?.status === 500) msg = t("serverError");
      if (!msg && (err?.message?.includes("Network") || err?.message?.includes("timeout")))
        msg = t("backendUnavailable");
      alert(msg ?? t("courseError"));
    } finally {
      setPaying(false);
    }
  };

  if (isPremium) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="w-32 h-32 rounded-3xl flex items-center justify-center mx-auto mb-8 bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-2xl">
            <Crown className="w-16 h-16" />
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            {t("premiumAlreadyActive")}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8">
            {t("premiumEnjoyBenefits")}
          </p>
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          {t("premiumWhatIncluded")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {premiumFeatures.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="flex flex-col items-center text-center p-8 rounded-3xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 group"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform"
                style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
              >
                <Icon className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t(key as TranslationKey)}
                {key === "premiumBenefit1" && premiumCourses.length > 0 && ` (${premiumCourses.length})`}
              </h3>
            </div>
          ))}
        </div>

        {premiumCourses.length > 0 && (
          <div className="mb-10 p-6 rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("premiumCoursesListTitle")}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t("premiumCoursesListDesc")}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {premiumCourses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-lg text-gray-700 dark:text-gray-300">
                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </span>
                  {getLocalizedCourseTitle(c, t as (k: string) => string)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-6 justify-center">
          <Link
            href="/app"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:opacity-90 hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
          >
            {t("backToDashboard")}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/app/courses"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold border-2 border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-lg"
          >
            {t("myCourses")}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-0">
      {/* Payment simulation modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="premium-payment-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] flex flex-col">
            <h2 id="premium-payment-title" className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex-shrink-0">
              {paymentStep === "method" && t("paymentSelectMethod")}
              {paymentStep === "card" && t("paymentCardData")}
              {paymentStep === "loading" && t("paymentProcessing")}
              {paymentStep === "done" && t("paymentSuccess")}
            </h2>
            <div className="min-h-0 max-h-[70vh] overflow-y-auto">
            {paymentStep === "method" && (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t("premiumPlanName")} — {price.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-KZ")}₸
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentCardsSupported")}</p>
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
                      <p className="font-semibold text-gray-900 dark:text-white">{t("paymentKaspiBrand")}</p>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentBankCard")}</p>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentBankCard")}</p>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentBankCard")}</p>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("paymentBankCard")}</p>
                    </div>
                  </button>
                </div>
                <button type="button" onClick={() => setPaymentModal(false)} className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {t("cancel")}
                </button>
              </>
            )}

            {paymentStep === "card" && (
              <>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t("paymentCardData")}</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2.5 dark:bg-gray-700 dark:text-white"
                      placeholder="4111 1111 1111 1111"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">MM/YY</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full border dark:border-gray-600 rounded-lg px-3 py-2.5 dark:bg-gray-700 dark:text-white"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">CVV</label>
                      <input
                        type="text"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full border dark:border-gray-600 rounded-lg px-3 py-2.5 dark:bg-gray-700 dark:text-white"
                        placeholder="123"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPaymentStep("method")} className="py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    {t("cancel")}
                  </button>
                  <button type="button" onClick={handlePay} disabled={paying} className="flex-1 py-2.5 px-4 rounded-xl text-white disabled:opacity-50 font-medium" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>
                    {t("paymentPay")}
                  </button>
                </div>
              </>
            )}

            {paymentStep === "loading" && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {loadingPhase === "connect" && t("paymentConnecting")}
                  {loadingPhase === "process" && t("paymentProcessing")}
                  {loadingPhase === "confirm" && t("paymentConfirming")}
                </p>
              </div>
            )}

            {paymentStep === "done" && (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t("paymentSuccess")}</p>
                {transactionId && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("paymentTransactionId")}: {transactionId}
                  </p>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div
        className="relative rounded-3xl overflow-hidden mb-8 sm:mb-10 p-4 sm:p-6 md:p-8 lg:p-10 text-white"
        style={{
          background: "linear-gradient(135deg, #1a237e 0%, #311b92 40%, #7c3aed 100%)",
          boxShadow: "0 25px 50px -12px rgba(124, 58, 237, 0.35)",
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-400 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-sm font-medium mb-4">
              <Sparkles className="w-5 h-5" />
              {t("premiumBadge")}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold font-montserrat leading-[1.1] mb-3 sm:mb-4 tracking-tight">
              {t("premiumPageTitle")}
            </h1>
            <p className="text-white/90 text-sm sm:text-base md:text-xl max-w-2xl leading-relaxed">
              {t("premiumPageSubtitle")}
            </p>
          </div>
          <div className="hidden md:flex w-28 h-28 lg:w-36 lg:h-36 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <Crown className="w-14 h-14 lg:w-16 lg:h-16 text-white" />
          </div>
        </div>
      </div>

      {/* Free vs Premium Comparison */}
      <div className="mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-6 sm:mb-8 tracking-tight">
          {t("freeVsPremiumTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Free Plan */}
          <div className="rounded-3xl p-4 sm:p-6 lg:p-7 bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700">
            <div className="text-center mb-5">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {t("freePlan")}
              </h3>
            </div>
            <ul className="space-y-3 sm:space-y-4">
              {freeLimits.map((key) => (
                <li key={key} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </span>
                  <span className="text-sm sm:text-base">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium Plan */}
          <div
            className="relative rounded-3xl p-4 sm:p-6 lg:p-7 border-2 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(91, 33, 182, 0.1) 100%)",
              borderColor: "rgba(124, 58, 237, 0.3)",
            }}
          >
            <div className="absolute top-0 right-0 px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold rounded-bl-2xl">
              {t("premiumPopular")}
            </div>
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white mb-3">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {t("premiumPlan")}
              </h3>
            </div>
            <ul className="space-y-3 sm:space-y-4">
              {premiumFeatures.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </span>
                  <span className="text-sm sm:text-base">{t(key as TranslationKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Premium Features Grid */}
      <div className="mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-7 tracking-tight">
          {t("premiumWhatIncluded")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {premiumFeatures.map(({ icon: Icon, key }, i) => (
            <div
              key={key}
              className="flex flex-col items-center text-center p-5 lg:p-6 rounded-3xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div
                className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform"
                style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
              >
                <Icon className="w-7 h-7 lg:w-8 lg:h-8" />
              </div>
              <h3 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {t(key as TranslationKey)}
                {key === "premiumFeature1" && premiumCourses.length > 0 && ` (${premiumCourses.length})`}
              </h3>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing card */}
      <div
        className="relative rounded-3xl overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 via-indigo-50/90 to-violet-50 dark:from-gray-800/95 dark:via-purple-900/20 dark:to-gray-800/95 mb-10"
        style={{
          boxShadow: "0 20px 40px rgba(124, 58, 237, 0.15)",
        }}
      >
        <div className="absolute top-0 right-0 px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold rounded-bl-2xl">
          {t("premiumPopular")}
        </div>
        <div className="p-6 md:p-8 lg:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                {t("premiumPlanName")}
              </h2>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-3">
                {t("premiumPlanDesc")}
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl md:text-5xl font-bold text-purple-700 dark:text-purple-400">
                  {price.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-KZ")}
                </span>
                <span className="text-xl text-gray-500">₸</span>
                <span className="text-base text-gray-500">/ {t("premiumOneTime")}</span>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={openPaymentModal}
                disabled={loading || purchaseMutation.isPending}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-white text-base transition-all hover:scale-105 hover:shadow-xl disabled:opacity-70 disabled:hover:scale-100 disabled:hover:shadow-none"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
                  boxShadow: "0 10px 30px rgba(124, 58, 237, 0.4)",
                }}
              >
                {loading || purchaseMutation.isPending ? (
                  t("loading")
                ) : (
                  <>
                    {t("premiumBuyNow")}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t-2 border-purple-200/60 dark:border-purple-900/50">
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["premiumInclude1", "premiumInclude2", "premiumInclude3", "premiumInclude4", "premiumInclude5", "premiumInclude6", "premiumInclude7", "premiumInclude8", "premiumInclude9", "premiumInclude10", "premiumInclude11", "premiumInclude12"] as const).map((key) => (
                <li key={key} className="flex items-center gap-3 text-base text-gray-700 dark:text-gray-300">
                  <span className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Premium courses list */}
      {premiumCourses.length > 0 && (
        <div className="mb-10 p-6 lg:p-7 rounded-3xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {t("premiumCoursesListTitle")}
            </h2>
          </div>
          <p className="text-base text-gray-600 dark:text-gray-400 mb-4">
            {t("premiumCoursesListDesc")}
          </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {premiumCourses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-lg text-gray-700 dark:text-gray-300">
                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </span>
                  {getLocalizedCourseTitle(c, t as (k: string) => string)}
                </li>
              ))}
            </ul>
        </div>
      )}

      {/* Trust badge */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-lg text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-green-500" />
          {t("premiumSecurePayment")}
        </span>
        <span className="flex items-center gap-3">
          <Star className="w-6 h-6 text-amber-500" />
          {t("premiumInstantAccess")}
        </span>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/app"
          className="text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 text-sm font-medium transition-colors"
        >
          ← {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
