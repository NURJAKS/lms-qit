"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, ImageIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

function Toolbar({ editor, t }: { editor: Editor | null; t: (key: TranslationKey) => string }) {
  const addImage = useCallback(() => {
    const url = window.prompt(t("richTextImageUrl"));
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  }, [editor, t]);

  const setLink = useCallback(() => {
    const url = window.prompt(t("richTextLinkUrl"));
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }, [editor, t]);

  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 rounded-t-lg">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 rounded ${editor.isActive("bold") ? "bg-gray-300 dark:bg-gray-600" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title={t("richTextBold")}
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded ${editor.isActive("italic") ? "bg-gray-300 dark:bg-gray-600" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title={t("richTextItalic")}
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded ${editor.isActive("bulletList") ? "bg-gray-300 dark:bg-gray-600" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title={t("richTextBulletList")}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded ${editor.isActive("orderedList") ? "bg-gray-300 dark:bg-gray-600" : "hover:bg-gray-200 dark:hover:bg-gray-600"}`}
        title={t("richTextNumberedList")}
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button type="button" onClick={setLink} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title={t("richTextLink")}>
        <LinkIcon className="w-4 h-4" />
      </button>
      <button type="button" onClick={addImage} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title={t("richTextImage")}>
        <ImageIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useLanguage();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[120px] px-3 py-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  return (
    <div className={`border dark:border-gray-600 rounded-lg overflow-hidden ${className ?? ""}`}>
      <Toolbar editor={editor} t={t} />
      <EditorContent editor={editor} />
    </div>
  );
}
