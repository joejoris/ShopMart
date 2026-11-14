import { FormEvent, useEffect, useState } from "react";
import { api, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

export function meta() {
  return [{ title: "Coupons — ShopMart Admin" }];
}

type Coupon = { id: string; code: string; type: string; value: number; minOrderCents: number; active: boolean; usedCount: number };
const empty = { code: "", type: "percent", value: 10, minOrderKsh: 0, usageLimit: "" };

export default function AdminCoupons() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [msg, setMsg] = useState("");

  const reload = () => api.get<Coupon[]>("/coupons").then(setCoupons).catch(() => {});
  useEffect(() => { reload(); }, []);

  if (user?.role !== "admin") {
    return <p className="text-slate-400">Loading…</p>;
  }

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/coupons", {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrderCents: Math.round(Number(form.minOrderKsh) * 100),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      });
      setForm(empty);
      setMsg("Created ✓");
      reload();
    } catch (err: any) {
      setMsg(err.message ?? "Failed");
    }
  };

  const deactivate = async (id: string) => {
    await api.del(`/coupons/${id}`);
    reload();
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Coupons</h1>
        <p className="text-sm text-slate-500">Create and deactivate discount codes.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form className="h-fit space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={create}>
          <h2 className="font-bold text-slate-900">New coupon</h2>
          <input className="input" placeholder="CODE (e.g. WELCOME10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">% percent</option>
              <option value="fixed">Ksh fixed</option>
            </select>
            <input className="input" type="number" min={0} placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" min={0} step="0.01" placeholder="Min order (Ksh)" value={form.minOrderKsh} onChange={(e) => setForm({ ...form, minOrderKsh: Number(e.target.value) })} />
            <input className="input" type="number" min={1} placeholder="Usage limit (optional)" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          </div>
          <button className="btn w-full" type="submit">Create coupon</button>
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>{["Code", "Type", "Value", "Min order", "Used", ""].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((c) => (
                <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-600">{c.type}</td>
                  <td className="px-4 py-2.5 font-semibold">{c.type === "percent" ? `${c.value}%` : `Ksh ${Number(c.value).toLocaleString("en-KE")}`}</td>
                  <td className="px-4 py-2.5">{c.minOrderCents > 0 ? formatPrice(c.minOrderCents) : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{c.usedCount}</td>
                  <td className="px-4 py-2.5 text-right">{c.active && <button className="text-red-600 hover:underline" onClick={() => deactivate(c.id)}>Deactivate</button>}</td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No coupons yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
