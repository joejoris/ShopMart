import { useEffect, useState } from "react";
import { api, formatPrice } from "./api";

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  orderCount: string | number;
  spentCents: string | number;
};
const n = (v: string | number) => Number(v ?? 0);

export function CustomersView() {
  const [users, setUsers] = useState<Account[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<Account[]>("/admin/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  const filtered = (users ?? []).filter((u) => (q ? `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <>
      <div className="content-h">
        <div>
          <h1>Customers</h1>
          <p className="sub">{users ? `${users.length} registered account${users.length === 1 ? "" : "s"}` : "Loading…"}</p>
        </div>
        <input className="search" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      </div>
      <section className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Customer</th><th>Role</th><th className="num">Orders</th><th className="num">Total spent</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{u.email}</div></td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-purple" : "badge-info"}`}>{u.role}</span></td>
                  <td className="num">{n(u.orderCount)}</td>
                  <td className="num"><b>{formatPrice(n(u.spentCents))}</b></td>
                  <td>{new Date(u.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
              {users && filtered.length === 0 && <tr><td colSpan={5} className="state">No customers match "{q}".</td></tr>}
              {users && users.length === 0 && <tr><td colSpan={5} className="state">No customers yet.</td></tr>}
              {!users && <tr><td colSpan={5} className="state">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
