"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ConfirmResult {
  message: string;
  temp_login: string;
  temp_password: string;
  parent_temp_login?: string | null;
  parent_temp_password?: string | null;
  course_title: string;
  student_name: string;
}

export default function ConfirmPurchasePage() {
  const params = useParams();
  const token = params.token as string;
  const { t } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const confirmPurchase = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const res = await fetch(`${backendUrl}/api/applications/confirm/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.detail || t("confirmError"));
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("success");
    } catch {
      setErrorMessage(t("confirmServerError"));
      setStatus("error");
    }
  }, [token, t]);

  useEffect(() => {
    if (token) {
      confirmPurchase();
    }
  }, [token, confirmPurchase]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "rgba(26, 34, 56, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {status === "loading" && (
          <div className="flex flex-col items-center py-16 px-8">
            <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-6" />
            <h2 className="text-xl font-bold text-white mb-2">
              {t("confirmPurchaseLoading")}
            </h2>
            <p className="text-gray-400 text-center">
              {t("confirmPurchaseWait")}
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">{t("confirmErrorTitle")}</h2>
            <p className="text-gray-400 mb-8">{errorMessage}</p>
            <Link
              href="/courses"
              className="px-8 py-3 rounded-2xl font-bold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #FF4181, #1a237e)" }}
            >
              {t("confirmBackToCourses")}
            </Link>
          </div>
        )}

        {status === "success" && result && (
          <>
            <div
              className="px-8 py-6 text-center"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
              }}
            >
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 animate-[bounce_1s_ease-in-out_3]">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {t("confirmPaid")}
              </h1>
              <p className="text-emerald-100 text-sm">
                {t("confirmSuccess")}
              </p>
            </div>

            <div className="px-8 py-8">
              <p className="text-gray-300 text-center text-lg mb-2">
                {t("confirmCongrats")} <span className="text-white font-semibold">{result.student_name}</span>!
              </p>
              <p className="text-gray-400 text-center mb-8">
                {t("confirmAddedToCourse")}{" "}
                <span className="text-blue-400 font-semibold">
                  &laquo;{result.course_title}&raquo;
                </span>
                . {t("confirmGoodLuck")}
              </p>

              <div className="space-y-4 mb-8">
                <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
                  <p className="font-bold text-white mb-3 text-sm">
                    {t("confirmStudentLogin")}
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">{t("confirmLoginLabel")}</span>
                      <span className="font-mono font-bold text-blue-400">
                        {result.temp_login}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">{t("confirmPasswordLabel")}</span>
                      <span className="font-mono font-bold text-blue-400">
                        {result.temp_password}
                      </span>
                    </div>
                  </div>
                </div>

                {result.parent_temp_login && (
                  <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700/50">
                    <p className="font-bold text-white mb-3 text-sm">
                      {t("confirmParentLogin")}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">{t("confirmLoginLabel")}</span>
                        <span className="font-mono font-bold text-blue-400">
                          {result.parent_temp_login}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">{t("confirmPasswordLabel")}</span>
                        <span className="font-mono font-bold text-blue-400">
                          {result.parent_temp_password}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="w-full py-4 rounded-2xl font-bold text-white text-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #FF4181, #1a237e)",
                  }}
                >
                  {t("confirmGoToLogin")}
                </Link>
                <Link
                  href="/courses"
                  className="w-full py-3 rounded-2xl font-semibold text-gray-400 text-center border border-gray-700 hover:border-gray-600 hover:text-gray-300 transition-all"
                >
                  {t("confirmBackToCourses")}
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
