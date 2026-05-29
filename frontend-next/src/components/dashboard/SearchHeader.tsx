"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";

type SearchResult = {
  courses: Array<{ id: number; title: string }>;
  topics: Array<{ id: number; title: string; course_id: number }>;
};

export function SearchHeader() {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const { data: res } = await api.get<SearchResult>(`/courses/search?q=${encodeURIComponent(query)}`);
      return res;
    },
    enabled: query.trim().length >= 2,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const hasResults = data && (data.courses.length > 0 || data.topics.length > 0);
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="relative flex-1 max-w-md hidden sm:block" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-[#ff4081]/30 focus:border-[#ff4081]"
        />
      </div>
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 max-h-80 overflow-auto">
          {isLoading || isFetching ? (
            <p className="px-4 py-3 text-gray-500 text-sm">{t("loading")}</p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-gray-500 text-sm">{t("noSearchResults")}</p>
          ) : (
            <>
              {data!.courses.length > 0 && (
                <div className="px-2 pb-1">
                  <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">{t("course")}</p>
                  {data!.courses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/app/courses/${c.id}`}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className="block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-200"
                    >
                      {c.title}
                    </Link>
                  ))}
                </div>
              )}
              {data!.topics.length > 0 && (
                <div className="px-2">
                  <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">{t("searchTopics")}</p>
                  {data!.topics.map((t) => (
                    <Link
                      key={t.id}
                      href={`/app/courses/${t.course_id}/topic/${t.id}`}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className="block px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-200"
                    >
                      {t.title}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
