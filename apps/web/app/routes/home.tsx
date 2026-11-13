import { Link } from "react-router";
import { serverGet } from "@/lib/server";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/api";

type Category = { id: string; name: string; slug: string; imageUrl: string | null };

export function meta() {
  return [
    { title: "ShopMart — Online Store" },
    { name: "description", content: "Electronics, clothing, home & kitchen, books, and sports — delivered fast. Free shipping over $50." },
  ];
}

export async function loader() {
  const [featured, categories] = await Promise.all([
    serverGet<Product[]>("/products/featured").catch(() => null),
    serverGet<Category[]>("/categories").catch(() => null),
  ]);
  return { featured: featured ?? [], categories: categories ?? [], apiOk: featured !== null && categories !== null };
}

export default function Home({ loaderData }: { loaderData: { featured: Product[]; categories: Category[]; apiOk: boolean } }) {
  const { featured, categories, apiOk } = loaderData;
  return (
    <div className="py-6">
      {!apiOk && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The store is temporarily unavailable — the product service is unreachable. Please try again shortly.
        </div>
      )}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 via-brand-700 to-brand-600 px-6 py-14 text-white md:px-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">New season</p>
        <h1 className="mt-2 max-w-xl text-4xl font-extrabold leading-tight md:text-5xl">
          Everything you love, delivered fast.
        </h1>
        <p className="mt-4 max-w-md text-blue-100">
          Electronics, clothing, home essentials and more — with free shipping over $50.
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/products" className="btn bg-white text-brand-900 hover:bg-blue-50">Shop now</Link>
          <Link to="/products?sort=newest" className="btn-outline border-white/40 bg-transparent text-white hover:bg-white/10">New arrivals</Link>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Shop by category</h2>
          <Link to="/products" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.slug}`} className="card overflow-hidden text-center transition hover:shadow-md">
              {c.imageUrl && <img src={c.imageUrl} alt={c.name} className="h-28 w-full object-cover" />}
              <div className="p-3 text-sm font-semibold">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Featured products</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
        {featured.length === 0 && <p className="text-gray-500">No products yet.</p>}
      </section>
    </div>
  );
}
