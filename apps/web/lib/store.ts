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
 * Returns false during SSR and the very first client render, then true.
 * Use it to gate any auth-dependent UI so the first client render always
 * matches the server-rendered HTML (no hydration errors).
 */
export const useIsHydrated = () => {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
};
