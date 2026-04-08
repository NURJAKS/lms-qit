"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Code2, Info, Lightbulb, ListChecks, Table as TableIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const proseClasses =
  "prose prose-gray dark:prose-invert max-w-none " +
  "prose-headings:font-bold prose-headings:tracking-tight " +
  "prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 " +
  "prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 " +
  "prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed " +
  "prose-li:text-gray-600 dark:prose-li:text-gray-400 " +
  "prose-strong:text-purple-600 dark:prose-strong:text-purple-400 " +
  "prose-code:text-purple-600 dark:prose-code:text-purple-400 prose-code:font-medium " +
  "prose-blockquote:border-l-4 prose-blockquote:border-purple-500 prose-blockquote:bg-purple-500/5 prose-blockquote:py-1 prose-blockquote:rounded-r-lg";

export function TopicTheoryContent({ content }: { content: string }) {
  const { t } = useLanguage();

  return (
    <div className="relative group">
      {/* Decorative background accents */}
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl p-10 opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-1000" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl p-10 opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-1000" />
      
      <div className="relative bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Top Header/Badge */}
        <div className="flex items-center gap-3 px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {t("theoryMaterial")}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-tight">{t("activeLearning")}</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`p-6 md:p-8 lg:p-10 ${proseClasses} relative`}>
          {/* Subtle grid pattern for content */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px]" />
          
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="flex items-center gap-3 relative group/h2">
                  <span className="absolute -left-6 md:-left-8 w-1 h-8 bg-purple-500 rounded-full scale-y-0 group-hover/h2:scale-y-100 transition-transform origin-center" />
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="flex items-center gap-2 border-l-2 border-purple-500/30 pl-4 py-1">
                  {children}
                </h3>
              ),
              table: ({ children }) => (
                <div className="my-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/20 dark:shadow-none">
                  <div className="bg-gray-50 dark:bg-gray-800/50 py-2 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{t("referenceData")}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse !my-0">
                      {children}
                    </table>
                  </div>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-gray-50/50 dark:bg-gray-800/30">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                  {children}
                </tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {children}
                </td>
              ),
              code({ node, className, children, ...props }) {
                const isBlock = className != null;
                if (isBlock) {
                  return (
                    <div className="relative group/code my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-purple-500" />
                          <span className="text-xs font-mono font-bold text-gray-500 tracking-tighter uppercase">{t("codeSnippet")}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400/20" />
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/20" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/20" />
                        </div>
                      </div>
                      <code className={`${className} block !bg-gray-900 !text-gray-100 p-6 !m-0 overflow-x-auto text-[13px] leading-relaxed selection:bg-purple-500/30`} {...props}>
                        {children}
                      </code>
                    </div>
                  );
                }
                return (
                  <code
                    className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-purple-100 dark:border-purple-800/50"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="my-8 relative pl-12 pr-6 py-6 border-l-4 border-purple-500 bg-purple-500/5 rounded-r-2xl italic text-gray-700 dark:text-gray-300">
                  <Lightbulb className="absolute top-6 left-4 w-6 h-6 text-purple-500 opacity-50" />
                  <div className="font-medium text-purple-900 dark:text-purple-200 not-italic mb-1 uppercase text-[10px] tracking-widest flex items-center gap-2">
                    <Info className="w-3 h-3" />
                    {t("proTip")}
                  </div>
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 list-none pl-0 my-6">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-3 py-1 group/li leading-relaxed">
                  <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full border-2 border-purple-500 group-hover/li:bg-purple-500 transition-colors duration-300" />
                  <div className="text-gray-700 dark:text-gray-300">{children}</div>
                </li>
              ),
              hr: () => (
                <hr className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />
              )
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Bottom footer/decoration */}
        <div className="px-10 py-6 bg-gray-50/30 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <ListChecks className="w-4 h-4" />
            <span className="text-[11px] font-medium tracking-wide uppercase">{t("completeReading")}</span>
          </div>
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-purple-500 flex items-center justify-center text-[10px] text-white font-bold">P</div>
            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">Y</div>
            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold">T</div>
          </div>
        </div>
      </div>
    </div>
  );
}
