"use client";

import { Fragment, useCallback, useMemo, useState } from "react";

import { formatDateTimeDdMmYyyy } from "@/lib/date-format";
import { TableBodySkeleton } from "@/components/ui/ContentSkeletons";
import { useStaleWhileRevalidate } from "@/hooks/useStaleWhileRevalidate";
import { fetchAdminPaymentsList } from "@/lib/client/fetch-admin-payments-list";
import { ddcKey } from "@/lib/client-data-cache";

function shortIdPreview(id: string): string {
  const s = id.trim();
  if (!s) return "—";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return `${s.slice(0, 8)}…${s.slice(-4)}`;
  }
  if (s.length <= 18) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function formatInr(amountRupees: number): string {
  return `₹${Number(amountRupees).toLocaleString("en-IN", { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

function CopyableChip({ label, value }: { label: string; value: string }) {
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
    <button
      type="button"
      onClick={() => void copy()}
      title={value}
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-azure-200 hover:bg-azure-50/50"
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      <span className="truncate font-mono text-[11px] text-ink-800">{preview}</span>
      <span className="shrink-0 text-[10px] font-medium text-azure-600">{copied ? "Copied" : "Copy"}</span>
    </button>
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
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
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

const TABLE_COLS = 7;

function PaymentsTableHeader() {
  return (
    <thead className="border-b border-ink-100 bg-surface-muted/90 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
      <tr>
        <th className="w-10 px-2 py-3" aria-label="Expand" />
        <th className="min-w-[10rem] px-4 py-3">Member</th>
        <th className="whitespace-nowrap px-4 py-3">Amount</th>
        <th className="whitespace-nowrap px-4 py-3">Status</th>
        <th className="whitespace-nowrap px-4 py-3">When</th>
        <th className="whitespace-nowrap px-4 py-3">Provider</th>
        <th className="min-w-[8rem] max-w-[16rem] px-4 py-3">Note</th>
      </tr>
    </thead>
  );
}

export default function StaffPaymentsPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: paymentsBundle,
    loading,
    revalidating,
    error,
  } = useStaleWhileRevalidate({
    cacheKey: ddcKey.adminPaymentsList(),
    fetcher: fetchAdminPaymentsList,
  });

  const rows = paymentsBundle?.rows ?? [];
  const profiles = paymentsBundle?.profiles ?? {};

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

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (error && !paymentsBundle) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm" aria-busy="true" aria-label="Loading payments">
        <table className="min-w-full text-left text-sm">
          <PaymentsTableHeader />
          <tbody className="divide-y divide-ink-100">
            <TableBodySkeleton rows={7} cols={TABLE_COLS} tdClass="px-4 py-3" />
          </tbody>
        </table>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return <p className="text-sm text-ink-600">No payment rows yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3 text-xs leading-relaxed text-ink-600">
        Amounts are in rupees (500 = ₹500). Failed checkouts may show a short reason in{" "}
        <span className="font-medium text-ink-700">Note</span>. Expand a row to copy payment or Razorpay IDs.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setStatusFilter(c.id);
              setExpandedId(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === c.id
                ? "bg-azure-600 text-white"
                : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
            }`}
          >
            {c.label}
            <span className={`ml-1.5 tabular-nums ${statusFilter === c.id ? "text-white/90" : "text-ink-400"}`}>
              {counts[c.id]}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-500">
        Showing {filtered.length} of {rows.length} payment{rows.length === 1 ? "" : "s"}
        {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
        {revalidating ? " · updating…" : ""}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <PaymentsTableHeader />
          <tbody className="divide-y divide-ink-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={TABLE_COLS} className="px-4 py-10 text-center text-sm text-ink-500">
                  No payments match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const p = profiles[r.user_id];
                const expanded = expandedId === r.id;
                const libNo = p ? String(p.device_user_id).padStart(4, "0") : null;
                const rzpPay = r.razorpay_payment_id?.trim() || "";
                const rzpOrder = r.razorpay_order_id?.trim() || "";
                const detail = r.detail?.trim() || "";

                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`text-ink-800 transition-colors ${expanded ? "bg-azure-50/30" : "hover:bg-ink-50/50"}`}
                    >
                      <td className="px-2 py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                          aria-expanded={expanded}
                          aria-label={expanded ? "Hide IDs" : "Show IDs"}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                            aria-hidden
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{p?.full_name ?? "Unknown member"}</p>
                        {libNo ? (
                          <p className="mt-0.5 font-mono text-[11px] text-ink-500">Lib. {libNo}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-ink-900">
                        {formatInr(r.amount_rupees)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PaymentStatusBadge status={r.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-600">
                        {formatDateTimeDdMmYyyy(r.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs capitalize text-ink-700">
                        {r.provider ?? "—"}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3 text-xs text-ink-600">
                        {detail ? (
                          <p className="line-clamp-2" title={detail}>
                            {detail}
                          </p>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr key={`${r.id}-detail`} className="bg-ink-50/40">
                        <td colSpan={TABLE_COLS} className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <CopyableChip label="Payment" value={r.id} />
                            <CopyableChip label="User" value={r.user_id} />
                            {rzpPay ? <CopyableChip label="RZP pay" value={rzpPay} /> : null}
                            {rzpOrder ? <CopyableChip label="RZP order" value={rzpOrder} /> : null}
                            {r.provider_payment_id?.trim() && r.provider_payment_id !== rzpPay ? (
                              <CopyableChip label="Provider ref" value={r.provider_payment_id.trim()} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
