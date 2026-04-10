"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/store/notificationStore";
import { useTheme } from "@/context/ThemeContext";
import { CreditCard, Smartphone, Loader2 } from "lucide-react";
import { getModalStyle, getTextColors } from "@/utils/themeStyles";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

type PaymentStep = "method" | "card" | "loading" | "done";
type LoadingPhase = "connect" | "process" | "confirm";

interface PendingPayment {
  id: number;
  course_id: number;
  course_title: string | null;
  amount: number;
}

export function ApprovedApplicationPaymentModal({
  payment,
  onClose,
  onSuccess,
}: {
  payment: PendingPayment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const queryClient = useQueryClient();
  const [step, setStep] = useState<PaymentStep>("method");
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("connect");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paying, setPaying] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const handlePay = async () => {
    if (!cardNumber || !cardExpiry || !cardCvv) {
      toast.error(t("paymentFillAllFields"));
      return;
    }
    setPaying(true);
    setStep("loading");
    setLoadingPhase("connect");
    setTransactionId(null);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setLoadingPhase("process");
      await new Promise((r) => setTimeout(r, 1200));
      setLoadingPhase("confirm");
      const { data } = await api.post<{ transaction_id?: string }>(`/payments/${payment.id}/confirm`);
      setTransactionId(data.transaction_id ?? `TXN-${payment.id.toString().padStart(8, "0")}`);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["payments-pending"] });
      // Keep "done" state longer for user to read the message
    } catch (e) {
      setStep("card");
      setPaying(false);
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail ?? t("error"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] flex flex-col border-0 overflow-hidden relative backdrop-blur-xl" style={modalStyle}>
        {step !== "done" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:opacity-80 z-10"
            style={{ color: textColors.secondary }}
          >
            ×
          </button>
        )}

        <h2 className="text-2xl font-bold mb-6 text-center flex-shrink-0" style={{ color: textColors.primary }}>
          {step === "method" && t("paymentSelectMethod")}
          {step === "card" && t("paymentEnterCardData")}
          {step === "loading" && t("paymentProcessing")}
          {step === "done" && t("paymentAccepted")}
        </h2>

        <div className="min-h-0 max-h-[85vh] overflow-y-auto">
        {step === "method" && (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-6 border border-blue-100 dark:border-blue-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{t("goToPayment")}</span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{payment.amount.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US")} ₸</span>
              </div>
              <p className="text-xs text-blue-500/80 truncate">{payment.course_title ? getLocalizedCourseTitle({ title: payment.course_title } as any, t) : ""}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-8">
              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{t("paymentBankCard")}</p>
                  <p className="text-xs text-gray-500">{t("paymentCardsSupported")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-red-500 hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform font-bold italic">
                  K
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">Kaspi.kz</p>
                  <p className="text-xs text-gray-500">{t("paymentViaApp")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-green-500 hover:bg-green-50/30 dark:hover:bg-green-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">Halyk Bank</p>
                  <p className="text-xs text-gray-500">Halyk Pay / QR</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{t("eurasianBank")}</p>
                  <p className="text-xs text-gray-500">{t("paymentBankCard")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-yellow-500 hover:bg-yellow-50/30 dark:hover:bg-yellow-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{t("tinkoff")}</p>
                  <p className="text-xs text-gray-500">{t("paymentBankCard")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{t("jusan")}</p>
                  <p className="text-xs text-gray-500">{t("paymentBankCard")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("card")}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{t("forte")}</p>
                  <p className="text-xs text-gray-500">{t("paymentBankCard")}</p>
                </div>
              </button>
            </div>
          </>
        )}

        {step === "card" && (
          <>
            <div className="bg-gray-100 dark:bg-gray-700/50 rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div className="w-10 h-7 bg-yellow-400/80 rounded-md" />
                  <CreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none px-0 py-1 text-lg font-mono tracking-widest placeholder-gray-400"
                    placeholder={t("cardNumberPlaceholder")}
                    maxLength={19}
                  />
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none px-0 py-1 text-sm font-mono placeholder-gray-400"
                        placeholder={t("paymentExpiryPlaceholder")}
                        maxLength={5}
                      />
                    </div>
                    <div className="w-20">
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none px-0 py-1 text-sm font-mono placeholder-gray-400"
                        placeholder={t("cardCvvPlaceholder")}
                        maxLength={3}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("method")}
                className="py-3 px-6 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t("back")}
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={paying}
                className="flex-1 py-3 px-6 rounded-2xl text-white font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {paying ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t("paymentPay")}...
                  </div>
                ) : (
                  t("paymentPayAmount").replace("{amount}", payment.amount.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US"))
                )}
              </button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center py-12">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-full border-4 border-gray-100 dark:border-gray-700" />
              <Loader2 className="absolute top-0 left-0 w-20 h-20 animate-spin text-blue-500" style={{ borderWidth: '4px' }} />
            </div>
            <p className="text-xl font-semibold text-gray-800 dark:text-white mb-2 text-center">
              {loadingPhase === "connect" && t("paymentConnecting")}
              {loadingPhase === "process" && t("paymentProcessingData")}
              {loadingPhase === "confirm" && t("paymentConfirming")}
            </p>
            <p className="text-gray-500 text-center text-sm px-4">{t("paymentDoNotClose")}</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-[bounce_1s_ease-in-out]">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/40">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t("paymentSuccess")}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-8 px-4">
              {t("paymentManagerNotification")}
            </p>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:opacity-90 transition-all active:scale-95 shadow-xl"
            >
              {t("paymentReturnToPlatform")}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
