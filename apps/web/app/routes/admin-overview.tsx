import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

type Stats = {
  revenueCents: number;
  orders: number;
  users: number;
  activeProducts: number;
  lowStockProducts: number;
  recentOrders: Array<{ id: string; number: string; status: string; totalCents: number; createdAt: string; user: { name: string; email: string }; items?: Array<{ quantity: number }> }>;
};
type SaleRow = { id: string; title: string; sku: string; slug: string; stock: number; unitsSold: string | number; revenueCents: string | number };
type Account = { id: string; name: string; email: string; role: string; createdAt: string; orderCount: string | number; spentCents: string | number };
type LowStockItem = { id: string; title: string; sku: string; stock: number; slug: string };
type AdminEmail = { id: string; toEmail: string; subject: string; status: string; createdAt: string };

export function meta() {
  return [{ title: "Overview — ShopMart Admin" }];
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  shipped: "bg-sky-100 text-sky-700",
  delivered: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-700",
};
const n = (v: string | number) => Number(v ?? 0);

export default function AdminOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [emails, setEmails] = useState<AdminEmail[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get<Stats>("/admin/stats").then(setStats).catch(() => {});
    api.get<SaleRow[]>("/admin/sales-report").then(setSales).catch(() => {});
    api.get<Account[]>("/admin/users").then(setAccounts).catch(() => {});
    api.get<LowStockItem[]>("/admin/low-stock").then(setLowStock).catch(() => {});
    api.get<AdminEmail[]>("/admin/emails").then((e) => setEmails(e.slice(0, 5))).catch(() => {});
  }, [user]);

  if (user?.role !== "admin") return <div className="py-16 text-center text-slate-400">Loading…</div>;

  const sold = sales.filter((s) => n(s.unitsSold) > 0);
  const neverSold = sales.filter((s) => n(s.unitsSold) === 0);
  const needsRestock = [...lowStock].sort((a, b) => a.stock - b.stock);

  const cards = stats
    ? [
        { label: "Revenue (paid+)", value: formatPrice(stats.revenueCents) },
        { label: "Orders", value: stats.orders },
        { label: "Accounts created", value: stats.users },
        { label: "Active products", value: stats.activeProducts },
        { label: "Need restock (≤5)", value: needsRestock.length, warn: needsRestock.length > 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Every account, every sale, and everything that needs restocking — live from the store.</p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {(stats ? cards : Array.from({ length: 5 }, () => null)).map((c, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c?.label ?? "…"}</p>
            <p className={`mt-1.5 text-2xl font-extrabold tabular-nums ${c && "warn" in c && c.warn ? "text-amber-600" : "text-slate-900"}`}>
              {c?.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {/* 1. Accounts created */}
      <section id="accounts" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-bold text-slate-900">Accounts created <span className="text-slate-400">({accounts.length})</span></h2>
          <Link to="/admin/users" className="text-xs font-semibold text-brand-700 hover:underline">Open customers page →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Name</th>
                <th className="px-5 py-2.5">Email</th>
                <th className="px-5 py-2.5">Role</th>
                <th className="px-5 py-2.5">Joined</th>
                <th className="px-5 py-2.5 text-right">Orders</th>
                <th className="px-5 py-2.5 text-right">Total spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">{a.name}</td>
                  <td className="px-5 py-2.5 text-slate-600">{a.email}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${a.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>{a.role}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{new Date(a.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{n(a.orderCount)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{formatPrice(n(a.spentCents))}</td>
                </tr>
              ))}
              {accounts.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No accounts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Products sold */}
      <section id="sold" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-bold text-slate-900">Products sold <span className="text-slate-400">({sold.length} of {sales.length})</span></h2>
          <Link to="/admin/products" className="text-xs font-semibold text-brand-700 hover:underline">Manage catalog →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5">SKU</th>
                <th className="px-5 py-2.5 text-right">Units sold</th>
                <th className="px-5 py-2.5 text-right">Revenue</th>
                <th className="px-5 py-2.5 text-right">In stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sold.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">{s.title}</td>
                  <td className="px-5 py-2.5 text-slate-500">{s.sku}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{n(s.unitsSold)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{formatPrice(n(s.revenueCents))}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{s.stock}</td>
                </tr>
              ))}
              {sold.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nothing sold yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {neverSold.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Never sold — consider promoting these</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {neverSold.map((s) => (
                <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{s.title}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. Needs restocking */}
      <section id="restock" className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="flex items-center justify-between border-b border-amber-200 px-5 py-3">
          <h2 className="font-bold text-amber-900">Products to restock <span className="text-amber-700/70">(stock ≤ 5)</span></h2>
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900">{needsRestock.length} low</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-amber-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/70">
              <tr>
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5">SKU</th>
                <th className="px-5 py-2.5 text-right">Stock left</th>
                <th className="px-5 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {needsRestock.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 font-semibold text-slate-900">{p.title}</td>
                  <td className="px-5 py-2.5 text-slate-500">{p.sku}</td>
                  <td className="px-5 py-2.5 text-right font-bold tabular-nums text-amber-900">{p.stock}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-amber-200 text-amber-900"}`}>
                      {p.stock === 0 ? "Out of stock" : "Low stock"}
                    </span>
                  </td>
                </tr>
              ))}
              {needsRestock.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-amber-800/80">Nothing needs restocking right now. 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Operational details */}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-bold text-slate-900">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-brand-700 hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(stats?.recentOrders ?? []).slice(0, 6).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link to={`/account/orders/${o.id}`} className="font-semibold text-slate-900 hover:underline">{o.number}</Link>
                  <span className="block truncate text-xs text-slate-500">{o.user.name} · {new Date(o.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                  <span className="font-semibold tabular-nums">{formatPrice(o.totalCents)}</span>
                </span>
              </li>
            ))}
            {stats && stats.recentOrders.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No orders yet.</li>}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-bold text-slate-900">Email outbox</h2>
            <Link to="/admin/emails" className="text-xs font-semibold text-brand-700 hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {emails.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{e.subject}</span>
                  <span className="block truncate text-xs text-slate-500">{e.toEmail}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${e.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{e.status}</span>
              </li>
            ))}
            {emails.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No emails sent yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
