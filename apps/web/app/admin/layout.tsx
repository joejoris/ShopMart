"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/store";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/coupons", label: "Coupons" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) router.replace("/auth/login?next=/admin");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <nav className="mt-3 flex gap-2 border-b border-gray-200 pb-3 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`rounded-md px-3 py-1.5 font-medium ${pathname === l.href ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{l.label}</Link>
        ))}
      </nav>
      <div className="mt-5">{children}</div>
    </div>
  );
}
