"use client";

import { useMemo, useState } from "react";
import { X, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { formatCriteriaCountRu } from "./assignmentInstructionUtils";
import { cn } from "@/lib/utils";
import { interpolateTemplate } from "@/utils/interpolateTemplate";

export type RubricCriterion = {
  id: number;
  name: string;
  max_points: number;
  description?: string;
  levels?: { text: string; points: number }[];
};

function formatCriteriaCount(n: number, lang: Lang, t: any): string {
  if (lang === "ru") return formatCriteriaCountRu(n);
  if (lang === "kk") {
    return `${n} ${t("rubricCriterion_1")}`;
  }
  return n === 1 ? `1 ${t("rubricCriterion_1")}` : `${n} ${t("rubricCriterion_5")}`;
}

function formatPointsLabel(points: number, lang: Lang, t: ReturnType<typeof useLanguage>["t"]): string {
  const p = points % 1 === 0 ? String(points) : points.toFixed(1);
  return t("teacherRubricLevelPoints").replace("{points}", p);
}

export function AssignmentRubricExplorer({
  assignmentTitle,
  rubric,
}: {
  assignmentTitle: string;
  rubric: RubricCriterion[];
}) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const total = useMemo(
    () => rubric.reduce((s, c) => s + (Number(c.max_points) || 0), 0),
    [rubric]
  );

  if (!rubric.length) return null;

  const pillLabel = t("teacherRubricPill")
    .replace("{criteria}", formatCriteriaCount(rubric.length, lang as Lang, t))
    .replace("{points}", total % 1 === 0 ? String(total) : total.toFixed(1));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-500 dark:hover:bg-gray-800 sm:w-auto sm:max-w-none"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a73e8] text-white">
          <ClipboardList className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 leading-snug">{pillLabel}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-2xl">
            <div className="flex shrink-0 flex-col gap-1 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("teacherRubricDetailTitle")}</h2>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  onClick={() => setOpen(false)}
                  aria-label={t("close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("teacherRubricDetailHint")}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{assignmentTitle}</h3>
                <span className="text-lg font-semibold text-gray-600 dark:text-gray-300">
                  {interpolateTemplate(t("teacherRubricDetailTotal"), {
                    points: total % 1 === 0 ? String(total) : total.toFixed(1),
                  })}
                </span>
              </div>

              <div className="space-y-3">
                {rubric.map((c) => {
                  const isOpen = expanded[c.id] ?? true;
                  const levels = [...(c.levels ?? [])].sort((a, b) => b.points - a.points);
                  const maxStr = Number(c.max_points) % 1 === 0 ? String(c.max_points) : Number(c.max_points).toFixed(1);

                  return (
                    <div
                      key={c.id}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900/80"
                        onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !isOpen }))}
                      >
                        <span className="text-base font-semibold text-[#1a73e8] dark:text-blue-400">{c.name}</span>
                        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                          {interpolateTemplate(t("teacherRubricCriterionMax"), { points: maxStr })}
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      </button>

                      {c.description?.trim() ? (
                        <p className="border-t border-gray-100 px-4 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
                          {c.description}
                        </p>
                      ) : null}

                      {isOpen ? (
                        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                          {levels.length > 0 ? (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {levels.map((lv, idx) => (
                                <div
                                  key={`${c.id}-${idx}-${lv.points}`}
                                  className={cn(
                                    "min-w-[140px] flex-1 rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50",
                                    "sm:min-w-[160px]"
                                  )}
                                >
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2">
                                    {lv.text || "—"}
                                  </p>
                                  <p className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-100">
                                    {formatPointsLabel(lv.points, lang as Lang, t)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {t("teacherRubricCriterionFallback")}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <button
                type="button"
                className="w-full rounded-xl bg-[var(--qit-primary)] py-2.5 text-sm font-medium text-white sm:w-auto sm:px-6"
                onClick={() => setOpen(false)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
