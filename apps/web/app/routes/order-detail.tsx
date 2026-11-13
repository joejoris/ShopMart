import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, downloadFile, type Order, formatPrice } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";

export function meta() {
  return [{ title: "Order detail — ShopMart" }];
}

const steps = ["pending", "paid", "shipped", "delivered"];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hydrated = useIsHydrated();
  const [order, setOrder] = useState<(Order & { address: any }) | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && !user) navigate(`/auth/login?next=/account/orders/${id}`, { replace: true });
  }, [hydrated, user, navigate, id]);

  useEffect(() => {
    if (!user || !id) return;
    api.get<Order & { address: any }>(`/orders/${id}`).then(setOrder).catch(() => setOrder(null));
  }, [user, id]);

  const cancel = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api.put(`/orders/${id}/cancel`, {});
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
    } catch (e: any) {
      alert(e?.message ?? "Could not cancel");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || !user) {
    return <div className="py-16 text-center text-gray-500">Loading…</div>;
  }
  if (!order) {
    return <p className="py-16 text-center text-gray-500">Order not found.</p>;
  }

  const stepIndex = steps.indexOf(order.status);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Order {order.number}</h1>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => downloadFile(`/orders/${id}/invoice`, `${order.number}-invoice.pdf`).catch((e) => alert(e.message))}>
            ⬇ Invoice (PDF)
          </button>
          {["pending", "paid"].includes(order.status) && (
            <button className="btn-outline text-red-600" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel order"}</button>
          )}
        </div>
      </div>

      {order.status !== "cancelled" ? (
        <ol className="mt-4 flex gap-2 text-xs">
          {steps.map((s, i) => (
            <li key={s} className={`flex-1 rounded-md px-2 py-2 text-center font-semibold uppercase ${i <= stepIndex ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-500"}`}>{s}</li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">This order was cancelled.</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card divide-y">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-semibold">{i.title}</p><p className="text-xs text-gray-500">Qty {i.quantity} × {formatPrice(i.priceCents)}</p></div>
              <p className="font-semibold">{formatPrice(i.priceCents * i.quantity)}</p>
            </div>
          ))}
        </div>
        <aside className="card h-fit space-y-1 p-5 text-sm">
          <h2 className="text-lg font-bold">Summary</h2>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(order.subtotalCents)}</span></div>
          {order.discountCents > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>−{formatPrice(order.discountCents)}</span></div>}
          <div className="flex justify-between"><span>Shipping</span><span>{order.shippingCents === 0 ? "Free" : formatPrice(order.shippingCents)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{formatPrice(order.taxCents)}</span></div>
          <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{formatPrice(order.totalCents)}</span></div>
          {order.address && (
            <div className="border-t pt-2 text-gray-600">
              <p className="font-semibold text-gray-900">Deliver to</p>
              <p>{order.address.fullName}<br />{order.address.line1}<br />{order.address.city}, {order.address.state} {order.address.postalCode}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
