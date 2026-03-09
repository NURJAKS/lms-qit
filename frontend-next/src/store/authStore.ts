"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  /** admin, director, curator — доступ к админке */
  isAdmin: () => boolean;
  /** admin, director — управление пользователями, удаление курсов */
  canManageUsers: () => boolean;
  isTeacher: () => boolean;
}

const safeStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        safeStorage.setItem("token", token);
        set({ user, token });
      },
      logout: () => {
        safeStorage.removeItem("token");
        set({ user: null, token: null });
      },
      isAdmin: () =>
        ["admin", "director", "curator"].includes(get().user?.role ?? ""),
      canManageUsers: () =>
        ["admin", "director"].includes(get().user?.role ?? ""),
      isTeacher: () =>
        ["admin", "director", "curator", "teacher"].includes(
          get().user?.role ?? ""
        ),
    }),
    {
      name: "auth-storage",
      partialize: (s) => ({ user: s.user, token: s.token }),
      storage: {
        getItem: (name) => {
          const str = safeStorage.getItem(name);
          if (!str) return null;
          try {
            const parsed = JSON.parse(str);
            if (parsed?.state?.user && typeof parsed.state.user !== "object")
              return null;
            if (parsed?.state?.token && typeof parsed.state.token !== "string")
              return null;
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          safeStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          safeStorage.removeItem(name);
        },
      },
    }
  )
);
