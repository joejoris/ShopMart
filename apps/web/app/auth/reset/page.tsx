"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ ok: false, text: "Passwords do not match" });
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; message?: string }>("/auth/reset-password", { token, password });
      if (res.ok) {
        setMessage({ ok: true, text: "Password updated! Redirecting to sign in…" });
        setTimeout(() => router.replace("/auth/login"), 1500);
      } else {
        setMessage({ ok: false, text: res.message ?? "Invalid or expired reset link" });
      }
    } catch (err: any) {
      setMessage({ ok: false, text: err.message ?? "Could not reset the password" });
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-xl font-bold">Missing reset token</h1>
        <p className="mt-2 text-sm text-gray-500">Open the reset link from your email again, or request a new one.</p>
        <Link href="/auth/forgot-password" className="btn mt-4">Request reset link</Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input className="input" type="password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        <input className="input" type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
        {message && <p className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500"><Link href="/auth/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
    </div>
  );
}

export default function ResetPage() {
  return (
    <div className="mx-auto max-w-md py-16">
      <Suspense fallback={<div className="py-10 text-center text-gray-500">Loading…</div>}>
        <ResetInner />
      </Suspense>
    </div>
  );
}
