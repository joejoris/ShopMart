"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, formatPrice } from "@/lib/api";

type Stats = {
  revenueCents: number;
  orders: number;
  users: number;
  activeProducts: number;
  lowStockProducts: number;
  recentOrders: Array<{ id: string; number: string; status: string; totalCents: number; createdAt: string; user: { name: string } }>;
  topProducts: Array<{ product: { title: string; slug: string } | undefined; unitsSold: number }>;
};

export default function AdminOverview() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.get<Stats>("/admin/stats") });
  if (isLoading || !data) return <p className="text-gray-500">Loading…</p>;

  const cards = [
    { label: "Revenue", value: formatPrice(data.revenueCents) },
    { label: "Orders", value: data.orders },
    { label: "Customers", value: data.users },
    { label: "Active products", value: data.activeProducts },
    { label: "Low stock (≤5)", value: data.lowStockProducts },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold">Recent orders</h2>
          <ul className="mt-3 divide-y text-sm">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2">
                <div>
                  <Link href={`/account/orders/${o.id}`} className="font-medium hover:underline">{o.number}</Link>
                  <p className="text-xs text-gray-500">{o.user.name} · {new Date(o.createdAt).toLocaleDateString()} · {o.status}</p>
                </div>
                <span className="font-semibold">{formatPrice(o.totalCents)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Top products (units sold)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {data.topProducts.map((t, i) => (
              <li key={i}><span className="font-medium">{t.product?.title ?? "—"}</span> — {t.unitsSold} sold</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
