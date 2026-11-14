import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { api, formatPrice, type Cart } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";
import { useCart } from "@/components/CartContext";
import { FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_FLAT_CENTS, TAX_RATE } from "@ecommerce/shared";

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export function meta() {
  return [{ title: "Checkout — ShopMart Kenya" }];
}

type PaymentMethod = "mpesa" | "stripe";

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hydrated = useIsHydrated();
  const { cart, refresh } = useCart();
  const [addressId, setAddressId] = useState("");
  const [addresses, setAddresses] = useState<Array<{ id: string; fullName: string; line1: string; city: string; state: string; postalCode: string | null; country: string; phone: string | null }>>([]);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ simulate?: boolean; message?: string } | null>(null);
  const [inlineAddress, setInlineAddress] = useState({ fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineMsg, setInlineMsg] = useState("");

  const saveInlineAddress = async () => {
    if (!inlineAddress.fullName || !inlineAddress.phone || !inlineAddress.line1 || !inlineAddress.city || !inlineAddress.state) {
      setInlineMsg("Full name, phone, estate, city and county are required.");
      return;
    }
    setInlineBusy(true);
    setInlineMsg("");
    try {
      const created = await api.post<{ id: string; fullName: string; line1: string; line2: string | null; city: string; state: string; postalCode: string | null; country: string; phone: string | null }>(
        "/users/addresses",
        {
          fullName: inlineAddress.fullName,
          phone: inlineAddress.phone,
          line1: inlineAddress.line1,
          line2: inlineAddress.line2 || null,
          city: inlineAddress.city,
          state: inlineAddress.state,
          postalCode: inlineAddress.postalCode, // NOT NULL column — empty string is valid
          country: "KE",
          isDefault: addresses.length === 0,
        }
      );
      setAddresses((prev) => [...prev, created]);
      setAddressId(created.id);
      setMpesaPhone((p) => p || created.phone || "");
      setInlineAddress({ fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
      setInlineMsg("✓ Address saved — ready to check out.");
    } catch (err: any) {
      setInlineMsg(err?.message ?? "Could not save address.");
    } finally {
      setInlineBusy(false);
    }
  };
  const paymentRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/checkout", { replace: true });
  }, [hydrated, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get<typeof addresses>("/users/addresses")
      .then((addrs) => {
        setAddresses(addrs);
        setAddressId((prev) => prev || addrs[0]?.id || "");
        // prefill the M-Pesa phone from the first address if not set yet
        setMpesaPhone((prev) => prev || addrs[0]?.phone || "");
      })
      .catch(() => {});
  }, [user]);

  // Load Stripe.js only if a publishable key is configured AND the user picks card payment.
  useEffect(() => {
    if (!STRIPE_PK || paymentMethod !== "stripe") return;
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
      s.addEventListener("error", () => setError("Could not load Stripe.js"));
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, [paymentMethod]);

  const subtotal = cart?.subtotalCents ?? 0;
  const expressFlat = 30000; // KES 300
  const shippingCents = shippingMethod === "express" ? expressFlat : (subtotal - discountCents) >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS;
  const taxCents = Math.round((subtotal - discountCents) * TAX_RATE);
  const totalCents = subtotal - discountCents + shippingCents + taxCents;

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const res = await api.get<{ valid: boolean; reason?: string; coupon?: { type: string; value: number } }>(
        `/coupons/validate?code=${encodeURIComponent(coupon.trim())}&subtotalCents=${subtotal}`
      );
      if (res.valid && res.coupon) {
        const d = res.coupon.type === "percent" ? Math.round((subtotal * res.coupon.value) / 100) : Math.round(res.coupon.value);
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
    setResult(null);
    try {
      const order = await api.post<{ id: string; number: string }>("/orders", { addressId, couponCode: coupon.trim() || null, shippingMethod });

      if (paymentMethod === "mpesa") {
        const phone = mpesaPhone.trim() || addresses.find((a) => a.id === addressId)?.phone || "";
        const res = await api.post<{ ok: boolean; simulate?: boolean; receipt?: string; message?: string }>(
          "/payments/mpesa/stk-push",
          { orderId: order.id, phone }
        );
        setResult({ simulate: res.simulate, message: res.message });
        await refresh();
        if (res.simulate === false) {
          // Stay — customer needs to approve on phone; navigate to a polling state
          return;
        }
        navigate(`/checkout/success?orderId=${order.id}`);
        return;
      }

      // Stripe path
      if (paymentMethod === "stripe" && STRIPE_PK && stripeRef.current && elementsRef.current) {
        const intent = await api.post<{ clientSecret: string | null }>(`/payments/orders/${order.id}/create-intent`);
        if (intent.clientSecret) {
          const res = await stripeRef.current.confirmPayment({ elements: elementsRef.current, clientSecret: intent.clientSecret, redirect: "if_required" });
          if (res.error) throw new Error(res.error.message ?? "Payment failed");
        }
        await api.post(`/payments/orders/${order.id}/confirm`);
      } else {
        // marketplace default fallback (mock) — kept for completeness
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

  if (!hydrated || !user) return <div className="py-16 text-center text-gray-500">Loading your session…</div>;
  if (!cart) return <div className="py-16 text-center text-gray-500">Loading your cart…</div>;
  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Your cart is empty.</p>
        <Link to="/products" className="btn mt-4">Shop now</Link>
      </div>
    );
  }

  return (
    <form className="py-6" onSubmit={placeOrder} noValidate>
      <h1 className="text-2xl font-bold">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-bold">Delivery address</h2>
            <div className="mt-3 grid gap-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${addressId === a.id ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
                  <input type="radio" name="address" className="mt-1" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="text-sm"><strong>{a.fullName}</strong><br />{a.line1}<br />{a.city}, {a.state}{a.postalCode ? ` · P.O. Box ${a.postalCode}` : ""}, Kenya</span>
                </label>
              ))}

              {addresses.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-semibold">No delivery address on file.</p>
                  <p className="mt-1">Add one right here to enable checkout.</p>
                </div>
              ) : null}

              <details className="rounded-lg border border-gray-200" open={addresses.length === 0}>
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">+ Add a new delivery address</summary>
                <div className="grid grid-cols-1 gap-2 border-t border-gray-200 p-3 md:grid-cols-2">
                  <input className="input md:col-span-2" placeholder="Full name" value={inlineAddress.fullName} onChange={(e) => setInlineAddress({ ...inlineAddress, fullName: e.target.value })} required />
                  <input className="input" placeholder="Phone (+2547… or 07…)" value={inlineAddress.phone} onChange={(e) => setInlineAddress({ ...inlineAddress, phone: e.target.value })} required pattern="^(\+2547\d{8}|\+2541\d{8}|07\d{8}|01\d{8})$" />
                  <input className="input md:col-span-2" placeholder="Estate / Street / Apartment" value={inlineAddress.line1} onChange={(e) => setInlineAddress({ ...inlineAddress, line1: e.target.value })} required />
                  <input className="input" placeholder="City (e.g. Nairobi)" value={inlineAddress.city} onChange={(e) => setInlineAddress({ ...inlineAddress, city: e.target.value })} required />
                  <input className="input" placeholder="County (e.g. Nairobi)" value={inlineAddress.state} onChange={(e) => setInlineAddress({ ...inlineAddress, state: e.target.value })} required />
                  <input className="input" placeholder="P.O. Box (optional)" value={inlineAddress.postalCode} onChange={(e) => setInlineAddress({ ...inlineAddress, postalCode: e.target.value })} />
                  <input className="input" placeholder="Apt / suite (optional)" value={inlineAddress.line2} onChange={(e) => setInlineAddress({ ...inlineAddress, line2: e.target.value })} />
                  <button type="button" className="btn col-span-1 w-fit text-xs md:col-span-2" onClick={saveInlineAddress} disabled={inlineBusy}>{inlineBusy ? "Saving…" : "Save address"}</button>
                  {inlineMsg && <p className={`text-xs md:col-span-2 ${inlineMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{inlineMsg}</p>}
                </div>
              </details>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Shipping method</h2>
            <div className="mt-3 grid gap-2">
              {[
                { id: "standard", label: "Nairobi (same-day) / Countrywide (2–4 days)", cost: subtotal - discountCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS },
                { id: "express", label: "Nairobi next-day, countrywide 1–2 days", cost: 30000 },
              ].map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${shippingMethod === (m.id as any) ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
                  <span className="flex items-center gap-3 text-sm"><input type="radio" name="ship" checked={shippingMethod === (m.id as any)} onChange={() => setShippingMethod(m.id as any)} />{m.label}</span>
                  <span className="text-sm font-semibold">{m.cost === 0 ? "Free" : formatPrice(m.cost)}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">Free delivery over {formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)}. Express is dispatched same-day if ordered before 3pm EAT.</p>
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
          <div className="flex justify-between"><span>Tax (16% VAT)</span><span>{formatPrice(taxCents)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatPrice(totalCents)}</span></div>

          <fieldset className="space-y-2 pt-2">
            <legend className="text-xs font-semibold uppercase text-gray-500">Payment method</legend>
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${paymentMethod === "mpesa" ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
              <input type="radio" name="pay" checked={paymentMethod === "mpesa"} onChange={() => setPaymentMethod("mpesa")} />
              <span>
                <strong>M-Pesa — pay by phone</strong><br />
                <span className="text-xs text-gray-500">Recommended. STK push to your Safaricom line.</span>
              </span>
            </label>
            {STRIPE_PK && (
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${paymentMethod === "stripe" ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
                <input type="radio" name="pay" checked={paymentMethod === "stripe"} onChange={() => setPaymentMethod("stripe")} />
                <span>
                  <strong>Card — Visa / Mastercard</strong><br />
                  <span className="text-xs text-gray-500">Test mode with pk_test_… key.</span>
                </span>
              </label>
            )}
          </fieldset>

          {paymentMethod === "mpesa" && (
            <div className="space-y-2 border-t pt-2">
              <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="mpesa-phone">M-Pesa phone number</label>
              <input id="mpesa-phone" className="input" type="tel" placeholder="+2547... or 07..." value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} required pattern="^(\+?254|0)(7\d{8}|1\d{8})$" />
              <p className="text-xs text-gray-400">You'll receive a pop-up on this number to approve with your M-Pesa PIN.</p>
            </div>
          )}
          {paymentMethod === "stripe" && STRIPE_PK && (
            <div className="space-y-1 border-t pt-2">
              <p className="text-xs font-semibold uppercase text-gray-500">Card details</p>
              <div ref={paymentRef} className="rounded-md border border-gray-200 p-3" />
              {!stripeReady && <p className="text-xs text-gray-400">Loading secure payment form…</p>}
            </div>
          )}

          {!addressId && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              ⚠ Select or add a delivery address above to enable checkout.
            </p>
          )}

          <button type="submit" className="btn w-full py-3 text-base" disabled={!addressId || busy || (paymentMethod === "stripe" ? !stripeReady : false)}>
            {busy ? "Placing order…" : paymentMethod === "mpesa" ? `Pay ${formatPrice(totalCents)} with M-Pesa` : `Pay ${formatPrice(totalCents)}`}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {result && (
            <p className="text-xs font-medium text-green-700">
              {result.message}
              {result.simulate && <span className="block text-[10px] text-gray-400">(dev simulator — no real charge made)</span>}
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}
