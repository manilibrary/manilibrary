"use client";

import { useMemo, useState } from "react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  daysUntil,
  formatCurrency,
  formatDate,
  planName,
  type Member,
} from "@/lib/members";

type Filter = "all" | "active" | "expired" | "due";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "due", label: "Payment due" },
];

export default function MembersTable({ members }: { members: Member[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const q = query.trim().toLowerCase();
      const matchesQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.seatNo.toLowerCase().includes(q);

      if (!matchesQ) return false;

      switch (filter) {
        case "active":
          return m.status === "active";
        case "expired":
          return m.status === "expired";
        case "due":
          return m.paymentStatus === "due" || m.paymentStatus === "overdue";
        default:
          return true;
      }
    });
  }, [members, filter, query]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white shadow-card">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-ink-100 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-full border border-ink-100 bg-surface-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.id
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="relative block w-full md:max-w-sm">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, email, seat…"
            className="w-full rounded-full border border-ink-200 bg-white py-2 pl-10 pr-4 text-sm text-ink-800 placeholder-ink-400 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
          />
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <th className="px-6 py-3 font-medium">Member</th>
              <th className="px-3 py-3 font-medium">Plan</th>
              <th className="px-3 py-3 font-medium">Seat</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 font-medium">Expires</th>
              <th className="px-3 py-3 font-medium">Payment</th>
              <th className="px-6 py-3 text-right font-medium">Last paid</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-16 text-center text-sm text-ink-500"
                >
                  No members match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const d = daysUntil(m.expiryDate);
                const isExpired = m.status === "expired";
                return (
                  <tr
                    key={m.id}
                    className="border-b border-ink-50 last:border-0 transition-colors hover:bg-surface-muted"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">
                            {m.name}
                          </p>
                          <p className="truncate font-mono text-[11px] text-ink-500">
                            {m.id} · {m.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-ink-700">
                      {planName(m.plan)}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-ink-600">
                      {m.seatNo}
                    </td>
                    <td className="px-3 py-3.5 text-ink-600">
                      {formatDate(m.joinDate)}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-ink-700">
                          {formatDate(m.expiryDate)}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest ${
                            isExpired
                              ? "text-ink-900"
                              : d <= 7
                              ? "text-azure-600"
                              : "text-ink-400"
                          }`}
                        >
                          {isExpired
                            ? `expired ${Math.abs(d)}d ago`
                            : d <= 0
                            ? "expires today"
                            : `in ${d} days`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <PaymentBadge status={m.paymentStatus} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <p className="font-mono font-semibold text-ink-900">
                        {formatCurrency(m.lastPayment.amount)}
                      </p>
                      <p className="font-mono text-[10px] text-ink-500">
                        {formatDate(m.lastPayment.date)}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 px-6 py-3 text-xs text-ink-500">
        <span className="font-mono">
          showing {filtered.length} of {members.length}
        </span>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid")
    return (
      <StatusBadge tone="ok" dot>
        Paid
      </StatusBadge>
    );
  if (status === "due")
    return (
      <StatusBadge tone="warn" dot>
        Due
      </StatusBadge>
    );
  return (
    <StatusBadge tone="danger" dot>
      Overdue
    </StatusBadge>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 font-mono text-xs font-semibold text-ink-700">
      {initials}
    </span>
  );
}
