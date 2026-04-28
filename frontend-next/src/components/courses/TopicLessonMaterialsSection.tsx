"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { FileText, Globe, BookOpen, Loader2, ClipboardList } from "lucide-react";
import { htmlLinksOpenInNewTab } from "@/lib/htmlLinkNewTab";
import Link from "next/link";

type MaterialRow = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  topic_id: number | null;
  video_urls: string[];
  image_urls: string[];
  attachment_urls: string[];
  attachment_links: string[];
  is_supplementary?: boolean;
  created_at: string | null;
};

import { TopicAssignmentCard, type AssignmentRow } from "@/components/courses/TopicAssignmentCard";
import { TopicQuestionCard, type QuestionRow } from "@/components/courses/TopicAssignmentsInlineSection";
import { MessageSquare } from "lucide-react";

function fileNameFromUrl(url: string, idx: number, fallback: string) {
  try {
    const parts = url.split("/");
    const name = parts[parts.length - 1];
    return decodeURIComponent(name).replace(/^[a-f0-9]{32}/, "").replace(/^[-_.]/, "") || `${fallback} ${idx + 1}`;
  } catch {
    return `${fallback} ${idx + 1}`;
  }
}

type UnifiedTask = 
  | { type: 'assignment'; data: AssignmentRow; createdAt: number; isSubmitted: boolean }
  | { type: 'question'; data: QuestionRow; createdAt: number; isSubmitted: boolean };

export function TopicLessonMaterialsSection({
  courseId,
  topicId,
}: {
  courseId: number;
  topicId: number;
}) {
  const { t } = useLanguage();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const { data: materialsData = [], isPending: isMaterialsPending } = useQuery({
    queryKey: ["student-materials", courseId],
    queryFn: async () => {
      const { data } = await api.get<MaterialRow[]>("/assignments/my-materials");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!courseId,
  });

  const { data: assignmentsData = [], isPending: isAssignmentsPending } = useQuery({
    queryKey: ["student-assignments", courseId],
    queryFn: async () => {
      const { data } = await api.get<AssignmentRow[]>("/assignments/my");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!courseId,
  });

  const { data: questionsData = [], isPending: isQuestionsPending } = useQuery({
    queryKey: ["student-questions", courseId],
    queryFn: async () => {
      const { data } = await api.get<QuestionRow[]>("/questions/my");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!courseId,
  });

  const mainMaterials = useMemo(
    () => materialsData.filter((m) => m.topic_id === topicId && !m.is_supplementary),
    [materialsData, topicId]
  );

  const unifiedTasks = useMemo(() => {
    const tasks: UnifiedTask[] = [];
    
    assignmentsData
      .filter((a) => a.topic_id === topicId && !a.is_supplementary)
      .forEach((a) => {
        tasks.push({
          type: 'assignment',
          data: a,
          createdAt: a.created_at ? new Date(a.created_at).getTime() : 0,
          isSubmitted: a.submitted
        });
      });

    questionsData
      .filter((q) => q.topic_id === topicId)
      .forEach((q) => {
        tasks.push({
          type: 'question',
          data: q,
          createdAt: q.created_at ? new Date(q.created_at).getTime() : 0,
          isSubmitted: q.status === "submitted"
        });
      });

    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }, [assignmentsData, questionsData, topicId]);

  if (isMaterialsPending || isAssignmentsPending || isQuestionsPending) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <p className="text-sm">{t("loading")}</p>
      </div>
    );
  }

  if (mainMaterials.length === 0 && unifiedTasks.length === 0) {
    return null;
  }

  // Queue logic
  const submittedTasks = unifiedTasks.filter((t) => t.isSubmitted);
  const pendingTasks = unifiedTasks.filter((t) => !t.isSubmitted);

  const activeTask = pendingTasks.length > 0 ? pendingTasks[0] : null;
  const upcomingTasks = pendingTasks.slice(1);

  // Default expansion logic: if no manual expansion, show the active task
  const currentExpandedId = expandedTaskId || (activeTask ? `${activeTask.type}-${activeTask.data.id}` : null);

  return (
    <section className="space-y-6 mt-8 border-t border-gray-100 dark:border-gray-800 pt-8">
      {mainMaterials.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            {t("topicLessonMaterialsTitle")}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {mainMaterials.map((m) => (
              <div key={m.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 sm:p-5 shadow-sm">
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">{m.title}</h4>
                {m.description && (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-300 mb-4 min-w-0 break-words"
                    dangerouslySetInnerHTML={{ __html: htmlLinksOpenInNewTab(m.description) }}
                  />
                )}
                {(m.attachment_urls?.length > 0 || m.attachment_links?.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {m.attachment_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-300 transition-colors text-sm"
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="truncate flex-1">{fileNameFromUrl(url, idx, t("fileLabel"))}</span>
                      </a>
                    ))}
                    {m.attachment_links.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-300 transition-colors text-sm"
                      >
                        <Globe className="w-4 h-4 text-sky-500" />
                        <span className="truncate flex-1">{url}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {unifiedTasks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            {t("topicLessonAssignmentsTitle")}
          </h3>
          
          <div className="space-y-4">
            {/* List all tasks, but only one is expanded */}
            {unifiedTasks.map((task) => {
              const keyId = `${task.type}-${task.data.id}`;
              const isExpanded = currentExpandedId === keyId;
              const isSubmitted = task.isSubmitted;

              if (isSubmitted) {
                // Render submitted task (collapsed)
                if (task.type === 'assignment') {
                  const a = task.data;
                  return (
                    <div 
                      key={keyId} 
                      className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10 overflow-hidden cursor-pointer hover:bg-green-100/50 transition-colors"
                      onClick={() => setExpandedTaskId(isExpanded ? "" : keyId)}
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                              <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-white block">{a.title}</span>
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">
                              {a.grade != null 
                                ? `${t("gradedStatus")}: ${a.grade}/${a.max_points || 100}`
                                : t("submittedStatus")
                              }
                            </span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <span className="text-xs font-bold text-gray-400">{t("hide")}</span>
                        ) : (
                          <Link
                            href={`/app/courses/${courseId}?tab=classwork`}
                            className="text-sm font-bold text-blue-600 hover:underline px-3 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("viewDetails")}
                          </Link>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                           {a.teacher_comment && (
                            <div className="text-sm text-gray-700 dark:text-gray-300 italic bg-white/50 dark:bg-black/20 rounded-lg p-3 border-l-4 border-green-400 mb-4">
                              {a.teacher_comment_author_name && (
                                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 not-italic">
                                  {a.teacher_comment_author_name}
                                </div>
                              )}
                              &ldquo;{a.teacher_comment}&rdquo;
                            </div>
                          )}
                          <TopicAssignmentCard 
                            assignment={a} 
                            courseId={courseId} 
                            topicId={topicId} 
                          />
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const q = task.data;
                  return (
                    <div 
                      key={keyId} 
                      className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10 overflow-hidden cursor-pointer hover:bg-green-100/50 transition-colors"
                      onClick={() => setExpandedTaskId(isExpanded ? "" : keyId)}
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                              <MessageSquare className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-white block line-clamp-1">{q.text}</span>
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">
                              {q.grade != null 
                                ? `${t("gradedStatus")}: ${q.grade}/100`
                                : t("submittedStatus")
                              }
                            </span>
                          </div>
                        </div>
                        {isExpanded ? (
                           <span className="text-xs font-bold text-gray-400">{t("hide")}</span>
                        ) : (
                          <Link
                            href={`/app/courses/${courseId}?tab=classwork`}
                            className="text-sm font-bold text-blue-600 hover:underline px-3 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("viewDetails")}
                          </Link>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          {q.teacher_comment && (
                            <div className="text-sm text-gray-700 dark:text-gray-300 italic bg-white/50 dark:bg-black/20 rounded-lg p-3 border-l-4 border-green-400 mb-4">
                              &ldquo;{q.teacher_comment}&rdquo;
                            </div>
                          )}
                          <TopicQuestionCard question={q} />
                        </div>
                      )}
                    </div>
                  );
                }
              }

              // Render unsubmitted task
              if (isExpanded) {
                return (
                  <div key={keyId}>
                    {task.type === 'assignment' ? (
                      <TopicAssignmentCard 
                        assignment={task.data} 
                        courseId={courseId} 
                        topicId={topicId} 
                      />
                    ) : (
                      <TopicQuestionCard question={task.data} />
                    )}
                  </div>
                );
              } else {
                // Render collapsed upcoming task
                const title = task.type === 'assignment' ? task.data.title : task.data.text;
                const Icon = task.type === 'assignment' ? ClipboardList : MessageSquare;
                const isActive = activeTask && `${activeTask.type}-${activeTask.data.id}` === keyId;

                return (
                  <div 
                    key={keyId} 
                    className={`flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!isActive ? 'opacity-75' : 'ring-2 ring-blue-500/50'}`}
                    onClick={() => setExpandedTaskId(keyId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                          <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white block line-clamp-1">{title}</span>
                        {isActive && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t("activeTask")}</span>}
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}
    </section>
  );
}
