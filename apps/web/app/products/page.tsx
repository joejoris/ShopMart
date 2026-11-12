"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Product } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { Suspense, useEffect, useState } from "react";

type ProductList = { items: Product[]; total: number; page: number; totalPages: number };

function ProductsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Number(params.get("page") ?? "1");
  const [minPrice, setMinPrice] = useState(params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["products", q, category, sort, page, minPrice, maxPrice],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (category) sp.set("category", category);
      if (sort) sp.set("sort", sort);
      sp.set("page", String(page));
      if (minPrice) sp.set("minPriceCents", String(Math.round(Number(minPrice) * 100)));
      if (maxPrice) sp.set("maxPriceCents", String(Math.round(Number(maxPrice) * 100)));
      return api.get<ProductList>(`/products?${sp.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ id: string; name: string; slug: string }[]>("/categories"),
  });

  const update = (key: string, value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value); else sp.delete(key);
    if (key !== "page") sp.delete("page");
    router.push(`/products?${sp.toString()}`);
  };

  useEffect(() => { setMinPrice(params.get("minPrice") ?? ""); setMaxPrice(params.get("maxPrice") ?? ""); }, [params]);

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">{q ? `Results for “${q}”` : category ? `Category: ${category}` : "All products"}</h1>
      <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card h-fit space-y-5 p-4 text-sm">
          <div>
            <p className="mb-2 font-semibold">Category</p>
            <div className="space-y-1">
              <button onClick={() => update("category", "")} className={`block hover:text-brand-700 ${!category ? "font-semibold text-brand-700" : ""}`}>All</button>
              {(categories ?? []).map((c) => (
                <button key={c.id} onClick={() => update("category", c.slug)} className={`block hover:text-brand-700 ${category === c.slug ? "font-semibold text-brand-700" : ""}`}>{c.name}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold">Price (USD)</p>
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const sp = new URLSearchParams(params.toString()); minPrice ? sp.set("minPrice", minPrice) : sp.delete("minPrice"); maxPrice ? sp.set("maxPrice", maxPrice) : sp.delete("maxPrice"); router.push(`/products?${sp.toString()}`); }}>
              <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" type="number" className="input w-20" />
              <span>–</span>
              <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" type="number" className="input w-20" />
              <button className="btn px-3">Go</button>
            </form>
          </div>
          <div>
            <p className="mb-2 font-semibold">Sort</p>
            <select value={sort} onChange={(e) => update("sort", e.target.value)} className="input">
              <option value="">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
        </aside>

        <div>
          {isLoading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {(data?.items ?? []).map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {data && data.items.length === 0 && <p className="py-10 text-center text-gray-500">No products found.</p>}
              {data && data.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button disabled={page <= 1} onClick={() => update("page", String(page - 1))} className="btn-outline">Prev</button>
                  <span className="text-sm text-gray-600">Page {data.page} of {data.totalPages}</span>
                  <button disabled={page >= data.totalPages} onClick={() => update("page", String(page + 1))} className="btn-outline">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-500">Loading…</div>}>
      <ProductsInner />
    </Suspense>
  );
}
