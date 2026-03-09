"use client";

import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedModuleTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";

export type PathNode = "completed" | "current" | "locked";

export interface FlattenedTopic {
  module_id: number;
  module_title: string;
  module_order: number;
  topic_id: number;
  topic_title: string;
  topic_order: number;
  nodeType: PathNode;
}

interface LearningPathProps {
  courseId: number;
  items: FlattenedTopic[];
}

function TopicBlock({
  item,
  courseId,
  t,
}: {
  item: FlattenedTopic;
  courseId: number;
  t: (k: TranslationKey) => string;
}) {
  const base = "rounded-lg px-4 py-3 font-medium transition-colors min-w-[140px] text-center";
  const completed =
    "bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700";
  const current =
    "bg-orange-500 dark:bg-orange-600 text-white hover:bg-orange-600 dark:hover:bg-orange-700";
  const locked =
    "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed";

  const style =
    item.nodeType === "completed"
      ? completed
      : item.nodeType === "current"
        ? current
        : locked;

  const content = (
    <span className="flex items-center justify-center gap-2">
      {item.nodeType === "completed" && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />}
      {item.nodeType === "locked" && <Lock className="h-4 w-4 shrink-0" />}
      <span className="truncate">{item.topic_title}</span>
    </span>
  );

  if (item.nodeType === "locked") {
    return (
      <div title={item.topic_title} className={`${base} ${style}`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/app/courses/${courseId}/topic/${item.topic_id}`}
      title={item.topic_title}
      className={`block ${base} ${style}`}
    >
      {content}
    </Link>
  );
}

export function LearningPath({ courseId, items }: LearningPathProps) {
  const { t } = useLanguage();

  if (items.length === 0) return null;

  const byModule = items.reduce<FlattenedTopic[][]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last[0]?.module_id === item.module_id) {
      last.push(item);
    } else {
      acc.push([item]);
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {byModule.map((moduleItems) => (
        <div key={moduleItems[0].module_id}>
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
            {t("courseUnit")} {moduleItems[0].module_order}:{" "}
            {getLocalizedModuleTitle(moduleItems[0].module_title, t as any)}
          </h3>
          <div className="flex flex-wrap gap-2">
            {moduleItems.map((item) => (
              <TopicBlock
                key={item.topic_id}
                item={{ ...item, topic_title: getLocalizedTopicTitle(item.topic_title, t as any) }}
                courseId={courseId}
                t={t}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
