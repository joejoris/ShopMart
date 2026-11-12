"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

type OutboxRow = { id: string; toEmail: string; subject: string; status: string; error: string | null; createdAt: string };

export default function AdminEmails() {
  const { data: emails, isLoading } = useQuery({
    queryKey: ["admin-emails"],
    queryFn: () => api.get<OutboxRow[]>("/admin/emails"),
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-gray-500">Loading…</p>;
  return (
    <div className="card overflow-auto">
      <div className="border-b px-4 py-3">
        <h2 className="font-bold">Email outbox</h2>
        <p className="text-xs text-gray-500">Transactional emails (order confirmations, status updates, verification, password resets). In dev they are logged to the API console and stored here.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>{["To", "Subject", "Status", "Sent"].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {(emails ?? []).map((e) => (
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
          {emails && emails.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No emails sent yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
