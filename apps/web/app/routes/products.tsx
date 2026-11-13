import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { serverGet } from "@/lib/server";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/api";

type ProductList = { items: Product[]; total: number; page: number; pageSize: number; totalPages: number };
type Category = { id: string; name: string; slug: string };

export function meta() {
  return [{ title: "Shop — ShopMart" }, { name: "description", content: "Browse the full ShopMart catalog." }];
}

export type LoaderData = {
  products: ProductList;
  categories: Category[];
  q: string | null;
  category: string | null;
  sort: string | null;
  minPrice: string | null;
  maxPrice: string | null;
};

export async function loader({ request }: { request: Request }): Promise<LoaderData> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const sort = url.searchParams.get("sort");
  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");
  const page = Number(url.searchParams.get("page") ?? "1");

  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (category) sp.set("category", category);
  if (sort) sp.set("sort", sort);
  sp.set("page", String(Math.max(1, page || 1)));
  if (minPrice) sp.set("minPriceCents", String(Math.round(Number(minPrice) * 100)));
  if (maxPrice) sp.set("maxPriceCents", String(Math.round(Number(maxPrice) * 100)));

  const [products, categories] = await Promise.all([
    serverGet<ProductList>(`/products?${sp.toString()}`).catch(() => ({ items: [], total: 0, page: 1, pageSize: 12, totalPages: 0 })),
    serverGet<Category[]>(`/categories`).catch(() => [] as Category[]),
  ]);
  return { products, categories, q, category, sort, minPrice, maxPrice };
}

export default function ProductsPage({ loaderData }: { loaderData: LoaderData }) {
  const { products, categories, q, category, sort, minPrice, maxPrice } = loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [min, setMin] = useState(minPrice ?? "");
  const [max, setMax] = useState(maxPrice ?? "");

  const page = Number(searchParams.get("page") ?? "1");

  const update = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams);
    if (value) sp.set(key, value); else sp.delete(key);
    if (key !== "page") sp.delete("page");
    navigate(`/products?${sp.toString()}`);
  };

  const applyPrice = (e: FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams(searchParams);
    if (min) sp.set("minPrice", min); else sp.delete("minPrice");
    if (max) sp.set("maxPrice", max); else sp.delete("maxPrice");
    sp.delete("page");
    navigate(`/products?${sp.toString()}`);
  };

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">{q ? `Results for “${q}”` : category ? `Category: ${category}` : "All products"}</h1>
      <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card h-fit space-y-5 p-4 text-sm">
          <div>
            <p className="mb-2 font-semibold">Category</p>
            <div className="space-y-1">
              <button onClick={() => update("category", "")} className={`block hover:text-brand-700 ${!category ? "font-semibold text-brand-700" : ""}`}>All</button>
              {categories.map((c) => (
                <button key={c.id} onClick={() => update("category", c.slug)} className={`block hover:text-brand-700 ${category === c.slug ? "font-semibold text-brand-700" : ""}`}>{c.name}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold">Price (USD)</p>
            <form className="flex items-center gap-2" onSubmit={applyPrice}>
              <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="Min" type="number" className="input w-20" aria-label="Minimum price" />
              <span>–</span>
              <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max" type="number" className="input w-20" aria-label="Maximum price" />
              <button className="btn px-3">Go</button>
            </form>
          </div>
          <div>
            <p className="mb-2 font-semibold">Sort</p>
            <select value={sort ?? ""} onChange={(e) => update("sort", e.target.value)} className="input" aria-label="Sort products">
              <option value="">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="popular">Most popular</option>
            </select>
          </div>
        </aside>

        <div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {products.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {products.items.length === 0 && <p className="py-10 text-center text-gray-500">No products found.</p>}
          {products.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => update("page", String(page - 1))} className="btn-outline">Prev</button>
              <span className="text-sm text-gray-600">Page {products.page} of {products.totalPages}</span>
              <button disabled={page >= products.totalPages} onClick={() => update("page", String(page + 1))} className="btn-outline">Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
