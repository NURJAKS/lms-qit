"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CatalogPageContent } from "@/app/courses/page";

export default function AppCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--qit-primary)]" />
        </div>
      }
    >
      <CatalogPageContent embedded={true} />
    </Suspense>
  );
}
