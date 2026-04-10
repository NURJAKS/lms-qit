"use client";

import { useNotificationStore } from "@/store/notificationStore";
import { Toast } from "./Toast";
import { AnimatePresence } from "framer-motion";

export function ToastContainer() {
  const { notifications } = useNotificationStore();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {notifications.map((n) => (
            <Toast key={n.id} notification={n} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
