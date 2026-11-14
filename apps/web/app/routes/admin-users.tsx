import { useEffect, useState } from "react";
import { api, formatPrice } from "@/lib/api";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  orderCount: string | number;
};

export function meta() {
  return [{ title: "Customers — ShopMart Admin" }];
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<AdminUser[]>("/admin/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  const filtered = (users ?? []).filter((u) =>
    q ? `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()) : true
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">{users ? `${users.length} registered ${users.length === 1 ? "account" : "accounts"}` : "Loading…"}</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          className="input max-w-xs"
          aria-label="Search customers"
        />
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(users ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">{users ? "No customers yet." : "Loading…"}</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="block font-semibold text-slate-900">{u.name}</span>
                  <span className="block text-xs text-slate-500">{u.email}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{u.orderCount ?? 0}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
