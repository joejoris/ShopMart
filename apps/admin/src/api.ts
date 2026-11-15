// Standalone admin API client. Talks to the same NestJS backend through the
// Vite dev proxy (/api -> localhost:4000). Tokens live under separate keys
// from the storefront ("sms_admin_*") so the two apps never share a session.

const TOKEN_KEY = "sms_admin_token";
const REFRESH_KEY = "sms_admin_refresh";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setTokens(access: string, refresh: string) {
  try {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* ignore */
  }
}
export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!refresh) return null;
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const body = (await res.json()) as { accessToken: string; refreshToken?: string };
      setTokens(body.accessToken, body.refreshToken ?? refresh);
      return body.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const makeHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  let res = await fetch(`/api/v1${path}`, { ...options, headers: { ...makeHeaders(), ...(options.headers as Record<string, string>) } });

  if (res.status === 401 && getToken()) {
    const fresh = await refreshToken();
    if (fresh) res = await fetch(`/api/v1${path}`, { ...options, headers: makeHeaders() });
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
      if (Array.isArray(message)) message = message.join(", ");
    } catch {
      /* keep default */
    }
    if (res.status === 401) clearTokens();
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
