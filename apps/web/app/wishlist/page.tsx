"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api, Product, formatPrice } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";

export default function WishlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const hydrated = useIsHydrated();
  const qc = useQueryClient();
  useEffect(() => { if (!user) router.replace("/auth/login?next=/wishlist"); }, [user, router]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<Array<{ id: string; product: Product }>>("/users/wishlist"),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (productId: string) => api.del(`/users/wishlist/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
  const addToCart = useMutation({
    mutationFn: (productId: string) => api.post("/cart/items", { productId, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (!hydrated || !user) return null;
  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">My wishlist</h1>
      {isLoading && <p className="mt-4 text-gray-500">Loading…</p>}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {(items ?? []).map(({ id, product }) => (
          <div key={id} className="card overflow-hidden">
            <Link href={`/products/${product.slug}`} className="relative block aspect-square bg-gray-100">
              {product.images[0] && <Image src={product.images[0]} alt={product.title} fill className="object-cover" unoptimized />}
            </Link>
            <div className="p-3">
              <Link href={`/products/${product.slug}`} className="line-clamp-2 min-h-10 text-sm font-semibold hover:underline">{product.title}</Link>
              <p className="mt-1 font-bold">{formatPrice(product.priceCents)}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn flex-1 px-2 py-1 text-xs" onClick={() => addToCart.mutate(product.id)}>Add to cart</button>
                <button className="btn-outline px-2 py-1 text-xs" onClick={() => remove.mutate(product.id)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {items && items.length === 0 && <p className="text-gray-500">Nothing saved yet. <Link href="/products" className="text-brand-700 hover:underline">Discover products →</Link></p>}
    </div>
  );
}
