"use client";

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/lib/store";

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

  return null;
}
