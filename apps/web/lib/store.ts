"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = { id: string; email: string; name: string; role: string } | null;

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
