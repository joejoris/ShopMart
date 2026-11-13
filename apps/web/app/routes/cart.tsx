import { Link } from "react-router";
import { useCart } from "@/components/CartContext";
import { formatPrice } from "@/lib/api";
import { useIsHydrated } from "@/lib/store";

export function meta() {
  return [{ title: "Your cart — ShopMart" }];
}

export default function CartPage() {
  const hydrated = useIsHydrated();
  const { cart, setQuantity, removeItem } = useCart();

  if (!hydrated) {
    return <div className="py-16 text-center text-gray-500">Loading your cart…</div>;
  }
  const items = cart?.items ?? [];

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">Your cart</h1>
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">Your cart is empty.</p>
          <Link to="/products" className="btn mt-4">Browse products</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="card flex gap-4 p-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {item.product.images[0] && (
                    <img src={item.product.images[0]} alt={item.product.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <Link to={`/products/${item.product.slug}`} className="font-semibold hover:underline">{item.product.title}</Link>
                  <p className="text-sm text-gray-500">{formatPrice(item.product.priceCents)} each</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-md border border-gray-300">
                      <button className="px-2 py-1" onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button className="px-2 py-1" onClick={() => setQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">{formatPrice(item.lineTotalCents)}</span>
                      <button className="text-sm text-red-600 hover:underline" onClick={() => removeItem(item.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="card h-fit space-y-3 p-5">
            <h2 className="text-lg font-bold">Order summary</h2>
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(cart!.subtotalCents)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Shipping</span><span>{cart!.subtotalCents >= 5000 ? "Free" : "Calculated at checkout"}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Tax</span><span>Calculated at checkout</span></div>
            <div className="border-t pt-3 flex justify-between font-bold"><span>Total</span><span>{formatPrice(cart!.subtotalCents)}</span></div>
            <Link to="/checkout" className="btn w-full">Checkout</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
