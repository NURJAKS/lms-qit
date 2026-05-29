"use client";

import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, X, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // Changed from "motion/react" to "framer-motion" as per common usage
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { getModalStyle, getTextColors } from "@/utils/themeStyles";

interface DeleteConfirmButtonProps {
  onDelete: () => void;
  isLoading?: boolean;
  className?: string;
  text?: string;
  confirmText?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  hideText?: boolean;
  title?: string;
  description?: string;
}

export function DeleteConfirmButton({
  onDelete,
  isLoading = false,
  className,
  text,
  confirmText,
  variant = "default",
  size = "md",
  hideText = false,
  title,
  description,
}: DeleteConfirmButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsOpen(false);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

  // Close modal when deletion is done (success)
  useEffect(() => {
    if (!isLoading && isOpen) {
        // We logicially don't know if it's success or just stopped loading,
        // but typically the parent will unmount this or we close.
    }
  }, [isLoading, isOpen]);

  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const triggerButton = (
    <button
      type="button"
      onClick={handleOpen}
      className={cn(
        "transition-all duration-200 rounded-xl font-medium flex items-center justify-center gap-2",
        variant === "default" && "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20",
        variant === "outline" && "border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
        variant === "ghost" && "text-red-600 dark:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-500/10",
        size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3 text-base" : "px-4 py-2 text-sm",
        className
      )}
      title={text || t("delete")}
    >
      <Trash2 className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4")} />
      {!hideText && <span>{text || t("delete")}</span>}
    </button>
  );

  if (!mounted) return triggerButton;

  return (
    <>
      {triggerButton}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border"
                style={{
                  ...modalStyle,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                }}
              >
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3" style={{ color: textColors.primary }}>
                    {title || confirmText || t("confirmDelete")}
                  </h3>
                  
                  <p className="text-sm mb-8 px-4 leading-relaxed" style={{ color: textColors.secondary }}>
                    {description || t("adminUserDeleteConfirm") || t("confirmDelete")}
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isLoading}
                      className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                      {t("delete")}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                      style={{ 
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                        color: textColors.primary 
                      }}
                    >
                      <ArrowLeft className="w-5 h-5" />
                      {t("back")}
                    </button>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: textColors.secondary }}
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
