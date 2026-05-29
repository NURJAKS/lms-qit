"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/api/client";
import { useSidebar } from "@/context/SidebarContext";
import { AppDashboardSidebar } from "@/components/dashboard/AppDashboardSidebar";
import { AppDashboardHeader } from "@/components/dashboard/AppDashboardHeader";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { AIChatWidget } from "@/components/ai/AIChatWidget";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { collapsed } = useSidebar();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHasHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token && typeof window !== "undefined") {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const redirect = currentPath.startsWith("/app")
        ? `?redirect=${encodeURIComponent(currentPath)}`
        : "";
      router.replace(`/login${redirect}`);
    }
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (token) {
      api.post("/schedule/check-reminders").catch(() => {});
    }
  }, [token]);

  if (!hasHydrated || !token) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-100 dark:bg-[var(--qit-bg-deep)]">
      <AppDashboardSidebar />
      <div
        className={`min-h-screen min-w-0 flex flex-col transition-[padding-left] duration-300 bg-gray-100 dark:bg-[var(--qit-bg-deep)] ${
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-72"
        }`}
      >
        <AppDashboardHeader />
        <main className="flex-1 min-w-0 pt-16 sm:pt-14 lg:pt-0 bg-gray-100 dark:bg-[var(--qit-bg-deep)]">
          <div className="pt-2 pb-28 lg:pb-6 px-3 sm:px-4 md:px-6">
            <div className="max-w-7xl mx-auto w-full min-w-0">{children}</div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <AIChatWidget />
    </div>
  );
}
