import { useEffect, useState } from "react";
import { api, formatPrice } from "./api";

type Product = {
  id: string;
  title: string;
  sku: string;
  priceCents: number;
  stock: number;
  status: string;
  featured: boolean;
  categoryName?: string;
};

export function ProductsView() {
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    api.get<{ items: Product[] }>("/products?pageSize=100").then((r) => setProducts(r.items)).catch(() => setProducts([]));
  }, []);

  return (
    <>
      <div className="content-h">
        <div>
          <h1>Products</h1>
          <p className="sub">{products ? `${products.length} items in the catalog` : "Loading…"}</p>
        </div>
      </div>
      <section className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Title</th><th>SKU</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th>Featured</th></tr>
            </thead>
            <tbody>
              {(products ?? []).map((p) => (
                <tr key={p.id}>
                  <td><b>{p.title}</b></td>
                  <td>{p.sku}</td>
                  <td>{p.categoryName ?? "—"}</td>
                  <td className="num">{formatPrice(p.priceCents)}</td>
                  <td className="num">{p.stock}</td>
                  <td><span className="badge badge-ok">{p.status}</span></td>
                  <td>{p.featured ? "★" : ""}</td>
                </tr>
              ))}
              {products && products.length === 0 && <tr><td colSpan={7} className="state">No products yet.</td></tr>}
              {!products && <tr><td colSpan={7} className="state">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
