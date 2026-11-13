import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { serverGet } from "@/lib/server";
import { formatPrice, api, type Product } from "@/lib/api";
import { useCart } from "@/components/CartContext";
import { useIsHydrated } from "@/lib/store";

type Review = { id: string; rating: number; comment: string; createdAt: string; verifiedPurchase?: boolean; user: { name: string } };
export type DetailData = Product & { reviews?: Review[]; ratingAvg?: number; ratingCount?: number };

export function meta({ data }: { data?: DetailData }) {
  return [
    { title: data ? `${data.title} — ShopMart` : "Product — ShopMart" },
    { name: "description", content: data?.description ?? "ShopMart product" },
  ];
}

export async function loader({ params }: { params: { slug?: string } }): Promise<DetailData | null> {
  if (!params.slug) return null;
  try {
    return await serverGet<DetailData>(`/products/${params.slug}`);
  } catch (e) {
    // 404 → product doesn't exist → render the not-found page.
    // Any other failure (API down, 500) → let the route error boundary handle it.
    if (e instanceof Error && /404/.test(e.message)) return null;
    throw e;
  }
}

export default function ProductDetail({ loaderData }: { loaderData: DetailData | null }) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const hydrated = useIsHydrated();
  const [qty, setQty] = useState(1);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewBusy, setReviewBusy] = useState(false);

  if (!loaderData) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Product not found.</p>
        <a href="/products" className="btn mt-4">Back to shop</a>
      </div>
    );
  }

  const product = loaderData;
  const onSale = product.compareAtPriceCents != null && product.compareAtPriceCents > product.priceCents;
  const image = product.images[0];

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    setReviewBusy(true);
    try {
      await api.post("/reviews", { productId: product.id, rating, comment });
      setComment("");
      navigate(`/products/${product.slug}`, { replace: true });
    } catch (err: any) {
      alert(err?.message ?? "Could not submit review");
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="py-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
          {image && <img src={image} alt={product.title} className="h-full w-full object-cover" />}
          {onSale && <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Sale</span>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{product.category?.name}</p>
          <h1 className="mt-1 text-3xl font-bold">{product.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
            {product.ratingCount ? <span>★ {product.ratingAvg?.toFixed(1)} ({product.ratingCount} reviews)</span> : <span>No reviews yet</span>}
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
            <button className="btn" disabled={product.stock === 0 || !hydrated} onClick={() => addItem(product.id, qty)}>Add to cart</button>
          </div>
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
                  <p className="font-semibold">{r.user.name} {r.verifiedPurchase && <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-800 align-middle">Verified buyer</span>}</p>
                  <p className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                </div>
                <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
                <p className="mt-2 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          <form className="card h-fit space-y-3 p-4" onSubmit={submitReview}>
            <h3 className="font-semibold">Write a review</h3>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="input" aria-label="Rating">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
            </select>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your thoughts…" className="input min-h-24" required aria-label="Review comment" />
            <button type="submit" className="btn w-full" disabled={reviewBusy}>{reviewBusy ? "Submitting…" : "Submit review"}</button>
          </form>
        </div>
      </section>
    </div>
  );
}
