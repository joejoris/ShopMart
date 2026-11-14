import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

export function meta() {
  return [{ title: "Admin — Emails" }];
}

type OutboxRow = { id: string; toEmail: string; subject: string; status: string; error: string | null; createdAt: string };

export default function AdminEmails() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<OutboxRow[]>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const load = () => api.get<OutboxRow[]>("/admin/emails").then(setEmails).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [user]);

  if (user?.role !== "admin") {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Email outbox</h1>
        <p className="text-sm text-slate-500">Transactional emails — confirmations, paid notices, verification, resets. In dev they log to the API console.</p>
      </header>
      <div className="card overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>{["To", "Subject", "Status", "Sent"].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {emails.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-2 font-mono text-xs">{e.toEmail}</td>
              <td className="px-4 py-2 font-medium">{e.subject}</td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${e.status === "sent" ? "bg-green-100 text-green-800" : e.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{e.status}</span>
                {e.error && <p className="mt-1 text-xs text-red-600">{e.error}</p>}
              </td>
              <td className="px-4 py-2 text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {emails.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No emails sent yet.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
