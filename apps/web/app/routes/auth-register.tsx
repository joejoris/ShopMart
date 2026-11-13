import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, setTokens } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useCart } from "@/components/CartContext";

export function meta() {
  return [{ title: "Create account — ShopMart" }];
}

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { refresh } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/register", { name, email, password });
      setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      await refresh();
      navigate("/");
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
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required aria-label="Full name" />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
          <input className="input" type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required aria-label="Password" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn w-full" disabled={busy}>{busy ? "Creating…" : "Register"}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">Already have an account? <Link to="/auth/login" className="text-brand-700 hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
