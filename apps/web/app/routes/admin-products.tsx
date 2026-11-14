import { FormEvent, useEffect, useState } from "react";
import { api, type Product, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

export function meta() {
  return [{ title: "Admin — Products" }];
}

const emptyForm = { title: "", slug: "", description: "", priceCents: 0, sku: "", stock: 0, categoryId: "", images: "", status: "active", featured: false };

export default function AdminProducts() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [busy, setBusy] = useState(false);

  const reload = () => api.get<{ items: Product[] }>("/products?pageSize=50").then((d) => setProducts(d.items)).catch(() => {});
  useEffect(() => {
    reload();
    api.get<Array<{ id: string; name: string; slug: string }>>("/categories").then(setCategories).catch(() => {});
  }, []);

  if (user?.role !== "admin") {
    return <p className="text-gray-500">Loading…</p>;
  }

  const startEdit = (p: Product) => {
    setEditing(p.id);
    setForm({
      title: p.title, slug: p.slug, description: p.description,
      priceCents: p.priceCents, sku: p.sku, stock: p.stock,
      categoryId: p.category?.id ?? "", images: (p.images ?? []).join(", "), status: "active", featured: !!p.featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const payload = {
      ...form,
      priceCents: Number(form.priceCents),
      stock: Number(form.stock),
      images: form.images.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing) await api.put(`/products/${editing}`, payload);
      else await api.post("/products", payload);
      setForm(emptyForm);
      setEditing(null);
      setMsg("Saved ✓");
      reload();
    } catch (err: any) {
      setMsg(err.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Products</h1>
        <p className="text-sm text-slate-500">Create, edit, feature and retire catalog items.</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <form className="card h-fit space-y-2 p-4" onSubmit={submit}>
        <h2 className="font-bold">{editing ? "Edit product" : "New product"}</h2>
        <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <input className="input" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
        </div>
        <textarea className="input min-h-20" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" placeholder="Price (cents)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })} required />
          <input className="input" type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} required />
        </div>
        <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
          <option value="">Select category…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" placeholder="Image URLs, comma-separated" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} />
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          <span>★ Show on homepage (featured)</span>
        </label>
        <div className="flex gap-2">
          <button className="btn flex-1" type="submit" disabled={busy}>{editing ? "Update" : "Create"}</button>
          {editing && <button type="button" className="btn-outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</button>}
        </div>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
      </form>

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>{["Title", "SKU", "Price", "Stock", "★", ""].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium">{p.title}</td>
                <td className="px-4 py-2 text-gray-500">{p.sku}</td>
                <td className="px-4 py-2">{formatPrice(p.priceCents)}</td>
                <td className="px-4 py-2">{p.stock}</td>
                <td className="px-4 py-2 text-amber-500">{p.featured ? "★" : ""}</td>
                <td className="px-4 py-2 text-right"><button className="text-brand-700 hover:underline" onClick={() => startEdit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
