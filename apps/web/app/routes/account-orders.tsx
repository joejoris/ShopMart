import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, type Order, formatPrice } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";

export function meta() {
  return [{ title: "My orders — ShopMart" }];
}

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hydrated = useIsHydrated();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/account/orders", { replace: true });
  }, [hydrated, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get<Order[]>("/orders").then(setOrders).catch(() => setOrders([]));
  }, [user]);

  if (!hydrated || !user) {
    return <div className="py-16 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">My orders</h1>
      <div className="mt-4 space-y-3">
        {orders === null && <p className="text-gray-500">Loading…</p>}
        {orders?.map((o) => (
          <Link key={o.id} to={`/account/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow-md">
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
        {orders && orders.length === 0 && <p className="text-gray-500">No orders yet. <Link to="/products" className="text-brand-700 hover:underline">Start shopping →</Link></p>}
      </div>
    </div>
  );
}
