"use client";

import Link from "next/link";

import { useAdminOverview } from "@/components/dashboard/AdminOverviewProvider";
import type { AdminOverviewPayload } from "@/lib/client/fetch-admin-overview";

type Payment = AdminOverviewPayload["recentPayments"][number];

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function planKindLabel(kind: string | null): string {
  if (kind === "long_term") return "Long-term (main hall)";
  if (kind === "short_term") return "Short-term (row hall)";
  if (!kind) return "Membership";
  return kind.replace(/_/g, " ");
}

function planKindMeta(kind: string | null): { title: string; sub: string } {
  if (kind === "long_term") return { title: "Long term", sub: "Main hall" };
  if (kind === "short_term") return { title: "Short term", sub: "Row hall" };
  if (!kind) return { title: "—", sub: "" };
  const title = kind.replace(/_/g, " ");
  return { title, sub: "" };
}

function latestPaymentTone(status: string) {
  const s = status.toLowerCase();
  if (s === "paid") {
    return {
      shell: "border-emerald-200 bg-emerald-50/70",
      cell: "border-emerald-100/80 bg-white/70",
      label: "text-emerald-700",
    };
  }
  if (s === "pending") {
    return {
      shell: "border-amber-200 bg-amber-50/70",
      cell: "border-amber-100/80 bg-white/70",
      label: "text-amber-800",
    };
  }
  if (s === "failed") {
    return {
      shell: "border-ink-200 bg-ink-100/80",
      cell: "border-ink-200/80 bg-ink-50/90",
      label: "text-ink-500",
    };
  }
  return {
    shell: "border-ink-100 bg-ink-50/50",
    cell: "border-ink-100 bg-white/70",
    label: "text-ink-500",
  };
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberDisplayName(memberLabel: string): string {
  return memberLabel.replace(/\s*\(#\d+\)\s*$/, "").trim() || memberLabel;
}

function deviceUserIdTag(deviceUserId: number | null): string {
  if (deviceUserId == null || !Number.isFinite(deviceUserId)) return "—";
  return `Device user id :${String(deviceUserId).padStart(4, "0")}`;
}

function PaymentStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-ink-100 text-ink-700";
  if (s === "paid") cls = "bg-emerald-100 text-emerald-800";
  else if (s === "pending") cls = "bg-amber-100 text-amber-900";
  else if (s === "failed") cls = "bg-ink-200 text-ink-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function pickLatestPayment(rows: Payment[]): Payment | null {
  if (rows.length === 0) return null;
  return rows.find((p) => p.status.toLowerCase() === "paid") ?? rows[0];
}

export default function AdminLatestPaymentOverview() {
  const { data, error } = useAdminOverview();
  const latest = data ? pickLatestPayment(data.recentPayments) : null;
  const more = data ? data.recentPayments.filter((p) => p.id !== latest?.id).slice(0, 3) : [];
  const tone = latest ? latestPaymentTone(latest.status) : latestPaymentTone("");
  const planMeta = latest ? planKindMeta(latest.plan_kind) : null;

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Latest payment</p>
          <p className="mt-1 text-sm text-ink-600">Most recent charge on file. Updates with overview.</p>
        </div>
        <Link href="/dashboard/payments" className="text-xs font-medium text-azure-600 hover:text-azure-700">
          All payments →
        </Link>
      </div>

      {error && !data ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}

      <div
        className={`mt-5 grid min-h-[7.5rem] gap-3 rounded-xl border p-3 sm:grid-cols-3 ${
          latest ? tone.shell : "border-ink-100 bg-ink-50/50"
        }`}
      >
        <div className={`rounded-xl border px-4 py-3 ${latest ? tone.cell : "border-ink-100 bg-ink-50/50"}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${latest ? tone.label : "text-ink-500"}`}>
            Amount
          </p>
          {latest ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-2xl font-semibold tabular-nums text-ink-900">{formatInr(latest.amount_rupees)}</p>
              <p className="max-w-[9rem] text-right text-xs font-medium leading-snug text-ink-600">
                {latest.payment_how}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">—</p>
          )}
        </div>
        <div className={`rounded-xl border px-4 py-3 ${latest ? tone.cell : "border-ink-100 bg-ink-50/50"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${latest ? tone.label : "text-ink-500"}`}>
                Member
              </p>
              {latest ? (
                <>
                  <p className="mt-1 truncate text-sm font-medium text-ink-900">{memberDisplayName(latest.member_label)}</p>
                  <p className="mt-0.5 text-[10px] text-ink-500">{deviceUserIdTag(latest.device_user_id)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-ink-500">
                  {data && data.recentPayments.length === 0 ? "No payments yet." : "—"}
                </p>
              )}
            </div>
            {latest ? (
              <div className="shrink-0 text-right">
                <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.label}`}>Plan</p>
                <p className="mt-1 text-xs font-medium text-ink-900">{planMeta.title}</p>
                {planMeta.sub ? <p className="mt-0.5 text-[10px] text-ink-500">{planMeta.sub}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${latest ? tone.cell : "border-ink-100 bg-ink-50/50"}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${latest ? tone.label : "text-ink-500"}`}>
            When
          </p>
          {latest ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 text-sm font-medium text-ink-900">{formatWhen(latest.created_at)}</p>
              <PaymentStatusPill status={latest.status} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-500">—</p>
          )}
        </div>
      </div>

      <ul className="mt-5 min-h-[5.5rem] space-y-2">
        {more.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{memberDisplayName(p.member_label)}</p>
              <p className="truncate text-[10px] text-ink-500">
                {deviceUserIdTag(p.device_user_id)} · {p.payment_how}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1">
              <span className="font-semibold tabular-nums text-ink-900">{formatInr(p.amount_rupees)}</span>
              <PaymentStatusPill status={p.status} />
            </div>
          </li>
        ))}
        {data && data.recentPayments.length === 0 ? (
          <li className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-xs text-ink-500">
            No payments recorded yet.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
