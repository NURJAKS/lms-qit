"use client";

import { useSearchParams } from "next/navigation";
import { AIPlanTab } from "@/components/ai/AIPlanTab";

/** Тікелей /app/ai-challenge/plan беті; параметры из URL для генерации плана. */
export default function AIChallengePlanPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId") ?? "";
  const level = searchParams.get("level") ?? "intermediate";
  const weakTopics = searchParams.get("weakTopics") ?? "";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <AIPlanTab 
        courseId={courseId} 
        level={level} 
        weakTopics={weakTopics}
      />
    </div>
  );
}
