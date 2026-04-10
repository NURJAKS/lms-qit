"use client";

import { create } from "zustand";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
}

interface NotificationState {
  notifications: Notification[];
  confirm: ConfirmState;
  
  // Notification actions
  addNotification: (message: string, type?: NotificationType, duration?: number) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Confirm actions
  showConfirm: (params: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "primary";
  }) => void;
  hideConfirm: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  confirm: {
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  },

  addNotification: (message, type = "info", duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { id, message, type, duration }],
    }));

    if (duration !== Infinity) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => set({ notifications: [] }),

  showConfirm: ({ title, message, onConfirm, onCancel, confirmText, cancelText, variant = "primary" }) => {
    set({
      confirm: {
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm();
          set((s) => ({ confirm: { ...s.confirm, isOpen: false } }));
        },
        onCancel: () => {
          if (onCancel) onCancel();
          set((s) => ({ confirm: { ...s.confirm, isOpen: false } }));
        },
        confirmText,
        cancelText,
        variant,
      },
    });
  },

  hideConfirm: () => set((s) => ({ confirm: { ...s.confirm, isOpen: false } })),
}));

// Helper exports for easier usage
export const toast = {
  success: (msg: string, duration?: number) => 
    useNotificationStore.getState().addNotification(msg, "success", duration),
  error: (msg: string, duration?: number) => 
    useNotificationStore.getState().addNotification(msg, "error", duration),
  info: (msg: string, duration?: number) => 
    useNotificationStore.getState().addNotification(msg, "info", duration),
  warning: (msg: string, duration?: number) => 
    useNotificationStore.getState().addNotification(msg, "warning", duration),
};
