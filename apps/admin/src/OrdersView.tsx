import { useEffect, useState } from "react";
import { api, formatPrice } from "./api";

type Order = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  createdAt: string;
  shippingMethod: string | null;
  user: { name: string; email: string };
};

const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];
const STATUS_STYLE: Record<string, string> = {
  paid: "badge badge-ok",
  shipped: "badge badge-info",
  delivered: "badge badge-ok",
  pending: "badge badge-warn",
  cancelled: "badge badge-danger",
};

export function OrdersView() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => api.get<Order[]>("/orders/admin/all").then(setOrders).catch(() => setOrders([]));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setMsg("");
    try {
      await api.put(`/orders/${id}/status`, { status });
      setOrders((prev) => (prev ?? []).map((o) => (o.id === id ? { ...o, status } : o)));
      setMsg("Saved ✓");
    } catch (e: any) {
      setMsg(e?.message ?? "Update failed");
    }
  };

  return (
    <>
      <div className="content-h">
        <div>
          <h1>Orders</h1>
          <p className="sub">Every order across the store. Change a status from the dropdown.</p>
        </div>
        {msg && <span className="badge badge-ok">{msg}</span>}
      </div>
      <section className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Date</th><th className="num">Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => (
                <tr key={o.id}>
                  <td><b>{o.number}</b></td>
                  <td>{o.user.name}<div style={{ color: "#64748b", fontSize: 12 }}>{o.user.email}</div></td>
                  <td>{new Date(o.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="num"><b>{formatPrice(o.totalCents)}</b></td>
                  <td>
                    <select className="status-select" value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} aria-label={`Status for ${o.number}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>{" "}
                    <span className={STATUS_STYLE[o.status] ?? "badge badge-info"} style={{ marginLeft: 6 }}>{o.status}</span>
                  </td>
                </tr>
              ))}
              {orders && orders.length === 0 && <tr><td colSpan={5} className="state">No orders yet.</td></tr>}
              {!orders && <tr><td colSpan={5} className="state">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
