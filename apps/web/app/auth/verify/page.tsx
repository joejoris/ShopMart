"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!token) {
      setResult({ ok: false, message: "Missing verification token" });
      setBusy(false);
      return;
    }
    api.post<{ ok: boolean; message?: string }>("/auth/verify-email", { token })
      .then((r) => setResult(r))
      .catch((e) => setResult({ ok: false, message: e.message }))
      .finally(() => setBusy(false));
  }, [token]);

  return (
    <div className="card p-6 text-center">
      {busy && <p className="text-gray-500">Verifying your email…</p>}
      {!busy && result?.ok && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
          <h1 className="mt-3 text-2xl font-bold">Email verified!</h1>
          <p className="mt-2 text-sm text-gray-500">Thanks for confirming your address. You&apos;re all set.</p>
          <Link href="/" className="btn mt-5">Continue shopping</Link>
        </>
      )}
      {!busy && result && !result.ok && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">✕</div>
          <h1 className="mt-3 text-2xl font-bold">Verification failed</h1>
          <p className="mt-2 text-sm text-gray-500">{result.message ?? "This link is invalid or expired."}</p>
          <Link href="/account" className="btn mt-5">Go to account</Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-md py-16">
      <Suspense fallback={<div className="py-10 text-center text-gray-500">Loading…</div>}>
        <VerifyInner />
      </Suspense>
    </div>
  );
}
