"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { FileText, Link as LinkIcon } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

type Material = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  course_title: string;
  topic_id: number | null;
  video_urls: string[];
  image_urls: string[];
  attachment_urls: string[];
  attachment_links: string[];
  created_at: string | null;
};

export default function MaterialsPage() {
  const { t } = useLanguage();
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

  const { data: materials = [] } = useQuery({
    queryKey: ["my-materials"],
    queryFn: async () => {
      const { data } = await api.get<Material[]>("/assignments/my-materials");

      const asAny = data as any;
      // Normalize nullable array fields from backend to prevent runtime crashes
      // when rendering e.g. `m.attachment_urls.length`.
      if (!Array.isArray(asAny)) {
        console.warn("API /assignments/my-materials returned non-array data:", asAny);
        return [] as Material[];
      }

      const normalized = asAny.map((m: any) => ({
        ...m,
        video_urls: Array.isArray(m?.video_urls) ? m.video_urls : [],
        image_urls: Array.isArray(m?.image_urls) ? m.image_urls : [],
        attachment_urls: Array.isArray(m?.attachment_urls) ? m.attachment_urls : [],
        attachment_links: Array.isArray(m?.attachment_links) ? m.attachment_links : [],
      }));

      return normalized as Material[];
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-0">
      <BlurFade delay={0.1}>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
          <FileText className="w-7 h-7" />
          {t("studentMaterials")}
        </h1>
      </BlurFade>
      {materials.length === 0 ? (
        <BlurFade delay={0.2}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {t("studentNoMaterials")}
          </p>
        </div>
        </BlurFade>
      ) : (
        <div className="space-y-4">
          {materials.map((m, index) => (
            <BlurFade key={m.id} delay={0.1 + index * 0.05}>
            <article
              key={m.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4 mb-2">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mobile-safe-text">
                    {m.title}
                  </h2>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 shrink-0">
                    {getLocalizedCourseTitle({ title: m.course_title } as any, t)}
                  </span>
                </div>
                {m.description && (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mb-4 break-words"
                    dangerouslySetInnerHTML={{ __html: m.description }}
                  />
                )}
                {m.video_urls.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("teacherVideo")}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {m.video_urls.map((url, i) => (
                        <div key={i} className="w-full max-w-md">
                          {url.match(/youtube\.com|youtu\.be|vimeo\.com/) ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm mobile-safe-text"
                            >
                              {url}
                            </a>
                          ) : (
                            <video
                              src={url.startsWith("http") ? url : url.startsWith("/") ? url : `/${url}`}
                              controls
                              className="max-w-full rounded-lg"
                            >
                              {t("videoNotSupported")}
                            </video>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {m.image_urls.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("teacherImages")}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {m.image_urls.map((url, i) => (
                        <img
                          key={i}
                          src={url.startsWith("http") ? url : url.startsWith("/") ? url : `/${url}`}
                          alt=""
                          className="max-h-48 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {m.attachment_urls.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("teacherAttachments")}:
                    </p>
                    <div className="space-y-2">
                      {m.attachment_urls.map((url, i) => {
                        const fileName = url.split("/").pop();
                        return (
                          <a
                            key={i}
                            href={url.startsWith("http") ? url : url.startsWith("/") ? url : `/${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors"
                          >
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-medium">
                              {fileName}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {m.attachment_links.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {t("teacherVideoLink")}:
                    </p>
                    <div className="space-y-1">
                      {m.attachment_links.map((link, i) => (
                        <a
                          key={i}
                          href={link.startsWith("http") ? link : `https://${link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <LinkIcon className="w-4 h-4" />
                          <span className="truncate">{link}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
            </BlurFade>
          ))}
        </div>
      )}
    </div>
  );
}
