"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { ShopPurchaseManagement } from "@/components/admin/ShopPurchaseManagement";

export default function AdminShopPage() {
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

  return <ShopPurchaseManagement />;
}
