"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Check, ArrowLeft } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getModalStyle, getTextColors } from "@/utils/themeStyles";
import { cn } from "@/lib/utils";

export function GlobalConfirmModal() {
  const { confirm, hideConfirm } = useNotificationStore();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  return createPortal(
    <AnimatePresence>
      {confirm.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={hideConfirm}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl border"
            style={{
              ...modalStyle,
              borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"
            }}
          >
            <div className="p-8 text-center">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner",
                confirm.variant === "danger" 
                  ? "bg-rose-50 dark:bg-rose-500/10 text-rose-500" 
                  : "bg-blue-50 dark:bg-blue-500/10 text-blue-500"
              )}>
                {confirm.variant === "danger" ? (
                  <AlertTriangle className="w-10 h-10" />
                ) : (
                  <Check className="w-10 h-10" />
                )}
              </div>
              
              <h3 className="text-xl font-bold mb-3" style={{ color: textColors.primary }}>
                {confirm.title}
              </h3>
              
              <p className="text-sm mb-8 px-4 leading-relaxed" style={{ color: textColors.secondary }}>
                {confirm.message}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={confirm.onConfirm}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95",
                    confirm.variant === "danger"
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30"
                      : "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/30"
                  )}
                >
                  {confirm.confirmText || t("confirm")}
                </button>
                
                <button
                  type="button"
                  onClick={confirm.onCancel}
                  className="w-full py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-95"
                  style={{ 
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    color: textColors.primary 
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                  {confirm.cancelText || t("back")}
                </button>
              </div>
            </div>
            
            <button
              type="button"
              onClick={hideConfirm}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: textColors.secondary }}
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
