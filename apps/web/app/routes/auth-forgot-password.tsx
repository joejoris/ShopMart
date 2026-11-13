import { FormEvent, useState } from "react";
import { Link } from "react-router";
import { api } from "@/lib/api";

export function meta() {
  return [{ title: "Forgot password — ShopMart" }];
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch {
      // Endpoint always succeeds; show generic message regardless.
    } finally {
      setSent(true);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card p-6">
        {!sent ? (
          <>
            <h1 className="text-2xl font-bold">Forgot password?</h1>
            <p className="mt-1 text-sm text-gray-500">Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
              <button type="submit" className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
            </form>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✉</div>
            <h1 className="mt-3 text-center text-xl font-bold">Check your inbox</h1>
            <p className="mt-2 text-center text-sm text-gray-500">If that email is registered, a reset link is on its way (valid for 1 hour).</p>
          </>
        )}
        <p className="mt-4 text-center text-sm text-gray-500"><Link to="/auth/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
