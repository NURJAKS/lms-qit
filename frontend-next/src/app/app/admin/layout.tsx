"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { AuroraBackground } from "@/components/admin/AuroraBackground";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [hasHydrated, setHasHydrated] = useState(false);
  const user = useAuthStore((s) => s.user);
  const canAccessAdmin = user && ["admin", "director", "curator"].includes(user.role);

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
    if (!canAccessAdmin) {
      router.replace("/app");
    }
  }, [hasHydrated, user, canAccessAdmin, router]);

  if (!hasHydrated || !user || !canAccessAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen relative bg-gray-50 dark:bg-[#0F172A] transition-colors duration-300">
      <AuroraBackground />
      <div className="relative z-10 p-6">{children}</div>
    </div>
  );
}
