"use client";

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/lib/store";
import { api, getToken } from "@/lib/api";

/**
 * Listens for the `ec:session-expired` event fired by the API client when a
 * 401 survives a token refresh (e.g. the account no longer exists or the
 * refresh token was revoked). Clears the persisted user and redirects to
 * sign-in with a friendly reason so the UI never shows raw "Unauthorized".
 */
export function SessionExpiredListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onExpired = () => {
      useAuth.getState().logout();
      // Already on the login page — nothing to redirect to.
      if (window.location.pathname.startsWith("/auth/login")) return;
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/auth/login?next=${next}&reason=expired`, { replace: true });
    };
    window.addEventListener("ec:session-expired", onExpired);
    return () => window.removeEventListener("ec:session-expired", onExpired);
  }, [navigate, location]);

  // Sync the persisted session against the server on every app load.
  // The store persists the user (incl. role) in local/session storage, so
  // server-side changes — e.g. this account being promoted to admin — only
  // reach the UI if we re-read them here.
  useEffect(() => {
    const store = useAuth.getState();
    if (!getToken()) {
      store.setSynced(true);
      return;
    }
    api
      .get<{ id: string; email: string; name: string; role: string; emailVerified: boolean }>("/auth/me")
      .then((me) => useAuth.getState().setUser(me))
      .catch(() => {
        /* the api client already handles expired/invalid sessions */
      })
      .finally(() => useAuth.getState().setSynced(true));
  }, []);

  return null;
}
