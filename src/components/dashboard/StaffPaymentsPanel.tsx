"use client";

import { useEffect, useState } from "react";

import { formatDateTimeDdMmYyyy } from "@/lib/date-format";

function MonoTrunc({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="text-ink-500">—</span>;
  }
  const display = value.length > 22 ? `${value.slice(0, 14)}…${value.slice(-5)}` : value;
  return (
    <span className="inline-block max-w-[12rem] font-mono text-xs break-all" title={value}>
      {display}
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
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
};

export default function StaffPaymentsPanel() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ink-600">No payment rows yet.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-500">
        Amounts are stored as whole rupees in <span className="font-mono">amount_rupees</span> (e.g. 500 = ₹500).
      </p>
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="min-w-[8rem] px-4 py-3">Member name</th>
              <th className="min-w-[7rem] px-4 py-3">Member ID</th>
              <th className="px-4 py-3">Device user ID</th>
              <th className="min-w-[7rem] px-4 py-3">Razorpay payment</th>
              <th className="min-w-[7rem] px-4 py-3">Razorpay order</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const p = profiles[r.user_id];
              const inr = Number(r.amount_rupees).toFixed(2);
              return (
                <tr key={r.id} className="text-ink-800">
                  <td className="px-4 py-3">{p?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 align-top">
                    <MonoTrunc value={r.user_id} />
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {p ? String(p.device_user_id).padStart(4, "0") : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <MonoTrunc value={r.razorpay_payment_id} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <MonoTrunc value={r.razorpay_order_id} />
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {r.currency} {inr}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3 text-xs">{r.provider ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {formatDateTimeDdMmYyyy(r.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
