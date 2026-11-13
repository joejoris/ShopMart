import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "@/lib/api";
import { useAuth, useIsHydrated } from "@/lib/store";

export function meta() {
  return [{ title: "My account — ShopMart" }];
}

export default function Account() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const hydrated = useIsHydrated();
  const [me, setMe] = useState<{ name: string; email: string; emailVerified: boolean } | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (hydrated && !user) navigate("/auth/login?next=/account", { replace: true });
  }, [hydrated, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get<{ name: string; email: string; emailVerified: boolean }>("/users/me")
      .then(setMe)
      .catch(() => {});
  }, [user]);

  const resend = async () => {
    try {
      await api.post("/auth/resend-verification");
      setResent(true);
    } catch {}
  };

  if (!hydrated || !user) {
    return <div className="py-16 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">My account</h1>
      <div className="card mt-4 p-6">
        <p className="text-lg font-semibold">{me?.name ?? user.name}</p>
        <p className="text-gray-500">{me?.email ?? user.email}</p>
        <p className="mt-1 text-xs uppercase text-gray-400">Role: {user.role}</p>
        <div className="mt-3">
          {me?.emailVerified ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">✓ Email verified</span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Email not verified</span>
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={resend} disabled={resent}>
                {resent ? "Verification email sent ✓" : "Resend verification email"}
              </button>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/account/orders" className="btn-outline">My orders</Link>
          <Link to="/wishlist" className="btn-outline">Wishlist</Link>
          {user.role === "admin" && <Link to="/admin" className="btn">Admin dashboard</Link>}
        </div>
      </div>
    </div>
  );
}
