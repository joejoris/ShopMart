"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, Cart, clearTokens } from "@/lib/api";
import { useAuth } from "@/lib/store";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [q, setQ] = useState("");
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<Cart>("/cart"),
    refetchInterval: false,
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : "/products");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-brand-900">
          Shop<span className="text-brand-600">Mart</span>
        </Link>
        <form onSubmit={onSearch} className="hidden flex-1 md:flex">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, brands and more…"
            className="input rounded-r-none"
          />
          <button className="btn rounded-l-none" aria-label="Search">Search</button>
        </form>
        <nav className="ml-auto flex items-center gap-3 text-sm font-medium">
          {user?.role === "admin" && (
            <Link href="/admin" className="hidden rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 sm:block">Admin</Link>
          )}
          {user ? (
            <>
              <Link href="/account/orders" className="hidden rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 sm:block">Orders</Link>
              <button
                className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100"
                onClick={() => { clearTokens(); logout(); router.push("/"); }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100">Sign in</Link>
          )}
          <Link href="/wishlist" className="hidden rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 sm:block">Wishlist</Link>
          <Link href="/cart" className="relative rounded-md px-2 py-1 text-gray-900 hover:bg-gray-100">
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="input rounded-r-none" />
        <button className="btn rounded-l-none">Go</button>
      </form>
    </header>
  );
}
