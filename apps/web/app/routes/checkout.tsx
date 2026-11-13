import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { api, formatPrice, type Cart } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";
import { useCart } from "@/components/CartContext";

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export function meta() {
  return [{ title: "Checkout — ShopMart" }];
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hydrated = useIsHydrated();
  const { cart, refresh } = useCart();
  const [addressId, setAddressId] = useState("");
  const [addresses, setAddresses] = useState<Array<{ id: string; fullName: string; line1: string; city: string; state: string; postalCode: string; country: string }>>([]);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paymentRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeError, setStripeError] = useState("");

  // Gate the checkout on sign-in once hydration is known.
  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/checkout", { replace: true });
  }, [hydrated, user, navigate]);

  // Load addresses once signed in.
  useEffect(() => {
    if (!user) return;
    api.get<typeof addresses>("/users/addresses")
      .then((addrs) => {
        setAddresses(addrs);
        setAddressId((prev) => prev || addrs[0]?.id || "");
      })
      .catch(() => {});
  }, [user]);

  // Load Stripe.js when a publishable key is configured.
  useEffect(() => {
    if (!STRIPE_PK) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || elementsRef.current || !paymentRef.current) return;
      const stripe = (window as any).Stripe(STRIPE_PK);
      const elements = stripe.elements();
      elements.create("payment").mount(paymentRef.current);
      stripeRef.current = stripe;
      elementsRef.current = elements;
      setStripeReady(true);
    };
    const src = "https://js.stripe.com/v3";
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((window as any).Stripe) init();
      else existing.addEventListener("load", init);
    } else {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.addEventListener("load", init);
      s.addEventListener("error", () => setStripeError("Could not load Stripe.js"));
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, []);

  const subtotal = cart?.subtotalCents ?? 0;
  const shippingCents = shippingMethod === "express" ? 999 : (subtotal - discountCents) >= 5000 ? 0 : 499;
  const taxCents = Math.round((subtotal - discountCents) * 0.08);
  const totalCents = subtotal - discountCents + shippingCents + taxCents;

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const res = await api.get<{ valid: boolean; reason?: string; coupon?: { type: string; value: number } }>(
        `/coupons/validate?code=${encodeURIComponent(coupon.trim())}&subtotalCents=${subtotal}`
      );
      if (res.valid && res.coupon) {
        const d = res.coupon.type === "percent" ? Math.round((subtotal * res.coupon.value) / 100) : Math.round(res.coupon.value * 100);
        setDiscountCents(Math.min(d, subtotal));
        setCouponMsg(`✓ Coupon applied (−${formatPrice(Math.min(d, subtotal))})`);
      } else {
        setDiscountCents(0);
        setCouponMsg(res.reason ?? "Invalid coupon");
      }
    } catch (e: any) {
      setCouponMsg(e.message ?? "Could not validate coupon");
    }
  };

  const placeOrder = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const order = await api.post<{ id: string }>("/orders", { addressId, couponCode: coupon.trim() || null, shippingMethod });
      if (STRIPE_PK && stripeRef.current && elementsRef.current) {
        const intent = await api.post<{ clientSecret: string | null }>(`/payments/orders/${order.id}/create-intent`);
        if (intent.clientSecret) {
          const result = await stripeRef.current.confirmPayment({ elements: elementsRef.current, clientSecret: intent.clientSecret, redirect: "if_required" });
          if (result.error) throw new Error(result.error.message ?? "Payment failed");
        }
        await api.post(`/payments/orders/${order.id}/confirm`);
      } else {
        await api.post(`/payments/orders/${order.id}/mock-pay`);
      }
      await refresh();
      navigate(`/checkout/success?orderId=${order.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || !user) {
    return <div className="py-16 text-center text-gray-500">Loading your session…</div>;
  }
  if (!cart) {
    return <div className="py-16 text-center text-gray-500">Loading your cart…</div>;
  }
  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Your cart is empty.</p>
        <Link to="/products" className="btn mt-4">Shop now</Link>
      </div>
    );
  }

  return (
    <form className="py-6" onSubmit={placeOrder}>
      <h1 className="text-2xl font-bold">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-bold">Delivery address</h2>
            <div className="mt-3 grid gap-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${addressId === a.id ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
                  <input type="radio" name="address" className="mt-1" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="text-sm"><strong>{a.fullName}</strong><br />{a.line1}<br />{a.city}, {a.state} {a.postalCode}, {a.country}</span>
                </label>
              ))}
              {addresses.length === 0 && <p className="text-sm text-gray-500">No addresses yet. Save one first from your account page.</p>}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Shipping method</h2>
            <div className="mt-3 grid gap-2">
              {[
                { id: "standard", label: "Standard (3–5 days)", cost: subtotal - discountCents >= 5000 ? 0 : 499 },
                { id: "express", label: "Express (1–2 days)", cost: 999 },
              ].map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${shippingMethod === (m.id as any) ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
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
              <button type="button" className="btn-outline" onClick={applyCoupon}>Apply</button>
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
          {STRIPE_PK && (
            <div className="space-y-1 border-t pt-2">
              <p className="text-xs font-semibold uppercase text-gray-500">Payment</p>
              <div ref={paymentRef} className="rounded-md border border-gray-200 p-3" />
              {!stripeReady && !stripeError && <p className="text-xs text-gray-400">Loading secure payment form…</p>}
              {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
            </div>
          )}
          <button type="submit" className="btn w-full py-3 text-base" disabled={!addressId || busy || (STRIPE_PK ? !stripeReady : false)}>
            {busy ? "Placing order…" : STRIPE_PK ? `Pay ${formatPrice(totalCents)}` : `Pay ${formatPrice(totalCents)} (demo)`}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!STRIPE_PK && <p className="text-xs text-gray-400">Demo checkout: payment is simulated via mock-pay. Set VITE_STRIPE_PUBLISHABLE_KEY to enable real Stripe test payments.</p>}
        </aside>
      </div>
    </form>
  );
}
