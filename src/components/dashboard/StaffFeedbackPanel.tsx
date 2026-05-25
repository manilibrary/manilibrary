"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { useAdminPageLoading } from "@/components/dashboard/AdminPageLoadingProvider";

type Row = {
  userId: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  deviceUserId: number;
  rating: number;
  comment: string;
  submittedAt: string | null;
  approved: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

export default function StaffFeedbackPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/feedback/list", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string; feedbacks?: Row[] };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not load feedback.");
      setRows(j.feedbacks ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useAdminPageLoading(loading);

  const setApproved = async (userId: string, approved: boolean) => {
    setBusyId(userId);
    setErr(null);
    try {
      const res = await fetch("/api/admin/feedback/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, approved }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not update approval.");
      setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, approved } : r)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update approval.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-500">Loading member feedback…</p>;
  }

  if (err) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {err}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-600">
        No member feedback yet.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li
          key={r.userId}
          className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-ink-100 bg-ink-50">
                {r.avatarUrl ? (
                  <Image
                    src={r.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-ink-400">
                    {initials(r.fullName)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{r.fullName}</p>
                <p className="truncate font-mono text-[11px] text-ink-500">{r.email ?? "—"}</p>
                <p className="font-mono text-xs text-azure-600">
                  ID {String(r.deviceUserId).padStart(4, "0")}
                </p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amber-400" aria-label={`${r.rating} out of 5 stars`}>
                  {"★".repeat(r.rating)}
                  <span className="text-ink-200">{"★".repeat(5 - r.rating)}</span>
                </span>
                {r.approved ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                    Approved
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                    Pending
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-800">{r.comment}</p>
              {r.submittedAt ? (
                <p className="mt-2 text-xs text-ink-500">
                  Submitted {new Date(r.submittedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
              {r.approved ? (
                <button
                  type="button"
                  disabled={busyId === r.userId}
                  onClick={() => void setApproved(r.userId, false)}
                  className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                >
                  {busyId === r.userId ? "…" : "Unapprove"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyId === r.userId}
                  onClick={() => void setApproved(r.userId, true)}
                  className="rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
                >
                  {busyId === r.userId ? "…" : "Approve for site"}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
