const API = typeof window === "undefined" ? "http://localhost:4000/api/v1" : "/api/v1";

const TOKEN_KEY = "ec_token";
const REFRESH_KEY = "ec_refresh";
const REMEMBER_KEY = "ec_remember";

/** Where tokens/auth live right now. "0" = this tab only (sessionStorage). */
export function isRememberMe() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
}
export function rememberStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return isRememberMe() ? localStorage : sessionStorage;
  } catch {
    return localStorage;
  }
}
export function setRemember(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getToken() {
  const s = rememberStorage();
  return s ? s.getItem(TOKEN_KEY) : null;
}
export function setTokens(access: string, refresh: string, remember = true) {
  setRemember(remember);
  if (typeof window === "undefined") return;
  const store = remember ? localStorage : sessionStorage;
  try {
    // Write to the chosen store and purge the other so stale copies can't leak.
    if (remember) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    store.setItem(TOKEN_KEY, access);
    store.setItem(REFRESH_KEY, refresh);
  } catch {
    /* storage full — keep in memory only */
  }
}
export function clearTokens() {
  if (typeof window === "undefined") return;
  try {
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY);
      s.removeItem(REFRESH_KEY);
    }
  } catch {
    /* ignore */
  }
}
export function getGuestId() {
  if (typeof window === "undefined") return undefined;
  let id = localStorage.getItem("ec_guest_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ec_guest_id", id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = typeof window === "undefined" ? null : rememberStorage()?.getItem(REFRESH_KEY);
      if (!refreshToken) return null;
      const res = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const body = (await res.json()) as { accessToken: string; refreshToken?: string };
      setTokens(body.accessToken, body.refreshToken ?? refreshToken, isRememberMe());
      return body.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      // Allow future refresh attempts regardless of outcome
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const makeHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const guest = getGuestId();
    if (guest) headers["x-guest-id"] = guest;
    return headers;
  };

  let res = await fetch(`${API}${path}`, { ...options, headers: makeHeaders() });

  // Token expired — try a refresh and retry once.
  if (res.status === 401 && getToken() && !path.startsWith("/auth/")) {
    const newToken = await refreshToken();
    if (newToken) {
      res = await fetch(`${API}${path}`, { ...options, headers: makeHeaders() });
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
      if (Array.isArray(message)) message = message.join(", ");
    } catch {}
    if (res.status === 401 && !path.startsWith("/auth/")) {
      clearTokens();
      try {
        localStorage.removeItem("ec-auth");
        sessionStorage.removeItem("ec-auth");
      } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("ec:session-expired"));
        message = "Your session expired. Please sign in again.";
      }
    }
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

export async function downloadFile(path: string, filename: string) {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(cents / 100);

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  sku: string;
  stock: number;
  images: string[];
  featured?: boolean;
  category?: { id: string; name: string; slug: string };
  ratingAvg?: number;
  ratingCount?: number;
  reviews?: Array<{ id: string; rating: number; comment: string; createdAt: string; verifiedPurchase?: boolean; user: { name: string } }>;
};

export type CartItem = {
  id: string;
  quantity: number;
  product: Product;
  lineTotalCents: number;
};
export type Cart = { id: string; items: CartItem[]; subtotalCents: number; itemCount: number };

export type Order = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  couponCode: string | null;
  shippingMethod: string;
  createdAt: string;
  items: Array<{ id: string; title: string; priceCents: number; quantity: number }>;
};
