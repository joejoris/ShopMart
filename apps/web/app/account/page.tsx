"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [resent, setResent] = useState(false);

  useEffect(() => { if (user === null) router.replace("/auth/login?next=/account"); }, [user, router]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ id: string; email: string; name: string; role: string; emailVerified: boolean }>("/users/me"),
    enabled: !!user,
  });

  const resend = useMutation({
    mutationFn: () => api.post("/auth/resend-verification"),
    onSuccess: () => setResent(true),
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">My account</h1>
      <div className="card mt-4 p-6">
        <p className="text-lg font-semibold">{me?.name ?? user.name}</p>
        <p className="text-gray-500">{me?.email ?? user.email}</p>
        <p className="mt-1 text-xs uppercase text-gray-400">Role: {me?.role ?? user.role}</p>
        <div className="mt-3">
          {me?.emailVerified ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">✓ Email verified</span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Email not verified</span>
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => resend.mutate()} disabled={resend.isPending || resent}>
                {resent ? "Verification email sent ✓" : "Resend verification email"}
              </button>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/account/orders" className="btn-outline">My orders</Link>
          <Link href="/wishlist" className="btn-outline">Wishlist</Link>
          {user.role === "admin" && <Link href="/admin" className="btn">Admin dashboard</Link>}
        </div>
      </div>
    </div>
  );
}
