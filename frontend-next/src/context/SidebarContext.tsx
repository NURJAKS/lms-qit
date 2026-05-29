"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const STORAGE_KEY = "sidebar-collapsed";

type SidebarContextType = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
  width: string;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCollapsedState(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed, mounted]);

  const setCollapsed = useCallback((v: boolean) => setCollapsedState(v), []);
  const toggle = useCallback(
    () => setCollapsedState((p: boolean) => !p),
    []
  );

  const width = collapsed ? "4.5rem" : "18rem";

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle, width, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
