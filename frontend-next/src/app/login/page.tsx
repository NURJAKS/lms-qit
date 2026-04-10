"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import type { User } from "@/types";
import { BookOpen, GraduationCap, Eye, EyeOff } from "lucide-react";
import { AppHeader } from "@/components/common/AppHeader";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type Form = z.infer<typeof schema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const registered = searchParams.get("registered") === "1";
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

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
      if (err.code === "ECONNREFUSED" || err.code === "ERR_NETWORK" || err.message?.includes("Network")) return t("serverError");
      if (err.code === "ECONNABORTED") return t("serverError");
      return err.message || t("loginFailed");
    }
    const d = err.response.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return d.map((x) => x.msg).join(". ");
    if (err.response.status === 401) return t("invalidCredentials");
    if (err.response.status === 403) return t("serverError");
    return t("loginFailed");
  };

  const onSubmit = async (data: Form) => {
    setError("");
    try {
      const { data: tokenData } = await api.post<{ access_token: string }>(
        "/auth/login",
        data
      );
      const { data: userData } = await api.get<User>("/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      setAuth(userData, tokenData.access_token);
      queryClient.clear();
      const redirect = searchParams.get("redirect");
      router.replace(redirect && redirect.startsWith("/") ? redirect : "/app");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <AppHeader />
      </div>
      <div className="absolute inset-0 bg-[#f5f7ff] dark:bg-gray-900" />
      <div className="absolute inset-0 bg-white/20 dark:bg-black/10 backdrop-blur-2xl" />
      <div className={cn(
        "relative z-10 w-full max-w-[980px] min-h-[580px] sm:min-h-[620px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col lg:flex-row",
        isDark ? "flex-col-reverse lg:flex-row-reverse" : ""
      )}>
        <motion.div 
          layout
          transition={{
            layout: { type: "spring", stiffness: 160, damping: 24 },
            opacity: { duration: 0.2 }
          }}
          whileHover={{ scale: 1.005 }}
          className="lg:w-[45%] bg-gradient-to-br from-[#e8e0f5] via-[#f5f0fa] to-[#ebe5f2] dark:from-indigo-900/40 dark:via-indigo-800/20 dark:to-violet-900/40 p-6 sm:p-8 lg:p-10 flex flex-col justify-center relative z-10 border-r border-gray-100 dark:border-gray-700/50 lg:border-r-0"
        >
          <Link href="/" className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {t("platform")}
            </span>
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-3">
            {t("welcome")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {t("loginInstructions")}
          </p>
          <div className="hidden sm:flex sm:items-center sm:justify-center">
            <img
              src="/e-learning-icon.png"
              alt=""
              className="w-full max-w-[200px] h-auto object-contain"
            />
          </div>
        </motion.div>

        <motion.div 
          layout
          transition={{
            layout: { type: "spring", stiffness: 160, damping: 24 },
            opacity: { duration: 0.2 }
          }}
          className="lg:w-[55%] p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-white dark:bg-gray-800 relative z-0"
        >
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <GraduationCap
                className="w-7 h-7 text-indigo-600"
                strokeWidth={1.5}
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Білім
              </span>
              <span className="text-xl font-bold text-indigo-600 tracking-tight">
                платформасы
              </span>
            </div>
            <p className="text-xs text-indigo-600 font-medium mt-1 uppercase tracking-wider">
              {t("learningPlatform")}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {registered && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
                {t("registerSuccess")}
              </div>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5"
              >
                {t("loginLabel")}
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
              <div className="relative">
                <input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("placeholderPassword")}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors touch-manipulation"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {t("passwordRequired")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="remember"
                className="text-sm text-gray-600 dark:text-gray-300"
              >
                {t("rememberMe")}
              </label>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors touch-manipulation"
            >
              {t("signIn")}
            </button>
          </form>

          <Link
            href="/"
            className="mt-6 block text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {t("backToHome")}
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f5f7ff] dark:bg-gray-900">...</div>}>
      <LoginContent />
    </Suspense>
  );
}
