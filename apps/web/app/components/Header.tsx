"use client";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { clearTokens, getToken } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";
import { useCart } from "@/components/CartContext";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const hydrated = useIsHydrated();
  const { cart } = useCart();
  const [q, setQ] = useState("");

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : "/products");
  };

  // Keep the search box in sync with the URL when navigating directly.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQ(params.get("q") ?? "");
  }, [location.search]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-brand-900">
          Shop<span className="text-brand-600">Mart</span>
        </Link>
        <form onSubmit={onSearch} className="hidden flex-1 md:flex">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, brands and more…"
            className="input rounded-r-none"
            aria-label="Search products"
          />
          <button className="btn rounded-l-none" aria-label="Search">Search</button>
        </form>
        <nav className="ml-auto flex items-center gap-3 text-sm font-medium">
          {hydrated && user?.role === "admin" && (
            <Link to="/admin" className="hidden rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 sm:block">Admin</Link>
          )}
          {hydrated ? (
            user ? (
              <>
                <Link to="/account/orders" className="hidden rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 sm:block">Orders</Link>
                <button
                  className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100"
                  onClick={() => { clearTokens(); logout(); navigate("/"); }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/auth/login" className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100">Sign in</Link>
            )
          ) : (
            <span className="inline-block h-6 w-16 animate-pulse rounded-md bg-gray-100" aria-hidden="true" />
          )}
          <Link to="/wishlist" className="hidden rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 sm:block">Wishlist</Link>
          <Link to="/cart" className="relative rounded-md px-2 py-1 text-gray-900 hover:bg-gray-100">
            Cart
            {cart && cart.itemCount > 0 && (
              <span className="absolute -right-2 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {cart.itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
      <form onSubmit={onSearch} className="flex gap-0 px-4 pb-2 md:hidden">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="input rounded-r-none" aria-label="Search products" />
        <button className="btn rounded-l-none">Go</button>
      </form>
    </header>
  );
}
