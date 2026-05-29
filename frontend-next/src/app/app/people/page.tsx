"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { PeopleList } from "@/components/people/PeopleList";
import { BlurFade } from "@/components/ui/blur-fade";
import { getTextColors } from "@/utils/themeStyles";
import { GraduationCap, Users, UserCircle } from "lucide-react";

export default function PeoplePage() {
  const router = useRouter();
  const { user, isAdmin, isTeacher } = useAuthStore();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"students" | "parents" | "teachers" | "curators">("students");
  const [hasHydrated, setHasHydrated] = useState(false);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHasHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const canAccess = isAdmin() || isTeacher() || user?.role === "curator";
    if (!canAccess) {
      router.replace("/app");
    }
  }, [hasHydrated, user, isAdmin, isTeacher, router]);

  if (!hasHydrated || !user) {
    return null;
  }

  const canAccess = isAdmin() || isTeacher() || user?.role === "curator";
  if (!canAccess) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <BlurFade delay={0.1} duration={0.6} blur="8px" offset={20}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8" style={{ color: textColors.primary }}>
          {t("peopleList")}
        </h1>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.15} duration={0.6} blur="8px" offset={20}>
        <div className="pb-4 border-b" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
          <div className="flex flex-wrap gap-2 w-full">
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`flex flex-1 sm:flex-none justify-center items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 text-[13px] sm:text-sm font-medium rounded-xl transition-all relative shrink-0 ${
              activeTab === "students"
                ? "text-white"
                : isDark
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            style={
              activeTab === "students"
                ? {
                    background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                    boxShadow: "0 4px 12px rgba(255, 65, 129, 0.3)",
                  }
                : undefined
            }
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t("studentsTab")}</span>
            {activeTab === "students" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{
                  background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("parents")}
            className={`flex flex-1 sm:flex-none justify-center items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 text-[13px] sm:text-sm font-medium rounded-xl transition-all relative shrink-0 ${
              activeTab === "parents"
                ? "text-white"
                : isDark
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            style={
              activeTab === "parents"
                ? {
                    background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                    boxShadow: "0 4px 12px rgba(255, 65, 129, 0.3)",
                  }
                : undefined
            }
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t("parentsTab")}</span>
            {activeTab === "parents" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{
                  background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("teachers")}
            className={`flex flex-1 sm:flex-none justify-center items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 text-[13px] sm:text-sm font-medium rounded-xl transition-all relative shrink-0 ${
              activeTab === "teachers"
                ? "text-white"
                : isDark
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            style={
              activeTab === "teachers"
                ? {
                    background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                    boxShadow: "0 4px 12px rgba(255, 65, 129, 0.3)",
                  }
                : undefined
            }
          >
            <UserCircle className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t("teachersTab")}</span>
            {activeTab === "teachers" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{
                  background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("curators")}
            className={`flex flex-1 sm:flex-none justify-center items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 text-[13px] sm:text-sm font-medium rounded-xl transition-all relative shrink-0 ${
              activeTab === "curators"
                ? "text-white"
                : isDark
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            style={
              activeTab === "curators"
                ? {
                    background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                    boxShadow: "0 4px 12px rgba(255, 65, 129, 0.3)",
                  }
                : undefined
            }
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t("curatorsTab")}</span>
            {activeTab === "curators" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{
                  background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                }}
              />
            )}
          </button>
          </div>
        </div>
      </BlurFade>

      {/* Content */}
      <BlurFade delay={0.2} duration={0.6} blur="8px" offset={20}>
        {activeTab === "students" ? (
          <PeopleList role="student" />
        ) : activeTab === "parents" ? (
          <PeopleList role="parent" />
        ) : activeTab === "teachers" ? (
          <PeopleList role="teacher" />
        ) : (
          <PeopleList role="curator" />
        )}
      </BlurFade>
    </div>
  );
}
