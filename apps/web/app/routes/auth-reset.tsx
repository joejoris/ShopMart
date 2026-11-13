import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "@/lib/api";

export function meta() {
  return [{ title: "Reset password — ShopMart" }];
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setResult({ ok: false, message: "Passwords do not match" });
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; message?: string }>("/auth/reset-password", { token, password });
      setResult(res);
      if (res.ok) setTimeout(() => navigate("/auth/login"), 1500);
    } catch (err: any) {
      setResult({ ok: false, message: err.message ?? "Reset failed" });
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md py-16">
        <div className="card p-6 text-center">
          <h1 className="text-xl font-bold">Missing reset token</h1>
          <p className="mt-2 text-sm text-gray-500">Open the link from your email again, or request a new one.</p>
          <Link to="/auth/forgot-password" className="btn mt-4">Request reset link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input className="input" type="password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required aria-label="New password" />
          <input className="input" type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required aria-label="Confirm password" />
          {result && <p className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`}>{result.ok ? "Password updated! Redirecting…" : result.message}</p>}
          <button type="submit" className="btn w-full" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500"><Link to="/auth/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
