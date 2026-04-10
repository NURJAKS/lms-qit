"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, User, ClipboardList, Bot } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
 
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
 
export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isTeacher } = useAuthStore();

  const { data: unreviewedCount = 0 } = useQuery({
    queryKey: ["teacher-submissions-inbox-count"],
    queryFn: async () => {
      const { data } = await api.get<any[]>("/teacher/submissions/inbox?status=pending");
      return data.length;
    },
    enabled: isTeacher(),
    staleTime: 30000,
  });
 
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
        badge: unreviewedCount > 0 ? unreviewedCount : undefined,
      },
    ] : [
      {
        href: "/app/courses",
        icon: BookOpen,
        label: t("studentCoursesTabHint"),
      },
           {
        href: "/app/qazaq-ai",
        icon: Bot,
        label: t("qazaqAiNav"),
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
        {navItems.map(({ href, icon: Icon, label, badge }) => {
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
              <div className={`relative p-1 rounded-xl transition-all duration-300 ${isActive ? "bg-[var(--qit-accent)]/10" : ""}`}>
                <Icon className={`w-6 h-6 ${isActive ? "drop-shadow-[0_0_8px_rgba(255,64,129,0.5)]" : ""}`} />
                {badge !== undefined && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#1a2238]">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
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
