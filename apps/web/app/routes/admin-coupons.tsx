import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

export function meta() {
  return [{ title: "Admin — Coupons" }];
}

type Coupon = { id: string; code: string; type: string; value: number; minOrderCents: number; active: boolean; usedCount: number };
const empty = { code: "", type: "percent", value: 10, minOrderCents: 0, usageLimit: "" };

export default function AdminCoupons() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [msg, setMsg] = useState("");

  const reload = () => api.get<Coupon[]>("/coupons").then(setCoupons).catch(() => {});
  useEffect(() => { reload(); }, []);

  if (user?.role !== "admin") {
    return <p className="text-gray-500">Loading…</p>;
  }

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/coupons", {
        ...form,
        value: Number(form.value),
        minOrderCents: Number(form.minOrderCents),
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
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className="card h-fit space-y-2 p-4" onSubmit={create}>
        <h2 className="font-bold">New coupon</h2>
        <input className="input" placeholder="CODE (e.g. WELCOME10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="percent">% percent</option>
            <option value="fixed">$ fixed</option>
          </select>
          <input className="input" type="number" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" placeholder="Min order (cents)" value={form.minOrderCents} onChange={(e) => setForm({ ...form, minOrderCents: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Usage limit (optional)" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
        </div>
        <button className="btn w-full" type="submit">Create coupon</button>
        {msg && <p className="text-sm text-gray-600">{msg}</p>}
      </form>

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>{["Code", "Type", "Value", "Min order", "Used", ""].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {coupons.map((c) => (
              <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                <td className="px-4 py-2 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-2">{c.type}</td>
                <td className="px-4 py-2">{c.type === "percent" ? `${c.value}%` : `$${c.value}`}</td>
                <td className="px-4 py-2">${(c.minOrderCents / 100).toFixed(2)}</td>
                <td className="px-4 py-2">{c.usedCount}</td>
                <td className="px-4 py-2 text-right">{c.active && <button className="text-red-600 hover:underline" onClick={() => deactivate(c.id)}>Deactivate</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
