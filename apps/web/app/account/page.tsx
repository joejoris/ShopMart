"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/store";

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!user) router.replace("/auth/login?next=/account"); }, [user, router]);
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">My account</h1>
      <div className="card mt-4 p-6">
        <p className="text-lg font-semibold">{user.name}</p>
        <p className="text-gray-500">{user.email}</p>
        <p className="mt-1 text-xs uppercase text-gray-400">Role: {user.role}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/account/orders" className="btn-outline">My orders</Link>
          <Link href="/wishlist" className="btn-outline">Wishlist</Link>
          {user.role === "admin" && <Link href="/admin" className="btn">Admin dashboard</Link>}
        </div>
      </div>
    </div>
  );
}
