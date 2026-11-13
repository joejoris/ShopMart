import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "@/lib/api";

export function meta() {
  return [{ title: "Verify email — ShopMart" }];
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
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
    <div className="mx-auto max-w-md py-16">
      <div className="card p-6 text-center">
        {busy && <p className="text-gray-500">Verifying your email…</p>}
        {!busy && result?.ok && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
            <h1 className="mt-3 text-2xl font-bold">Email verified!</h1>
            <p className="mt-2 text-sm text-gray-500">Thanks for confirming your address.</p>
            <Link to="/" className="btn mt-5">Continue shopping</Link>
          </>
        )}
        {!busy && result && !result.ok && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">✕</div>
            <h1 className="mt-3 text-2xl font-bold">Verification failed</h1>
            <p className="mt-2 text-sm text-gray-500">{result.message ?? "This link is invalid or expired."}</p>
            <Link to="/account" className="btn mt-5">Go to account</Link>
          </>
        )}
      </div>
    </div>
  );
}
