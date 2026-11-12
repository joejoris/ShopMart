export function camel<T = any>(row: any): T | undefined {
  if (!row || typeof row !== "object") return row;
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out as T;
}
export const camelAll = <T = any>(rows: any[]): T[] => rows.map((r) => camel<T>(r)!);
export const bool = (v: any) => (v === undefined || v === null ? v : !!v);
