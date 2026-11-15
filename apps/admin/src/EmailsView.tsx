import { useEffect, useState } from "react";
import { api } from "./api";

type OutboxRow = { id: string; toEmail: string; subject: string; status: string; error: string | null; createdAt: string };

export function EmailsView() {
  const [emails, setEmails] = useState<OutboxRow[] | null>(null);

  useEffect(() => {
    const load = () => api.get<OutboxRow[]>("/admin/emails").then(setEmails).catch(() => setEmails([]));
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="content-h">
        <div>
          <h1>Email outbox</h1>
          <p className="sub">Auto-refreshing every 5s. In dev these are also logged to the API console.</p>
        </div>
        <span className="badge badge-ok">Live</span>
      </div>
      <section className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>To</th><th>Subject</th><th>Status</th><th>Sent</th></tr>
            </thead>
            <tbody>
              {(emails ?? []).map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{e.toEmail}</td>
                  <td><b>{e.subject}</b>{e.error && <div style={{ color: "#b91c1c", fontSize: 12 }}>{e.error}</div>}</td>
                  <td><span className={`badge ${e.status === "sent" ? "badge-ok" : e.status === "failed" ? "badge-danger" : "badge-warn"}`}>{e.status}</span></td>
                  <td>{new Date(e.createdAt).toLocaleString("en-KE")}</td>
                </tr>
              ))}
              {emails && emails.length === 0 && <tr><td colSpan={4} className="state">No emails sent yet.</td></tr>}
              {!emails && <tr><td colSpan={4} className="state">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
