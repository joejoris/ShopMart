// Server-side fetch helpers used by route loaders. No auth/guest headers —
// loaders only read the public catalog/SEO data.

const API = "http://localhost:4000/api/v1";

export async function serverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}
