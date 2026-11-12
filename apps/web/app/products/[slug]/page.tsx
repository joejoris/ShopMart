"use client";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, Product, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/store";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api.get<Product>(`/products/${slug}`),
    enabled: !!slug,
  });

  const addToCart = useMutation({
    mutationFn: () => api.post("/cart/items", { productId: product!.id, quantity: qty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const addToWishlist = useMutation({
    mutationFn: () => api.post("/users/wishlist", { productId: product!.id }),
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const postReview = useMutation({
    mutationFn: () => api.post("/reviews", { productId: product!.id, rating, comment }),
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["product", slug] }); },
  });

  if (isLoading) return <p className="py-16 text-center text-gray-500">Loading…</p>;
  if (error || !product) return <p className="py-16 text-center text-red-600">Product not found.</p>;

  const onSale = product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents;

  return (
    <div className="py-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
          {product.images[0] && (
            <Image src={product.images[0]} alt={product.title} fill sizes="50vw" className="object-cover" unoptimized priority />
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{product.category?.name}</p>
          <h1 className="mt-1 text-3xl font-bold">{product.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
            {typeof product.ratingAvg === "number" && product.ratingCount ? (
              <span>★ {product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)</span>
            ) : <span>No reviews yet</span>}
            <span>·</span>
            <span className={product.stock > 0 ? "text-green-700" : "text-red-600"}>
              {product.stock > 0 ? `In stock (${product.stock})` : "Out of stock"}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl font-extrabold">{formatPrice(product.priceCents)}</span>
            {onSale && <span className="text-xl text-gray-400 line-through">{formatPrice(product.compareAtPriceCents!)}</span>}
          </div>
          <p className="mt-4 whitespace-pre-line text-gray-700">{product.description}</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-md border border-gray-300">
              <button className="px-3 py-2" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="w-10 text-center">{qty}</span>
              <button className="px-3 py-2" onClick={() => setQty(Math.min(product.stock, qty + 1))}>+</button>
            </div>
            <button className="btn" disabled={product.stock === 0 || addToCart.isPending} onClick={() => addToCart.mutate()}>
              {addToCart.isPending ? "Adding…" : "Add to cart"}
            </button>
            <button className="btn-outline" onClick={() => (user ? addToWishlist.mutate() : router.push("/auth/login"))}>
              ♥ Wishlist
            </button>
          </div>
          {addToCart.isSuccess && (
            <p className="mt-3 text-sm font-medium text-green-700">Added to cart ✓ <button className="underline" onClick={() => router.push("/cart")}>View cart</button></p>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Reviews</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {(product.reviews ?? []).length === 0 && <p className="text-gray-500">No reviews yet. Be the first!</p>}
            {(product.reviews ?? []).map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{r.user.name}</p>
                  <p className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                </div>
                <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
                <p className="mt-2 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          <form className="card h-fit space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (!user) router.push("/auth/login"); else if (comment.trim()) postReview.mutate(); }}>
            <h3 className="font-semibold">Write a review</h3>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="input">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </select>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your thoughts…" className="input min-h-24" required />
            <button type="submit" className="btn w-full" disabled={postReview.isPending}>Submit review</button>
          </form>
        </div>
      </section>
    </div>
  );
}
