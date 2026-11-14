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
  topProducts: Array<{ product?: { title: string; slug: string }; unitsSold: number }>;
};
type LowStockItem = { id: string; title: string; slug: string; stock: number; sku: string };
type AdminUser = { id: string; name: string; email: string; role: string; createdAt: string; orderCount: string | number };
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

export default function AdminOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [emails, setEmails] = useState<AdminEmail[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get<Stats>("/admin/stats").then(setStats).catch(() => {});
    api.get<LowStockItem[]>("/admin/low-stock").then(setLowStock).catch(() => {});
    api.get<AdminUser[]>("/admin/users").then(setCustomers).catch(() => {});
    api.get<AdminEmail[]>("/admin/emails").then((e) => setEmails(e.slice(0, 6))).catch(() => {});
  }, [user]);

  if (user?.role !== "admin") return <div className="py-16 text-center text-slate-400">Loading…</div>;

  const cards = stats
    ? [
        { label: "Revenue (paid+)", value: formatPrice(stats.revenueCents) },
        { label: "Orders", value: stats.orders },
        { label: "Customers", value: stats.users },
        { label: "Active products", value: stats.activeProducts },
        { label: "Low stock (≤5)", value: stats.lowStockProducts, warn: stats.lowStockProducts > 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">Everything happening across ShopMart Kenya, in one place.</p>
        </div>
        <Link to="/admin/orders" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Manage orders →
        </Link>
      </header>

      {/* KPI cards */}
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

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Recent orders */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-bold text-slate-900">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-brand-700 hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(stats?.recentOrders ?? []).slice(0, 8).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link to={`/account/orders/${o.id}`} className="font-semibold text-slate-900 hover:underline">{o.number}</Link>
                  <p className="truncate text-xs text-slate-500">{o.user.name} · {new Date(o.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} · {(o.items ?? []).reduce((a, i) => a + i.quantity, 0)} item(s)</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                  <span className="font-semibold tabular-nums">{formatPrice(o.totalCents)}</span>
                </div>
              </li>
            ))}
            {stats && stats.recentOrders.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No orders yet.</li>}
          </ul>
        </section>

        <div className="space-y-5">
          {/* Top products */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Top products</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {(stats?.topProducts ?? []).slice(0, 5).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate"><span className="mr-2 font-bold text-slate-400">{i + 1}.</span>{t.product?.title ?? "—"}</span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{t.unitsSold} sold</span>
                </li>
              ))}
              {stats && stats.topProducts.length === 0 && <li className="text-slate-400">No sales yet.</li>}
            </ol>
          </section>

          {/* Low stock */}
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="font-bold text-amber-900">Low-stock inventory <span className="text-xs font-semibold text-amber-700">(≤ 5 units)</span></h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <Link to="/admin/products" className="min-w-0 truncate font-medium text-amber-900 hover:underline">{p.title}</Link>
                  <span className="shrink-0 rounded-md bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">{p.stock} left</span>
                </li>
              ))}
              {lowStock.length === 0 && <li className="text-amber-800/80">All good — nothing low on stock.</li>}
            </ul>
          </section>
        </div>

        {/* Latest customers */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-bold text-slate-900">Latest customers</h2>
            <Link to="/admin/users" className="text-xs font-semibold text-brand-700 hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {customers.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">{c.email}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-600">{c.orderCount ?? 0} orders</span>
              </li>
            ))}
            {customers.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No customers yet.</li>}
          </ul>
        </section>

        {/* Email outbox */}
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
