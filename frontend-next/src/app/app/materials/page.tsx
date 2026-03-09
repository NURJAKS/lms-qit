"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { FileText } from "lucide-react";
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
      return data;
    },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <BlurFade delay={0.1}>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
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
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {m.title}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
                    {getLocalizedCourseTitle({ title: m.course_title } as any, t)}
                  </span>
                </div>
                {m.description && (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mb-4"
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
                              className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm"
                            >
                              {url}
                            </a>
                          ) : (
                            <video
                              src={url.startsWith("http") ? url : url.startsWith("/") ? url : `/${url}`}
                              controls
                              className="max-w-full rounded-lg"
                            >
                              Ваш браузер не поддерживает видео.
                            </video>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {m.image_urls.length > 0 && (
                  <div className="space-y-2">
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
              </div>
            </article>
            </BlurFade>
          ))}
        </div>
      )}
    </div>
  );
}
