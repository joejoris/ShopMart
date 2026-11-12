"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Order, formatPrice } from "@/lib/api";

const statuses = ["pending", "paid", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api.get<Array<Order & { user: { name: string; email: string } }>>("/orders/admin/all"),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  if (isLoading) return <p className="text-gray-500">Loading…</p>;
  return (
    <div className="card overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>{["Order", "Customer", "Date", "Total", "Status"].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {(orders ?? []).map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2 font-medium">{o.number}</td>
              <td className="px-4 py-2">{o.user.name}<br /><span className="text-xs text-gray-500">{o.user.email}</span></td>
              <td className="px-4 py-2 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-2 font-semibold">{formatPrice(o.totalCents)}</td>
              <td className="px-4 py-2">
                <select className="input w-32" value={o.status} onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value })}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
