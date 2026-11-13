// Server-side fetch helpers used by route loaders. No auth/guest headers —
// loaders only read the public catalog/SEO data.

const API = "http://localhost:4000/api/v1";

export class ApiHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function serverGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  } catch (e: any) {
    throw new ApiHttpError(0, `API unreachable: ${e?.message ?? "connection refused"}`);
  }
  if (!res.ok) {
    throw new ApiHttpError(res.status, `API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}
