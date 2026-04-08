"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Trophy, User, Users, ClipboardList } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
 
export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isTeacher } = useAuthStore();
 
  const navItems = [
    {
      href: "/app",
      icon: LayoutDashboard,
      label: t("dashboard"),
    },
    ...(isTeacher() ? [
      {
        href: "/app/teacher/courses",
        icon: BookOpen,
        label: t("teacherCoursesTab"),
      },
      {
        href: "/app/teacher/courses/review",
        icon: ClipboardList,
        label: t("unreviewedAssignments"),
      },
    ] : [
      {
        href: "/app/courses",
        icon: BookOpen,
        label: t("studentCoursesTabHint"),
      },
      {
        href: "/app/leaderboard",
        icon: Trophy,
        label: t("rating"),
      }
    ]),
    {
      href: "/app/profile",
      icon: User,
      label: t("profile"),
    },
  ];

  const activeHref = navItems
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-gray-200/50 dark:border-white/10 px-4 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto gap-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === activeHref;
          
          return (
            <Link
              key={href}
              href={href}
              className={`relative bottom-nav-item active-tap flex flex-col items-center justify-center min-w-0 flex-1 px-1 transition-all duration-300 ${
                isActive 
                  ? "text-[var(--qit-accent)] dark:text-[var(--qit-accent)] scale-110" 
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              <div className={`p-1 rounded-xl transition-all duration-300 ${isActive ? "bg-[var(--qit-accent)]/10" : ""}`}>
                <Icon className={`w-6 h-6 ${isActive ? "drop-shadow-[0_0_8px_rgba(255,64,129,0.5)]" : ""}`} />
              </div>
              <span
                className={`mt-0.5 max-w-full truncate text-center text-[10px] font-bold transition-all duration-300 ${isActive ? "opacity-100" : "opacity-80"}`}
                title={label}
              >
                {label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--qit-accent)] shadow-[0_0_8px_rgba(255,64,129,0.8)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
