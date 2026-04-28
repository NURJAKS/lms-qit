"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { User } from "@/types";
import { BookOpen, GraduationCap } from "lucide-react";
import { AppHeader } from "@/components/common/AppHeader";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(["student", "teacher"]),
});

type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);
  const { t } = useLanguage();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: "student" },
  });

  const getErrorMessage = (e: unknown): string => {
    const err = e as {
      response?: {
        status?: number;
        data?: { detail?: string | Array<{ msg?: string }> };
      };
      message?: string;
      code?: string;
    };
    if (!err.response) {
      if (err.code === "ECONNREFUSED" || err.code === "ERR_NETWORK" || err.message?.includes("Network") || err.code === "ECONNABORTED") return t("serverError");
      return err.message || t("registerFailed");
    }
    const d = err.response.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return d.map((x) => x.msg).join(". ");
    if (err.response.status === 403) return t("serverError");
    return t("registerFailed");
  };

  const onSubmit = async (data: Form) => {
    setError("");
    try {
      const { data: res } = await api.post<{
        user: User;
        access_token: string;
      }>("/auth/register", data);
      setAuth(res.user, res.access_token);
      router.replace("/app");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="flex justify-end w-full max-w-[880px] mb-4 relative z-20">
        <AppHeader />
      </div>
      <div className="absolute inset-0 bg-[#f5f7ff] dark:bg-gray-900" />
      <div className="absolute inset-0 bg-white/20 dark:bg-black/10 backdrop-blur-2xl" />
      <div className="relative z-10 w-full max-w-[880px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col lg:flex-row">
        <div className="lg:w-[45%] bg-gradient-to-br from-[#e8e0f5] via-[#f5f0fa] to-[#ebe5f2] dark:from-indigo-900/30 dark:via-indigo-800/20 dark:to-violet-900/30 p-5 sm:p-8 lg:p-10 flex flex-col justify-center">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {t("platform")}
            </span>
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-3">
            {t("register")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {t("registerInstructions")}
          </p>
          <div className="hidden sm:flex sm:items-center sm:justify-center">
            <img
              src="/e-learning-icon.png"
              alt=""
              className="w-full max-w-[200px] h-auto object-contain"
            />
          </div>
        </div>

        <div className="lg:w-[55%] p-5 sm:p-8 lg:p-10 flex flex-col justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t("createAccount")}
          </p>
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <GraduationCap
                className="w-7 h-7 text-indigo-600"
                strokeWidth={1.5}
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                QIT
              </span>
              <span className="text-xl font-bold text-indigo-600 tracking-tight">
                {t("loginBrandSubtitle")}
              </span>
            </div>
            <p className="text-xs text-indigo-600 font-medium mt-1 uppercase tracking-wider">
              {t("learningPlatform")}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5"
              >
                {t("fullName")}:
              </label>
              <input
                {...register("full_name")}
                id="full_name"
                placeholder={t("namePlaceholder")}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {errors.full_name && (
                <p className="text-red-500 text-xs mt-1">{t("fullName")}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5"
              >
                Email:
              </label>
              <input
                {...register("email")}
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{t("emailError")}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5"
              >
                {t("password")}:
              </label>
              <input
                {...register("password")}
                id="password"
                type="password"
                placeholder={t("placeholderPassword")}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{t("minPassword")}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5"
              >
                {t("role")}:
              </label>
              <select
                {...register("role")}
                id="role"
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                <option value="student">{t("student")}</option>
                <option value="teacher">{t("teacher")}</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors mt-2 touch-manipulation"
            >
              {t("register")}
            </button>
          </form>
          <p className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("haveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              {t("login")}
            </Link>
          </p>
          <Link
            href="/"
            className="mt-3 block text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {t("backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
