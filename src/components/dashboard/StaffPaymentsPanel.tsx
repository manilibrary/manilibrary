"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDateTimeDdMmYyyy } from "@/lib/date-format";
import { TableBodySkeleton } from "@/components/ui/ContentSkeletons";

function shortIdPreview(id: string): string {
  const s = id.trim();
  if (!s) return "—";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return `${s.slice(0, 8)}…${s.slice(-4)}`;
  }
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function CopyIdCell({ value, copyLabel }: { value: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  const preview = useMemo(() => shortIdPreview(value), [value]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className="w-[4.75rem] shrink-0" title={value}>
      <p className="font-mono text-[10px] leading-tight tracking-tight text-ink-800">{preview}</p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-1 inline-flex w-full justify-center rounded border border-ink-200 bg-white px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-700 hover:bg-ink-50"
        aria-label={copyLabel}
      >
        {copied ? "OK" : "Copy"}
      </button>
    </div>
  );
}

function CopyIdCellOptional({ value, copyLabel }: { value: string | null | undefined; copyLabel: string }) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return <span className="text-ink-500">—</span>;
  return <CopyIdCell value={v} copyLabel={copyLabel} />;
}

function DetailCell({ text }: { text: string | null }) {
  if (!text) {
    return <span className="text-ink-500">—</span>;
  }
  return (
    <p className="max-w-[14rem] text-xs leading-snug text-ink-700" title={text}>
      {text}
    </p>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-ink-100 text-ink-700";
  if (s === "paid") cls = "bg-emerald-100 text-emerald-800";
  else if (s === "pending") cls = "bg-azure-100 text-azure-800";
  else if (s === "failed") cls = "bg-red-100 text-red-800";
  else if (s === "refunded") cls = "bg-violet-100 text-violet-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

type PaymentRow = {
  id: string;
  user_id: string;
  amount_rupees: number;
  currency: string;
  provider: string | null;
  status: string;
  provider_payment_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  detail: string | null;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
};

type StatusFilter = "all" | "pending" | "paid" | "failed" | "refunded";

const FILTER_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

export default function StaffPaymentsPanel() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/payments/list", { cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          rows?: PaymentRow[];
          profiles?: Record<string, ProfileMini>;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setErr(j.error ?? "Could not load payments.");
          return;
        }
        setRows(j.rows ?? []);
        setProfiles(j.profiles ?? {});
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: rows.length,
      pending: 0,
      paid: 0,
      failed: 0,
      refunded: 0,
    };
    for (const r of rows) {
      const k = r.status.toLowerCase() as StatusFilter;
      if (k === "pending") c.pending += 1;
      else if (k === "paid") c.paid += 1;
      else if (k === "failed") c.failed += 1;
      else if (k === "refunded") c.refunded += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status.toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  if (err) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
    );
  }

  if (loading) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm" aria-busy="true" aria-label="Loading payments">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">Row ID</th>
              <th className="min-w-[8rem] px-4 py-3">Member name</th>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">Member ID</th>
              <th className="px-4 py-3">Library no.</th>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">RZP pay</th>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">RZP order</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="min-w-[10rem] px-4 py-3">Detail</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            <TableBodySkeleton rows={7} cols={11} tdClass="px-4 py-3" />
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ink-600">No payment rows yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">
        Amounts use <span className="font-mono">amount_rupees</span> (500 = ₹500). Failed checkouts store a{" "}
        <strong className="font-medium text-ink-600">short reason</strong> (for example &quot;Invalid card&quot;) in{" "}
        <span className="font-mono">metadata.checkout_failure</span> — use <span className="font-mono">Copy</span> for full
        IDs.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setStatusFilter(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === c.id
                ? "bg-azure-600 text-white"
                : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
            }`}
          >
            {c.label}
            <span className={`ml-1.5 tabular-nums ${statusFilter === c.id ? "text-white/90" : "text-ink-400"}`}>
              ({counts[c.id]})
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-500">
        {filtered.length} row{filtered.length === 1 ? "" : "s"}
        {statusFilter !== "all" ? ` · status = ${statusFilter}` : ""}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">Row ID</th>
              <th className="min-w-[8rem] px-4 py-3">Member name</th>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">Member ID</th>
              <th className="px-4 py-3">Library no.</th>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">RZP pay</th>
              <th className="w-[5.5rem] shrink-0 px-2 py-3">RZP order</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="min-w-[10rem] px-4 py-3">Detail</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-sm text-ink-500">
                  No rows for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const p = profiles[r.user_id];
                const inr = Number(r.amount_rupees).toFixed(2);
                return (
                  <tr key={r.id} className="text-ink-800">
                    <td className="px-2 py-3 align-top">
                      <CopyIdCell value={r.id} copyLabel="Copy payment row id" />
                    </td>
                    <td className="px-4 py-3">{p?.full_name ?? "—"}</td>
                    <td className="px-2 py-3 align-top">
                      <CopyIdCell value={r.user_id} copyLabel="Copy member user id" />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {p ? String(p.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <CopyIdCellOptional value={r.razorpay_payment_id} copyLabel="Copy Razorpay payment id" />
                    </td>
                    <td className="px-2 py-3 align-top">
                      <CopyIdCellOptional value={r.razorpay_order_id} copyLabel="Copy Razorpay order id" />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {r.currency} {inr}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <DetailCell text={r.detail ?? null} />
                    </td>
                    <td className="px-4 py-3 text-xs">{r.provider ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {formatDateTimeDdMmYyyy(r.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
