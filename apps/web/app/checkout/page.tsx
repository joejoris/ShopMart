"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, Cart, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

export default function CheckoutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [addressId, setAddressId] = useState<string>("");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [newAddr, setNewAddr] = useState({ fullName: "", line1: "", city: "", state: "", postalCode: "", country: "US" });
  const [showNewAddr, setShowNewAddr] = useState(false);

  useEffect(() => { if (!user) router.replace("/auth/login?next=/checkout"); }, [user, router]);

  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: () => api.get<Cart>("/cart"), enabled: !!user });
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<Array<{ id: string; fullName: string; line1: string; city: string; state: string; postalCode: string; country: string }>>("/users/addresses"),
    enabled: !!user,
  });

  useEffect(() => {
    if (addresses?.length && !addressId) setAddressId(addresses[0].id);
  }, [addresses, addressId]);

  const subtotal = cart?.subtotalCents ?? 0;
  const [discountCents, setDiscountCents] = useState(0);
  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const res = await api.get<{ valid: boolean; reason?: string; coupon?: { type: string; value: number } }>(
        `/coupons/validate?code=${encodeURIComponent(coupon.trim())}&subtotalCents=${subtotal}`
      );
      if (res.valid && res.coupon) {
        const d = res.coupon.type === "percent" ? Math.round((subtotal * res.coupon.value) / 100) : Math.round(res.coupon.value * 100);
        setDiscountCents(Math.min(d, subtotal));
        setCouponMsg(`✓ Coupon applied (-${formatPrice(Math.min(d, subtotal))})`);
      } else {
        setDiscountCents(0);
        setCouponMsg(res.reason ?? "Invalid coupon");
      }
    } catch {
      setCouponMsg("Could not validate coupon");
    }
  };

  const shippingCents = shippingMethod === "express" ? 999 : (subtotal - discountCents) >= 5000 ? 0 : 499;
  const taxCents = Math.round((subtotal - discountCents) * 0.08);
  const totalCents = subtotal - discountCents + shippingCents + taxCents;

  const placeOrder = useMutation({
    mutationFn: async () => {
      const order = await api.post<{ id: string }>("/orders", { addressId, couponCode: coupon.trim() || null, shippingMethod });
      await api.post(`/payments/orders/${order.id}/mock-pay`);
      return order;
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      router.push(`/checkout/success?orderId=${order.id}`);
    },
  });

  const saveAddress = useMutation({
    mutationFn: () => api.post("/users/addresses", newAddr),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); setShowNewAddr(false); setNewAddr({ fullName: "", line1: "", city: "", state: "", postalCode: "", country: "US" }); },
  });

  if (!user) return null;
  if (!cart) return <p className="py-16 text-center text-gray-500">Loading…</p>;
  if (cart.items.length === 0) return (
    <div className="py-16 text-center"><p className="text-gray-500">Your cart is empty.</p><Link href="/products" className="btn mt-4">Shop now</Link></div>
  );

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Delivery address</h2>
              <button className="text-sm text-brand-700 hover:underline" onClick={() => setShowNewAddr((v) => !v)}>+ Add new</button>
            </div>
            {showNewAddr && (
              <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); saveAddress.mutate(); }}>
                <input className="input" placeholder="Full name" value={newAddr.fullName} onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })} required />
                <input className="input" placeholder="Address line 1" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} required />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="City" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} required />
                  <input className="input" placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Postal code" value={newAddr.postalCode} onChange={(e) => setNewAddr({ ...newAddr, postalCode: e.target.value })} required />
                  <input className="input" placeholder="Country" value={newAddr.country} onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })} required />
                </div>
                <button className="btn w-fit" type="submit">Save address</button>
              </form>
            )}
            <div className="mt-3 grid gap-2">
              {(addresses ?? []).map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${addressId === a.id ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
                  <input type="radio" name="address" className="mt-1" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="text-sm"><strong>{a.fullName}</strong><br />{a.line1}<br />{a.city}, {a.state} {a.postalCode}, {a.country}</span>
                </label>
              ))}
              {addresses?.length === 0 && !showNewAddr && <p className="text-sm text-gray-500">No addresses yet — add one above.</p>}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Shipping method</h2>
            <div className="mt-3 grid gap-2">
              {[
                { id: "standard", label: "Standard (3–5 days)", cost: subtotal - discountCents >= 5000 ? 0 : 499 },
                { id: "express", label: "Express (1–2 days)", cost: 999 },
              ].map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${shippingMethod === m.id ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
                  <span className="flex items-center gap-3 text-sm"><input type="radio" name="ship" checked={shippingMethod === (m.id as any)} onChange={() => setShippingMethod(m.id as any)} />{m.label}</span>
                  <span className="text-sm font-semibold">{m.cost === 0 ? "Free" : formatPrice(m.cost)}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Coupon</h2>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="e.g. WELCOME10" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
              <button className="btn-outline" onClick={applyCoupon}>Apply</button>
            </div>
            {couponMsg && <p className="mt-2 text-sm text-gray-600">{couponMsg}</p>}
          </section>
        </div>

        <aside className="card h-fit space-y-2 p-5 text-sm">
          <h2 className="text-lg font-bold">Summary</h2>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
          {discountCents > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>−{formatPrice(discountCents)}</span></div>}
          <div className="flex justify-between"><span>Shipping</span><span>{shippingCents === 0 ? "Free" : formatPrice(shippingCents)}</span></div>
          <div className="flex justify-between"><span>Tax (8%)</span><span>{formatPrice(taxCents)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatPrice(totalCents)}</span></div>
          <button className="btn w-full py-3 text-base" disabled={!addressId || placeOrder.isPending} onClick={() => placeOrder.mutate()}>
            {placeOrder.isPending ? "Placing order…" : `Pay ${formatPrice(totalCents)}`}
          </button>
          {placeOrder.isError && <p className="text-xs text-red-600">{(placeOrder.error as Error).message}</p>}
          <p className="text-xs text-gray-400">Demo checkout — payment is simulated via the mock-pay endpoint (no real charge). Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + Stripe.js to enable Stripe Elements.</p>
        </aside>
      </div>
    </div>
  );
}
