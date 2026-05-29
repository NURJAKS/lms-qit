"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import ReviewManagement from "@/components/admin/ReviewManagement";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

export default function AdminReviewsPage() {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const isDark = theme === "dark";
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

    return (
        <div>
            <h1 className={`text-3xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
                {t("adminNavReviews")}
            </h1>
            <ReviewManagement />
        </div>
    );
}
