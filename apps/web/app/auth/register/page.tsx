"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api, setTokens } from "@/lib/api";
import { useAuth } from "@/lib/store";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/register", { name, email, password });
      setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Create account</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Creating…" : "Register"}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">Already have an account? <Link href="/auth/login" className="text-brand-700 hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
