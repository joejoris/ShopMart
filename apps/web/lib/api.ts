const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const TOKEN_KEY = "ec_token";
const REFRESH_KEY = "ec_refresh";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const guest = getGuestId();
  if (guest) headers["x-guest-id"] = guest;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
      if (Array.isArray(message)) message = message.join(", ");
    } catch {}
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
  category?: { id: string; name: string; slug: string };
  ratingAvg?: number;
  ratingCount?: number;
  reviews?: Array<{ id: string; rating: number; comment: string; createdAt: string; user: { name: string } }>;
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

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
