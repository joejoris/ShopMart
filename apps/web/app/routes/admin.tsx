import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useEffect } from "react";
import { useAuth, useIsHydrated } from "@/lib/store";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/emails", label: "Emails" },
];

export function meta() {
  return [{ title: "Admin — ShopMart" }];
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const hydrated = useIsHydrated();

  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/admin", { replace: true });
    else if (hydrated && user && user.role !== "admin") navigate("/", { replace: true });
  }, [hydrated, user, navigate]);

  if (!hydrated || !user || user.role !== "admin") {
    return <div className="py-16 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <nav className="mt-3 flex flex-wrap gap-2 border-b border-gray-200 pb-3 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            to={l.href}
            className={`rounded-md px-3 py-1.5 font-medium ${location.pathname === l.href ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-5">
        <Outlet />
      </div>
    </div>
  );
}
