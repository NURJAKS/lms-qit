"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { ChevronLeft, Paperclip } from "lucide-react";
import { useState } from "react";

type RubricCriterion = { id: number; name: string; max_points: number };
type RubricGrade = { criterion_id: number; points: number };
type Submission = {
  id: number;
  student_id: number;
  student_name: string;
  submission_text: string | null;
  file_url: string | null;
  file_urls: string[];
  grade: number | null;
  teacher_comment: string | null;
  rubric_grades: RubricGrade[];
};

export default function AssignmentDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const id = Number(assignmentId);
  const queryClient = useQueryClient();
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");
  const [rubricGrades, setRubricGrades] = useState<Record<number, string>>({});

  const { data } = useQuery({
    queryKey: ["assignment-submissions", id],
    queryFn: async () => {
      const { data: res } = await api.get<{ submissions: Submission[]; rubric: RubricCriterion[] }>(
        `/teacher/assignments/${id}/submissions`
      );
      return res;
    },
    enabled: !!id,
  });

  const submissions = data?.submissions ?? [];
  const rubric = data?.rubric ?? [];

  const gradeMutation = useMutation({
    mutationFn: async ({
      subId,
      g,
      c,
      grades,
    }: {
      subId: number;
      g?: number;
      c: string;
      grades?: RubricGrade[];
    }) => {
      await api.put(`/teacher/submissions/${subId}`, {
        grade: g,
        teacher_comment: c,
        grades,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", id] });
      setGradingId(null);
      setGrade("");
      setComment("");
      setRubricGrades({});
    },
  });

  const handleGrade = () => {
    if (!gradingId) return;
    const hasRubric = rubric.length > 0;
    const grades: RubricGrade[] = hasRubric
      ? rubric.map((c) => ({
          criterion_id: c.id,
          points: parseFloat(rubricGrades[c.id] ?? "0") || 0,
        }))
      : [];
    const numericGrade = grade ? Number(grade) : undefined;
    if (hasRubric || numericGrade != null) {
      gradeMutation.mutate({
        subId: gradingId,
        g: numericGrade,
        c: comment,
        grades: hasRubric ? grades : undefined,
      });
    }
  };

  const openGrading = (s: Submission) => {
    setGradingId(s.id);
    setGrade(String(s.grade ?? ""));
    setComment(s.teacher_comment ?? "");
    const grades: Record<number, string> = {};
    if (rubric.length) {
      rubric.forEach((c) => {
        const rg = s.rubric_grades?.find((g) => g.criterion_id === c.id);
        grades[c.id] = rg != null ? String(rg.points) : "";
      });
    }
    setRubricGrades(grades);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/app/teacher?tab=assignments"
        className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> {t("teacherBack")}
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        {t("teacherViewSubmissions")}
      </h1>
      <ul className="space-y-4">
        {submissions.map((s) => (
          <li
            key={s.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700"
          >
            <p className="font-medium text-gray-800 dark:text-white">
              <Link
                href={`/app/profile/${s.student_id}`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {s.student_name || `${t("student")} #${s.student_id}`}
              </Link>
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 whitespace-pre-wrap">
              {s.submission_text || "—"}
            </p>
            {((s.file_urls?.length ?? 0) > 0 || s.file_url) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.file_url && (
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Paperclip className="w-3 h-3" /> {s.file_url.split("/").pop()}
                  </a>
                )}
                {s.file_urls?.map((u, i) => (
                  <a
                    key={i}
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Paperclip className="w-3 h-3" /> {u.split("/").pop()}
                  </a>
                ))}
              </div>
            )}
            {s.grade != null && (
              <p className="text-green-600 dark:text-green-400 mt-2">
                {t("teacherScore")}: {s.grade}
              </p>
            )}
            {gradingId === s.id ? (
              <div className="mt-4 space-y-3">
                {rubric.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("teacherRubric")}
                    </p>
                    {rubric.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400 w-48 truncate">
                          {c.name} (max {c.max_points})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={c.max_points}
                          step={0.5}
                          value={rubricGrades[c.id] ?? ""}
                          onChange={(e) =>
                            setRubricGrades((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 w-20"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("teacherTotalFromRubric")}:{" "}
                      {rubric
                        .reduce(
                          (sum, c) => sum + (parseFloat(rubricGrades[c.id] ?? "0") || 0),
                          0
                        )
                        .toFixed(1)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      placeholder={t("teacherScore")}
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 w-24"
                    />
                  </div>
                )}
                <input
                  type="text"
                  placeholder={t("teacherComment")}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleGrade}
                    disabled={rubric.length === 0 && !grade}
                    className="py-1 px-3 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {t("save")}
                  </button>
                  <button
                    onClick={() => setGradingId(null)}
                    className="py-1 px-3 rounded border dark:border-gray-600 text-sm"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openGrading(s)}
                className="mt-2 text-qit-primary dark:text-qit-secondary-light text-sm hover:underline"
              >
                {t("teacherGrade")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
