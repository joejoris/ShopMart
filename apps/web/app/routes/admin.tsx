import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useEffect } from "react";
import { useAuth, useIsHydrated } from "@/lib/store";
import { clearTokens } from "@/lib/api";

const links = [
  { href: "/admin", label: "Overview", icon: "▦" },
  { href: "/admin/users", label: "Customers", icon: "◉" },
  { href: "/admin/products", label: "Products", icon: "▤" },
  { href: "/admin/orders", label: "Orders", icon: "⧉" },
  { href: "/admin/coupons", label: "Coupons", icon: "◍" },
  { href: "/admin/emails", label: "Email outbox", icon: "✉" },
];

export function meta() {
  return [{ title: "ShopMart Admin" }];
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, synced } = useAuth();
  const hydrated = useIsHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) navigate("/auth/login?next=/admin", { replace: true });
    else if (synced && user.role !== "admin") navigate("/", { replace: true });
  }, [hydrated, synced, user, navigate]);

  if (!hydrated || !user || !synced) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading admin…
      </div>
    );
  }

  if (user.role !== "admin") {
    return null; // the effect above redirects non-admins to the storefront
  }

  const isActive = (href: string) => (href === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-b border-slate-800 bg-slate-950 text-slate-300 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-black text-white">S</span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-wide text-white">ShopMart</span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-brand-400">Admin console</span>
            </span>
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-4">
          {links.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-brand-600 text-white shadow"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span aria-hidden className="text-base leading-none">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800 px-4 py-4 text-sm">
          <div className="flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold uppercase text-brand-300">
              {user.name?.[0] ?? "A"}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-white">{user.name}</span>
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Link to="/" className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">
              ← Back to storefront
            </Link>
            <button
              onClick={() => {
                clearTokens();
                logout();
                navigate("/");
              }}
              className="rounded-lg px-3 py-2 text-left text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
