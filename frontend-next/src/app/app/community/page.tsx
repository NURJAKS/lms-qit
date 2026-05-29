"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { StudentGroupChat } from "@/components/dashboard/StudentGroupChat";

export default function CommunityPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  if (user?.role === "parent") {
    return null;
  }

  return <StudentGroupChat />;
}
