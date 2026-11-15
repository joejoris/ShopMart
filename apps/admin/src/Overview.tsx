import { useEffect, useState } from "react";
import { api, formatPrice } from "./api";

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

const STATUS_STYLE: Record<string, string> = {
  paid: "badge badge-ok",
  shipped: "badge badge-info",
  delivered: "badge badge-ok",
  pending: "badge badge-warn",
  cancelled: "badge badge-danger",
};
const n = (v: string | number) => Number(v ?? 0);
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

export function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      api.get<Stats>("/admin/stats").catch(() => null),
      api.get<SaleRow[]>("/admin/sales-report").catch(() => [] as SaleRow[]),
      api.get<Account[]>("/admin/users").catch(() => [] as Account[]),
      api.get<LowStockItem[]>("/admin/low-stock").catch(() => [] as LowStockItem[]),
      api.get<AdminEmail[]>("/admin/emails").catch(() => [] as AdminEmail[]),
    ]).then(([s, saleRows, users, low, mail]) => {
      if (!live) return;
      setStats(s);
      setSales(saleRows);
      setAccounts(users);
      setLowStock(low);
      setEmails(mail.slice(0, 5));
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const sold = sales.filter((s) => n(s.unitsSold) > 0);
  const neverSold = sales.filter((s) => n(s.unitsSold) === 0);
  const needsRestock = [...lowStock].sort((a, b) => a.stock - b.stock);

  const kpis = [
    { label: "Revenue (paid+)", value: stats ? formatPrice(stats.revenueCents) : "…" },
    { label: "Orders", value: stats ? String(stats.orders) : "…" },
    { label: "Accounts created", value: stats ? String(stats.users) : "…" },
    { label: "Active products", value: stats ? String(stats.activeProducts) : "…" },
    { label: "Need restock (≤5)", value: stats ? String(needsRestock.length) : "…", warn: needsRestock.length > 0 },
  ];

  if (loading) return <div className="state">Loading dashboard…</div>;

  return (
    <>
      <div className="content-h">
        <div>
          <h1>Dashboard</h1>
          <p className="sub">Every account, every sale, and everything that needs restocking — live from MariaDB.</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.warn ? "warn" : ""}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 1. Accounts created */}
      <section className="card" id="accounts">
        <div className="card-h"><b>Accounts created <span className="dim">({accounts.length})</span></b></div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th className="num">Orders</th><th className="num">Total spent</th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.name}</b></td>
                  <td>{a.email}</td>
                  <td><span className={`badge ${a.role === "admin" ? "badge-purple" : "badge-info"}`}>{a.role}</span></td>
                  <td>{dateFmt(a.createdAt)}</td>
                  <td className="num">{n(a.orderCount)}</td>
                  <td className="num"><b>{formatPrice(n(a.spentCents))}</b></td>
                </tr>
              ))}
              {accounts.length === 0 && <tr><td colSpan={6} className="state">No accounts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Products sold */}
      <section className="card" id="sold">
        <div className="card-h"><b>Products sold <span className="dim">({sold.length} of {sales.length})</span></b></div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th className="num">Units sold</th><th className="num">Revenue</th><th className="num">In stock</th></tr>
            </thead>
            <tbody>
              {sold.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.title}</b></td>
                  <td>{s.sku}</td>
                  <td className="num"><b>{n(s.unitsSold)}</b></td>
                  <td className="num">{formatPrice(n(s.revenueCents))}</td>
                  <td className="num">{s.stock}</td>
                </tr>
              ))}
              {sold.length === 0 && <tr><td colSpan={5} className="state">Nothing sold yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {neverSold.length > 0 && (
          <div className="card-b" style={{ borderTop: "1px solid #eef2f7" }}>
            <div className="kpi-label">Never sold — consider promoting these</div>
            <div className="chips" style={{ marginTop: 8 }}>
              {neverSold.map((s) => <span key={s.id} className="chip">{s.title}</span>)}
            </div>
          </div>
        )}
      </section>

      {/* 3. Needs restocking */}
      <section className="card restock-card" id="restock">
        <div className="card-h"><b>Products to restock <span className="dim">(stock ≤ 5)</span></b><span className="badge badge-warn">{needsRestock.length} to restock</span></div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th className="num">Stock left</th><th className="num">Status</th></tr>
            </thead>
            <tbody>
              {needsRestock.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.title}</b></td>
                  <td>{p.sku}</td>
                  <td className="num"><b>{p.stock}</b></td>
                  <td className="num">
                    <span className={`badge ${p.stock === 0 ? "badge-danger" : "badge-warn"}`}>{p.stock === 0 ? "Out of stock" : "Low stock"}</span>
                  </td>
                </tr>
              ))}
              {needsRestock.length === 0 && <tr><td colSpan={4} className="state">Nothing needs restocking right now. 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Operational detail */}
      <div className="two-col">
        <section className="card">
          <div className="card-h"><b>Recent orders</b></div>
          <table>
            <tbody>
              {(stats?.recentOrders ?? []).slice(0, 6).map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.number}</b>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{o.user.name} · {dateFmt(o.createdAt)}</div>
                  </td>
                  <td><span className={STATUS_STYLE[o.status] ?? "badge badge-info"}>{o.status}</span></td>
                  <td className="num"><b>{formatPrice(o.totalCents)}</b></td>
                </tr>
              ))}
              {(!stats || stats.recentOrders.length === 0) && <tr><td className="state">No orders yet.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-h"><b>Email outbox</b></div>
          <table>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{e.toEmail}</div>
                  </td>
                  <td className="num"><span className={`badge ${e.status === "sent" ? "badge-ok" : "badge-warn"}`}>{e.status}</span></td>
                </tr>
              ))}
              {emails.length === 0 && <tr><td className="state">No emails sent yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
