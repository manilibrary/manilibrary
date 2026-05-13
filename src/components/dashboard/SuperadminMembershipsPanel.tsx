"use client";

import { useCallback, useEffect, useState } from "react";

import { formatDateDdMmYyyy } from "@/lib/date-format";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

type Row = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: number | null;
  seat_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  payment_id: string | null;
  created_at: string;
  member_label?: string;
};

function formatWindow(r: Row): string {
  if (r.plan_kind === "long_term") {
    return `${formatDateDdMmYyyy(r.valid_from)} → ${formatDateDdMmYyyy(r.valid_until)}`;
  }
  return `${formatDateDdMmYyyy(r.starts_at)} → ${formatDateDdMmYyyy(r.ends_at)}`;
}

/** `datetime-local` value (local wall clock, no timezone suffix). */
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** `input type="date"` expects YYYY-MM-DD. */
function dateOnlyForInput(v: string | null): string {
  if (!v) return "";
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function SuperadminMembershipsPanel() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/superadmin/memberships?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; error?: string; items?: Row[] };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load.");
        setItems([]);
        return;
      }
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  function openDelete(r: Row) {
    setDeleteErr(null);
    setDeleteAck(false);
    setDeleteTarget(r);
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteAck(false);
    setDeleteErr(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          Filter by member # (1–4 digits)
          <input
            className="w-40 rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="e.g. 35"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
        >
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}
      {saveMsg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {saveMsg}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Seat</th>
              <th className="px-3 py-2">Window</th>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((r) => (
              <tr key={r.id} className="text-ink-800">
                <td className="px-3 py-2 font-mono text-xs">{r.plan_kind}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 font-mono">
                  {resolveMemberSeatDisplayLabel({
                    plan_kind: r.plan_kind,
                    seat_number: r.seat_number,
                    seat_label: r.seat_label,
                  })}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 font-mono text-[11px]">{formatWindow(r)}</td>
                <td className="max-w-[160px] truncate px-3 py-2 text-xs">{r.member_label ?? r.user_id}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSaveMsg(null);
                        setEdit({ ...r });
                      }}
                      className="text-xs font-semibold text-azure-600 hover:text-azure-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(r)}
                      className="text-xs font-semibold text-red-700 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !busy ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-500">
                  No rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-100 bg-white p-6 shadow-card-hover">
            <h2 className="text-lg font-semibold text-ink-900">Edit membership</h2>
            <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              Superadmin changes apply immediately in the database. The member is not notified automatically.
            </p>
            <p className="mt-2 font-mono text-[10px] text-ink-500">{edit.id}</p>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="grid gap-1">
                <span className="text-xs text-ink-600">plan_kind</span>
                <select
                  className="rounded-lg border border-ink-200 px-3 py-2"
                  value={edit.plan_kind}
                  onChange={(e) => setEdit({ ...edit, plan_kind: e.target.value })}
                >
                  <option value="short_term">short_term</option>
                  <option value="long_term">long_term</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-ink-600">status</span>
                <select
                  className="rounded-lg border border-ink-200 px-3 py-2"
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                >
                  <option value="pending_payment">pending_payment</option>
                  <option value="active">active</option>
                  <option value="expired">expired</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-ink-600">seat_number</span>
                <input
                  type="number"
                  className="rounded-lg border border-ink-200 px-3 py-2 font-mono"
                  value={edit.seat_number ?? ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      seat_number: e.target.value === "" ? null : parseInt(e.target.value, 10),
                    })
                  }
                />
              </label>
              {edit.plan_kind === "short_term" ? (
                <>
                  <p className="text-xs text-ink-500">
                    Short-term plans use a <strong className="font-medium text-ink-700">start and end date + time</strong>{" "}
                    (wall clock). Stored in the database as UTC timestamps.
                  </p>
                  <label className="grid gap-1">
                    <span className="text-xs text-ink-600">Starts at — date &amp; time</span>
                    <input
                      type="datetime-local"
                      className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                      value={isoToDatetimeLocal(edit.starts_at)}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          starts_at: datetimeLocalToIso(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-ink-600">Ends at — date &amp; time</span>
                    <input
                      type="datetime-local"
                      className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                      value={isoToDatetimeLocal(edit.ends_at)}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          ends_at: datetimeLocalToIso(e.target.value),
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="text-xs text-ink-500">
                    Long-term plans use <strong className="font-medium text-ink-700">calendar dates only</strong> (no
                    time-of-day).
                  </p>
                  <label className="grid gap-1">
                    <span className="text-xs text-ink-600">Valid from — date</span>
                    <input
                      type="date"
                      className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                      value={dateOnlyForInput(edit.valid_from)}
                      onChange={(e) => setEdit({ ...edit, valid_from: e.target.value || null })}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-ink-600">Valid until — date</span>
                    <input
                      type="date"
                      className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                      value={dateOnlyForInput(edit.valid_until)}
                      onChange={(e) => setEdit({ ...edit, valid_until: e.target.value || null })}
                    />
                  </label>
                </>
              )}
              <label className="grid gap-1">
                <span className="text-xs text-ink-600">notes</span>
                <textarea
                  rows={2}
                  className="rounded-lg border border-ink-200 px-3 py-2 text-xs"
                  value={edit.notes ?? ""}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value || null })}
                />
              </label>
            </div>
            <div className="mt-6 border-t border-red-100 pt-4">
              <p className="text-xs font-medium text-red-900">Danger zone</p>
              <p className="mt-1 text-xs text-ink-600">
                Permanently delete this membership and linked payment rows from the database.
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-red-700 underline hover:text-red-900"
                onClick={() => {
                  const row = edit;
                  setEdit(null);
                  openDelete(row);
                }}
              >
                Delete this membership…
              </button>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600"
                onClick={() => {
                  void (async () => {
                    setSaveMsg(null);
                    const res = await fetch(`/api/superadmin/memberships/${edit.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        plan_kind: edit.plan_kind,
                        status: edit.status,
                        seat_number: edit.seat_number,
                        starts_at: edit.starts_at,
                        ends_at: edit.ends_at,
                        valid_from: edit.valid_from,
                        valid_until: edit.valid_until,
                        notes: edit.notes,
                      }),
                    });
                    const j = (await res.json()) as { error?: string; ok?: boolean };
                    if (!res.ok || !j.ok) {
                      setSaveMsg(j.error ?? "Save failed.");
                      return;
                    }
                    setEdit(null);
                    setSaveMsg("Saved.");
                    void load();
                  })();
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) closeDelete();
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-red-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
          >
            <h2 id="del-title" className="text-lg font-semibold text-red-900">
              Delete membership permanently?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-700">
              This will <strong className="font-medium">remove the membership row</strong> and{" "}
              <strong className="font-medium">delete linked payment records</strong> in{" "}
              <span className="font-mono text-xs">payments</span> (rows with this{" "}
              <span className="font-mono text-xs">membership_id</span> or the membership&apos;s{" "}
              <span className="font-mono text-xs">payment_id</span>). This cannot be undone.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-ink-600">
              <li>
                Member: <span className="font-medium text-ink-900">{deleteTarget.member_label ?? deleteTarget.user_id}</span>
              </li>
              <li>
                Plan / seat:{" "}
                <span className="font-mono">
                  {deleteTarget.plan_kind} ·{" "}
                  {resolveMemberSeatDisplayLabel({
                    plan_kind: deleteTarget.plan_kind,
                    seat_number: deleteTarget.seat_number,
                    seat_label: deleteTarget.seat_label,
                  })}
                </span>
              </li>
              <li className="font-mono text-[11px]">{formatWindow(deleteTarget)}</li>
              <li className="break-all font-mono text-[10px] text-ink-500">id {deleteTarget.id}</li>
            </ul>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={deleteAck}
                onChange={(e) => setDeleteAck(e.target.checked)}
                disabled={deleteBusy}
              />
              <span>I understand this is permanent and may remove checkout / Razorpay payment history for this seat purchase.</span>
            </label>
            {deleteErr ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {deleteErr}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                onClick={closeDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || !deleteAck}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                onClick={() => {
                  void (async () => {
                    setDeleteErr(null);
                    setDeleteBusy(true);
                    try {
                      const res = await fetch(`/api/superadmin/memberships/${deleteTarget.id}`, {
                        method: "DELETE",
                      });
                      const j = (await res.json()) as { error?: string; ok?: boolean };
                      if (!res.ok || !j.ok) {
                        setDeleteErr(j.error ?? "Delete failed.");
                        return;
                      }
                      setSaveMsg("Membership and linked payments deleted.");
                      closeDelete();
                      void load();
                    } catch (e) {
                      setDeleteErr(e instanceof Error ? e.message : "Delete failed.");
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {deleteBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
