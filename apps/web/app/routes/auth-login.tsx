import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api, setTokens } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useCart } from "@/components/CartContext";

export function meta() {
  return [{ title: "Sign in — ShopMart" }];
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const { setUser } = useAuth();
  const { refresh } = useCart();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", { email, password });
      setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      await api.post("/cart/merge");
      await refresh();
      navigate(next);
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
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Password" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-3 text-center text-sm"><Link to="/auth/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link></p>
        <p className="mt-1 text-center text-sm text-gray-500">No account? <Link to="/auth/register" className="text-brand-700 hover:underline">Register</Link></p>
      </div>
    </div>
  );
}
