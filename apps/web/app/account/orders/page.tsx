"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, Order, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => { if (!user) router.replace("/auth/login?next=/account/orders"); }, [user, router]);
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<Order[]>("/orders"),
    enabled: !!user,
  });

  if (!user) return null;
  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">My orders</h1>
      {isLoading && <p className="mt-4 text-gray-500">Loading…</p>}
      <div className="mt-4 space-y-3">
        {(orders ?? []).map((o) => (
          <Link key={o.id} href={`/account/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow-md">
            <div>
              <p className="font-semibold">{o.number}</p>
              <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()} · {o.items.length} item(s)</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              o.status === "paid" ? "bg-green-100 text-green-800" :
              o.status === "cancelled" ? "bg-red-100 text-red-800" :
              o.status === "delivered" ? "bg-blue-100 text-blue-800" :
              "bg-amber-100 text-amber-800"
            }`}>{o.status}</span>
            <p className="font-bold">{formatPrice(o.totalCents)}</p>
          </Link>
        ))}
        {orders && orders.length === 0 && <p className="text-gray-500">No orders yet. <Link href="/products" className="text-brand-700 hover:underline">Start shopping →</Link></p>}
      </div>
    </div>
  );
}
