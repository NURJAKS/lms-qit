"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { AdminOverview } from "@/components/admin/AdminOverview";

export default function AdminOverviewPage() {
  const router = useRouter();
  const { user, canManageUsers } = useAuthStore();

  useEffect(() => {
    if (user && !canManageUsers()) {
      router.replace("/app/admin");
    }
  }, [user, canManageUsers, router]);

  if (!user || !canManageUsers()) {
    return null;
  }

  return <AdminOverview />;
}
