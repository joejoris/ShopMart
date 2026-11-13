"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
    { name: "ec-auth" }
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
