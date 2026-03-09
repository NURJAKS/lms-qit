"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/api/client";
import { useSidebar } from "@/context/SidebarContext";
import { AppDashboardSidebar } from "@/components/dashboard/AppDashboardSidebar";
import { AppDashboardHeader } from "@/components/dashboard/AppDashboardHeader";
import { LandingChatWidget } from "@/components/landing/LandingChatWidget";

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
    if (!token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (token) {
      api.post("/schedule/check-reminders").catch(() => {});
    }
  }, [token]);

  if (!hasHydrated || !token) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[var(--qit-bg-deep)]">
      <AppDashboardSidebar />
      <div
        className={`min-h-screen flex flex-col pt-16 lg:pt-0 transition-[padding-left] duration-300 bg-gray-100 dark:bg-[var(--qit-bg-deep)] ${
          collapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        <AppDashboardHeader />
        <main className="flex-1 pt-0 bg-gray-100 dark:bg-[var(--qit-bg-deep)]">
          <div className="pt-2 pb-6 px-4 md:px-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </div>
        </main>
      </div>
      <LandingChatWidget />
    </div>
  );
}
