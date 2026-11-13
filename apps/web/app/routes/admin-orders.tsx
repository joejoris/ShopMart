import { useEffect, useState } from "react";
import { api, type Order, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

export function meta() {
  return [{ title: "Admin — Orders" }];
}

const statuses = ["pending", "paid", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Array<Order & { user: { name: string; email: string } }>>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api.get<Array<Order & { user: { name: string; email: string } }>>("/orders/admin/all").then(setOrders).catch(() => {});
  }, [user]);

  if (user?.role !== "admin") {
    return <p className="text-gray-500">Loading…</p>;
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (e: any) {
      alert(e?.message ?? "Update failed");
    }
  };

  return (
    <div className="card overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>{["Order", "Customer", "Date", "Total", "Status"].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2 font-medium">{o.number}</td>
              <td className="px-4 py-2">{o.user.name}<br /><span className="text-xs text-gray-500">{o.user.email}</span></td>
              <td className="px-4 py-2 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-2 font-semibold">{formatPrice(o.totalCents)}</td>
              <td className="px-4 py-2">
                <select className="input w-32" value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No orders yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
