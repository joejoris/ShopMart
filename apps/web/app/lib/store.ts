"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { rememberStorage } from "@/lib/api";

export type AuthUser = { id: string; email: string; name: string; role: string; emailVerified?: boolean } | null;

type AuthState = {
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: "ec-auth",
      // Persist into sessionStorage when "Remember me" is unchecked, else localStorage.
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            // Read current selection first, then fall back to the other store so
            // sessions created before this feature survive.
            const primary = rememberStorage();
            const secondary = primary === sessionStorage ? localStorage : sessionStorage;
            return primary?.getItem(name) ?? secondary?.getItem(name) ?? null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            const s = rememberStorage();
            if (s) s.setItem(name, value);
            const other = s === sessionStorage ? localStorage : sessionStorage;
            other.removeItem(name);
          } catch {
            /* ignore */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
            sessionStorage.removeItem(name);
          } catch {
            /* ignore */
          }
        },
      })),
    }
  )
);

/**
 * False during SSR and the first client render, true after mount.
 * Gates any auth-dependent UI so the first paint matches the server HTML.
 */
export const useIsHydrated = () => {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
};
