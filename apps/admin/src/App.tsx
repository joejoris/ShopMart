import { useEffect, useState, type FormEvent } from "react";
import { api, clearTokens, getToken, setTokens, formatPrice, type AdminUser } from "./api";
import { Overview } from "./Overview";
import { OrdersView } from "./OrdersView";
import { CustomersView } from "./CustomersView";
import { ProductsView } from "./ProductsView";
import { EmailsView } from "./EmailsView";
import "./styles.css";

type Tab = "overview" | "orders" | "customers" | "products" | "emails";

const NAV: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "orders", label: "Orders", icon: "⧉" },
  { id: "customers", label: "Customers", icon: "◉" },
  { id: "products", label: "Products", icon: "▤" },
  { id: "emails", label: "Email outbox", icon: "✉" },
];

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    api
      .get<AdminUser>("/auth/me")
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setBooting(false));
  }, []);

  if (booting) return <div className="loading">Verifying admin session…</div>;
  if (!user) return <LoginGate onSuccess={setUser} />;
  if (user.role !== "admin") return <DeniedGate user={user} onSignOut={() => { clearTokens(); setUser(null); }} />;
  return <Console user={user} onSignOut={() => { clearTokens(); setUser(null); }} />;
}

/* ---------------- Login gate ---------------- */

function LoginGate({ onSuccess }: { onSuccess: (u: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: AdminUser }>("/auth/login", { email, password });
      setTokens(res.accessToken, res.refreshToken);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err?.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo-row">
          <div className="logo-badge">S</div>
          <div className="logo-text"><b>SHOPMART</b><span>Admin console</span></div>
        </div>
        <h1>Restricted area</h1>
        <p>This console is for ShopMart staff only. Customers cannot sign in here.</p>
        {error && <div className="error-box">{error}</div>}
        <input className="field" type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" aria-label="Email" />
        <input className="field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" aria-label="Password" />
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Verifying…" : "Sign in to console"}</button>
        <div className="notice">Authorized personnel only. All activity may be logged. Use the <a style={{ color: "#9ec5ff" }} href="http://localhost/">storefront</a> for shopping.</div>
      </form>
    </div>
  );
}

/* ---------------- Access denied ---------------- */

function DeniedGate({ user, onSignOut }: { user: AdminUser; onSignOut: () => void }) {
  return (
    <div className="denied">
      <div className="login-card">
        <div className="logo-row">
          <div className="logo-badge" style={{ background: "#ef4444" }}>!</div>
          <div className="logo-text"><b>ACCESS DENIED</b><span>Admin console</span></div>
        </div>
        <h1>Not an admin account</h1>
        <p><b>{user.email}</b> is a <b>{user.role}</b> account. This console is reserved for administrators.</p>
        <button className="btn-primary" style={{ marginTop: 8 }} onClick={onSignOut}>Sign out</button>
        <div className="notice"><a style={{ color: "#9ec5ff" }} href="http://localhost/">← Back to the ShopMart storefront</a></div>
      </div>
    </div>
  );
}

/* ---------------- Console ---------------- */

function Console({ user, onSignOut }: { user: AdminUser; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo-row" style={{ padding: "4px 8px" }}>
          <div className="logo-badge">S</div>
          <div className="logo-text"><b>SHOPMART</b><span>Admin console</span></div>
        </div>
        <nav>
          {NAV.map((item) => (
            <button key={item.id} className={`nav-btn ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              <span className="nav-ico">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me-row">
            <div className="me-avatar">{(user.name || user.email)[0]}</div>
            <div>
              <div className="me-name">{user.name}</div>
              <div className="me-mail">{user.email}</div>
            </div>
          </div>
          <a className="link-btn" href="http://localhost/" rel="noreferrer">↗ Open storefront</a>
          <button className="link-btn" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>

      <main className="content">
        {tab === "overview" && <Overview />}
        {tab === "orders" && <OrdersView />}
        {tab === "customers" && <CustomersView />}
        {tab === "products" && <ProductsView />}
        {tab === "emails" && <EmailsView />}
      </main>
    </div>
  );
}
