import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, type Product, formatPrice } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";
import { useCart } from "@/components/CartContext";

export function meta() {
  return [{ title: "My wishlist — ShopMart" }];
}

export default function Wishlist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hydrated = useIsHydrated();
  const { addItem } = useCart();
  const [items, setItems] = useState<Array<{ id: string; product: Product }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/wishlist", { replace: true });
  }, [hydrated, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get<Array<{ id: string; product: Product }>>("/users/wishlist").then(setItems).catch(() => {});
  }, [user]);

  const remove = async (productId: string) => {
    setBusy(true);
    try {
      await api.del(`/users/wishlist/${productId}`);
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || !user) {
    return <div className="py-16 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">My wishlist</h1>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map(({ id, product }) => (
          <div key={id} className="card overflow-hidden">
            <Link to={`/products/${product.slug}`} className="relative block aspect-square bg-gray-100">
              {product.images[0] && <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />}
            </Link>
            <div className="p-3">
              <Link to={`/products/${product.slug}`} className="line-clamp-2 min-h-10 text-sm font-semibold hover:underline">{product.title}</Link>
              <p className="mt-1 font-bold">{formatPrice(product.priceCents)}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn flex-1 px-2 py-1 text-xs" onClick={() => addItem(product.id, 1)}>Add</button>
                <button className="btn-outline px-2 py-1 text-xs" onClick={() => remove(product.id)} disabled={busy}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-gray-500">Nothing saved yet. <Link to="/products" className="text-brand-700 hover:underline">Discover products →</Link></p>}
    </div>
  );
}
