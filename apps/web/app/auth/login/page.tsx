"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { api, setTokens } from "@/lib/api";
import { useAuth } from "@/lib/store";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", { email, password });
      setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      await api.post("/cart/merge");
      router.push(next);
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Use <code>demo@example.com</code> / <code>demo1234</code> to try the demo.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">No account? <Link href="/auth/register" className="text-brand-700 hover:underline">Register</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading…</div>}><LoginInner /></Suspense>;
}
