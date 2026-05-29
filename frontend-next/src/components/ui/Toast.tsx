"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info, 
  X 
} from "lucide-react";
import { NotificationType, Notification, useNotificationStore } from "@/store/notificationStore";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error: <XCircle className="w-5 h-5 text-rose-500" />,
  warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-sky-500" />,
};

const BORDERS: Record<NotificationType, string> = {
  success: "border-emerald-500/50 dark:border-emerald-500/30",
  error: "border-rose-500/50 dark:border-rose-500/30",
  warning: "border-amber-500/50 dark:border-amber-500/30",
  info: "border-sky-500/50 dark:border-sky-500/30",
};

interface ToastProps {
  notification: Notification;
}

export function Toast({ notification }: ToastProps) {
  const { removeNotification } = useNotificationStore();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  
  const [progress, setProgress] = useState(100);
  const duration = notification.duration || 5000;

  useEffect(() => {
    if (duration === Infinity) return;
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={cn(
        "relative group flex items-start gap-4 p-4 pr-12 rounded-2xl shadow-2xl mb-3 w-[320px] sm:w-[400px] border-l-4",
        BORDERS[notification.type]
      )}
      style={glassStyle}
    >
      <div className="shrink-0 mt-0.5">
        {ICONS[notification.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-relaxed" style={{ color: textColors.primary }}>
          {notification.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => removeNotification(notification.id)}
        className="absolute top-3 right-3 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        style={{ color: textColors.secondary }}
      >
        <X className="w-4 h-4" />
      </button>

      {duration !== Infinity && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-black/5 dark:bg-white/5 overflow-hidden rounded-b-2xl">
          <motion.div
            className={cn(
              "h-full rounded-full",
              notification.type === "success" && "bg-emerald-500",
              notification.type === "error" && "bg-rose-500",
              notification.type === "warning" && "bg-amber-500",
              notification.type === "info" && "bg-sky-500"
            )}
            initial={{ width: "100%" }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  );
}
