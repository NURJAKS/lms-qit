"use client";

import { FileText, Globe, ImageIcon, Film, Music, Archive, FileCode, Presentation } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { filenameFromUrl, detectAttachmentKind, type AttachmentVisualKind } from "./assignmentInstructionUtils";
import { cn } from "@/lib/utils";

function KindBadge({ kind }: { kind: AttachmentVisualKind }) {
  const inner = (() => {
    switch (kind) {
      case "word":
        return <span className="text-xl font-bold leading-none text-white">W</span>;
      case "excel":
        return <span className="text-xl font-bold leading-none text-white">X</span>;
      case "ppt":
        return <Presentation className="h-8 w-8 text-white" strokeWidth={2} />;
      case "pdf":
        return <span className="text-[11px] font-black tracking-tight text-white">PDF</span>;
      case "image":
        return <ImageIcon className="h-8 w-8 text-white" strokeWidth={2} />;
      case "video":
        return <Film className="h-8 w-8 text-white" strokeWidth={2} />;
      case "audio":
        return <Music className="h-8 w-8 text-white" strokeWidth={2} />;
      case "archive":
        return <Archive className="h-7 w-7 text-white" strokeWidth={2} />;
      case "code":
        return <FileCode className="h-7 w-7 text-white" strokeWidth={2} />;
      default:
        return <FileText className="h-8 w-8 text-white" strokeWidth={2} />;
    }
  })();

  const bg = (() => {
    switch (kind) {
      case "word":
        return "bg-[#2b579a]";
      case "excel":
        return "bg-[#217346]";
      case "ppt":
        return "bg-[#d24726]";
      case "pdf":
        return "bg-[#e5252a]";
      case "image":
        return "bg-sky-600";
      case "video":
        return "bg-violet-600";
      case "audio":
        return "bg-fuchsia-600";
      case "archive":
        return "bg-amber-600";
      case "code":
        return "bg-slate-600";
      default:
        return "bg-slate-500";
    }
  })();

  return (
    <div className="flex w-[104px] shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/80">
      <div className={cn("flex h-[72px] w-[72px] items-center justify-center rounded-xl shadow-sm", bg)}>{inner}</div>
    </div>
  );
}

function fileSubtitle(kind: AttachmentVisualKind, t: ReturnType<typeof useLanguage>["t"]): string {
  switch (kind) {
    case "word":
      return t("teacherAttachmentKindWord");
    case "excel":
      return t("teacherAttachmentKindExcel");
    case "ppt":
      return t("teacherAttachmentKindPpt");
    case "pdf":
      return t("teacherAttachmentKindPdf");
    case "image":
      return t("teacherAttachmentKindImage");
    case "video":
      return t("teacherAttachmentKindVideo");
    case "audio":
      return t("teacherAttachmentKindAudio");
    case "archive":
      return t("teacherAttachmentKindArchive");
    case "code":
      return t("teacherAttachmentKindCode");
    default:
      return t("teacherAttachmentKindFile");
  }
}

function FileRow({ href }: { href: string }) {
  const { t } = useLanguage();
  const name = filenameFromUrl(href);
  const kind = detectAttachmentKind(name);
  const isImage = kind === "image";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-[96px] overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-600 dark:bg-gray-900"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:underline dark:text-white">
          {name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{fileSubtitle(kind, t)}</p>
      </div>
      {isImage ? (
        <div className="relative h-[96px] w-[120px] shrink-0 border-l border-gray-200 bg-gray-100 dark:border-gray-600">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <KindBadge kind={kind} />
      )}
    </a>
  );
}

function LinkRow({ href }: { href: string }) {
  const { t } = useLanguage();
  let host = href;
  try {
    host = new URL(href).hostname;
  } catch {
    /* keep raw */
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-[96px] overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-600 dark:bg-gray-900"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("teacherAttachmentLinkTitle")}</p>
        <p className="line-clamp-2 break-all text-xs text-blue-600 underline-offset-2 group-hover:underline dark:text-blue-400">
          {href}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{host}</p>
      </div>
      <div className="flex w-[104px] shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/80">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm dark:border-gray-500 dark:bg-gray-700">
          <Globe className="h-9 w-9 text-slate-500 dark:text-slate-300" strokeWidth={1.5} />
        </div>
      </div>
    </a>
  );
}

function VideoRow({ href }: { href: string }) {
  const { t } = useLanguage();
  const name = filenameFromUrl(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-[96px] overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-600 dark:bg-gray-900"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3">
        <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:underline dark:text-white">{name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("teacherAttachmentKindVideo")}</p>
      </div>
      <KindBadge kind="video" />
    </a>
  );
}

export function AssignmentAttachmentsGC({
  attachmentUrls = [],
  attachmentLinks = [],
  videoUrls = [],
}: {
  attachmentUrls?: string[];
  attachmentLinks?: string[];
  videoUrls?: string[];
}) {
  const { t } = useLanguage();
  const files = attachmentUrls ?? [];
  const links = attachmentLinks ?? [];
  const videos = videoUrls ?? [];

  if (files.length === 0 && links.length === 0 && videos.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("teacherAssignmentNoAttachments")}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {files.map((u, i) => (
        <FileRow key={`f-${u}-${i}`} href={u} />
      ))}
      {videos.map((u, i) => (
        <VideoRow key={`v-${u}-${i}`} href={u} />
      ))}
      {links.map((u, i) => (
        <LinkRow key={`l-${u}-${i}`} href={u} />
      ))}
    </div>
  );
}
