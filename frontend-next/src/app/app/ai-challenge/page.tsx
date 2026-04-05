"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AIChallengeListPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
      return;
    }
    if (user) {
      // Always redirect to the "pretty" game route
      router.replace("/app/ai-challenge/1");
    }
  }, [router, user]);

  // Эта страница служит только редиректом.
  // Пока не определили роль пользователя - ничего не показываем.
  return null;
}
