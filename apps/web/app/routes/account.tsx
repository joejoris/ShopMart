import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, formatPrice, type Order } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";

export function meta() {
  return [{ title: "My account — ShopMart Kenya" }];
}

type Address = { id: string; fullName: string; line1: string; line2: string | null; city: string; state: string; postalCode: string | null; country: string; phone: string | null; isDefault: boolean };

const emptyAddressForm = { fullName: "", phone: "", line1: "", line2: "", city: "", county: "", postalCode: "" };

export default function Account() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const hydrated = useIsHydrated();
  const [me, setMe] = useState<{ name: string; email: string; emailVerified: boolean } | null>(null);
  const [resent, setResent] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyAddressForm);
  const [addressMsg, setAddressMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/account", { replace: true });
  }, [hydrated, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get<{ name: string; email: string; emailVerified: boolean }>("/users/me").then(setMe).catch(() => {});
    api.get<Address[]>("/users/addresses").then(setAddresses).catch(() => {});
  }, [user]);

  const resend = async () => {
    try { await api.post("/auth/resend-verification"); setResent(true); } catch {}
  };

  const submitAddress = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAddressMsg("");
    try {
      const created = await api.post<Address>("/users/addresses", {
        fullName: form.fullName,
        phone: form.phone,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city,
        state: form.county, // API column is `state`; UI presents it as "County" for Kenya
        postalCode: form.postalCode || null,
        country: "KE",
        isDefault: addresses.length === 0, // first address becomes default
      });
      setAddresses((prev) => [created, ...prev]);
      setForm(emptyAddressForm);
      setShowForm(false);
      setAddressMsg("✓ Address saved");
    } catch (err: any) {
      setAddressMsg(err?.message ?? "Could not save address");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || !user) {
    return <div className="py-16 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">My account</h1>

      <div className="card mt-4 p-6">
        <p className="text-lg font-semibold">{me?.name ?? user.name}</p>
        <p className="text-gray-500">{me?.email ?? user.email}</p>
        <p className="mt-1 text-xs uppercase text-gray-400">Role: {user.role}</p>
        <div className="mt-3">
          {me?.emailVerified ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">✓ Email verified</span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Email not verified</span>
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={resend} disabled={resent}>
                {resent ? "Verification email sent ✓" : "Resend verification email"}
              </button>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/account/orders" className="btn-outline">My orders</Link>
          <Link to="/wishlist" className="btn-outline">Wishlist</Link>
          {user.role === "admin" && <Link to="/admin" className="btn">Admin dashboard</Link>}
        </div>
      </div>

      <section className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Delivery addresses</h2>
          <button className="btn-outline text-xs" onClick={() => setShowForm((v) => !v)}>{showForm ? "Hide" : "+ Add address"}</button>
        </div>

        {showForm && (
          <form onSubmit={submitAddress} className="mt-4 grid gap-2">
            <input className="input" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="input" type="tel" placeholder="Phone (+2547XX.. or 07XX..)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required pattern="^(\+2547\d{8}|\+2541\d{8}|07\d{8}|01\d{8})$" />
              <input className="input" placeholder="Estate / Street / Apartment" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
            </div>
            <input className="input" placeholder="Apt / suite (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              <input className="input" placeholder="County (e.g. Nairobi)" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} required />
              <input className="input" placeholder="P.O. Box (optional)" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </div>
            <p className="text-xs text-gray-400">Country: Kenya 🇰🇪 (change later if you ship outside Kenya)</p>
            <button className="btn w-fit text-sm" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
            {addressMsg && <p className="text-sm text-green-700">{addressMsg}</p>}
          </form>
        )}

        <ul className="mt-4 divide-y text-sm">
          {addresses.map((a) => (
            <li key={a.id} className="py-3">
              <p className="font-semibold">{a.fullName} {a.isDefault && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] uppercase text-blue-800">Default</span>}</p>
              {a.line1 && <p className="text-gray-700">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>}
              <p className="text-gray-500">{a.city}, {a.state}{a.postalCode ? ` · P.O. Box ${a.postalCode}` : ""}, Kenya</p>
              <p className="text-gray-500">{a.phone}</p>
            </li>
          ))}
          {addresses.length === 0 && <li className="py-4 text-gray-500">No addresses yet. Add one to enable checkout.</li>}
        </ul>
      </section>
    </div>
  );
}
