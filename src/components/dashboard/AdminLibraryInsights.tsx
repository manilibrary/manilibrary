"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

type Stats = {
  totalMembers: number;
  activeLong: number;
  activeShort: number;
  activeTotal: number;
  paidCountToday: number;
  revenueTodayInr: number;
  revenue30dInr: number;
  paidCount30d: number;
  totalPaidRevenueInr: number;
  pendingPayments: number;
  newMemberships30d: number;
};

type RecentPayment = {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount_rupees: number;
  status: string;
  created_at: string;
  provider: string | null;
  provider_payment_id: string | null;
  member_label: string;
};

type RecentMembership = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: number | null;
  created_at: string;
  member_label: string;
};

type ExpiringRow = {
  id: string;
  plan_kind: string;
  seat_number: number | null;
  end_label: string;
  member_label: string;
};

type ChartDay = { day: string; amountInr: number };
type ChartMem = { day: string; count: number };

type Payload = {
  stats: Stats;
  recentPayments: RecentPayment[];
  recentMemberships: RecentMembership[];
  expiringSoon: ExpiringRow[];
  chart: {
    revenueByDay: ChartDay[];
    membershipsCreatedByDay: ChartMem[];
    maxRevenueInr: number;
    maxMembershipsCreated: number;
  };
  seatSnapshot: { longTermDistinctSeats: number; shortTermDistinctSeats: number };
};

function StatCard({
  href,
  title,
  value,
  sub,
  tone,
}: {
  href?: string;
  title: string;
  value: string | number;
  sub?: string;
  tone?: "azure" | "emerald" | "amber" | "ink";
}) {
  const toneText =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "ink"
          ? "text-ink-900"
          : "text-azure-700";
  const inner = (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-colors hover:border-azure-200">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneText}`}>{value}</p>
      {sub ? <p className="mt-2 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function MiniBars({
  label,
  days,
  colorClass,
}: {
  label: string;
  days: { day: string; v: number; h: number }[];
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{label}</p>
      <p className="mt-1 text-xs text-ink-500">Last 30 calendar days (UTC).</p>
      <div className="mt-4 flex h-28 items-end gap-px">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.v}`}
            className={`min-w-0 flex-1 rounded-t ${colorClass}`}
            style={{ height: `${Math.max(4, d.h)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminLibraryInsights() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<Payload>;
        if (cancelled) return;
        if (!res.ok || !j.ok || !j.stats) {
          setErr(j.error ?? "Could not load overview.");
          return;
        }
        setData({
          stats: {
            totalMembers: j.stats.totalMembers ?? 0,
            activeLong: j.stats.activeLong ?? 0,
            activeShort: j.stats.activeShort ?? 0,
            activeTotal: j.stats.activeTotal ?? 0,
            paidCountToday: j.stats.paidCountToday ?? 0,
            revenueTodayInr: j.stats.revenueTodayInr ?? 0,
            revenue30dInr: j.stats.revenue30dInr ?? 0,
            paidCount30d: j.stats.paidCount30d ?? 0,
            totalPaidRevenueInr: j.stats.totalPaidRevenueInr ?? 0,
            pendingPayments: j.stats.pendingPayments ?? 0,
            newMemberships30d: j.stats.newMemberships30d ?? 0,
          },
          recentPayments: j.recentPayments ?? [],
          recentMemberships: j.recentMemberships ?? [],
          expiringSoon: j.expiringSoon ?? [],
          chart: j.chart ?? {
            revenueByDay: [],
            membershipsCreatedByDay: [],
            maxRevenueInr: 1,
            maxMembershipsCreated: 1,
          },
          seatSnapshot: j.seatSnapshot ?? { longTermDistinctSeats: 0, shortTermDistinctSeats: 0 },
        });
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

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={`inc-${i}`} className="h-28 animate-pulse rounded-2xl border border-ink-100 bg-white" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-ink-100 bg-white" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-ink-100 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  const { stats, chart } = data;
  const revDays = chart.revenueByDay.map((x) => ({
    day: x.day,
    v: x.amountInr,
    h: (x.amountInr / chart.maxRevenueInr) * 100,
  }));
  const memDays = chart.membershipsCreatedByDay.map((x) => ({
    day: x.day,
    v: x.count,
    h: (x.count / chart.maxMembershipsCreated) * 100,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/dashboard/payments"
          title="Total income (paid)"
          value={`₹${stats.totalPaidRevenueInr.toLocaleString("en-IN")}`}
          sub="All time · status paid"
          tone="emerald"
        />
        <StatCard
          href="/dashboard/payments"
          title="Income — last 30 days"
          value={`₹${stats.revenue30dInr.toLocaleString("en-IN")}`}
          sub={`${stats.paidCount30d} paid charges`}
          tone="azure"
        />
        <StatCard
          href="/dashboard/payments"
          title="Income — today"
          value={`₹${stats.revenueTodayInr.toLocaleString("en-IN")}`}
          sub={`${stats.paidCountToday} payments captured`}
          tone="ink"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="/dashboard/members"
          title="Total members"
          value={stats.totalMembers}
          sub={`${stats.newMemberships30d} new memberships in 30 days`}
        />
        <StatCard
          href="/dashboard/subscriptions"
          title="Active memberships"
          value={stats.activeTotal}
          sub={`${stats.activeLong} long-term · ${stats.activeShort} short-term`}
          tone="emerald"
        />
        <StatCard
          href="/dashboard/payments"
          title="Paid charges (30 days)"
          value={stats.paidCount30d}
          sub={`₹${stats.revenue30dInr.toLocaleString("en-IN")} volume`}
          tone="azure"
        />
        <StatCard
          href="/dashboard/payments"
          title="Pending payments"
          value={stats.pendingPayments}
          sub="Waiting on verify / capture"
          tone={stats.pendingPayments > 0 ? "amber" : "ink"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MiniBars label="Paid revenue (₹)" days={revDays} colorClass="bg-azure-400/90" />
        <MiniBars
          label="Memberships created (count)"
          days={memDays}
          colorClass="bg-emerald-400/90"
        />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Seat snapshot</p>
            <p className="mt-1 text-sm text-ink-600">
              Distinct seat numbers with an active plan today (long-term calendar · short-term clock).
            </p>
          </div>
          <Link
            href="/dashboard/subscriptions"
            className="text-xs font-medium text-azure-600 hover:text-azure-700"
          >
            Subscriptions →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-100 bg-surface-muted/50 px-4 py-3">
            <p className="text-xs text-ink-500">Long-term seats</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{data.seatSnapshot.longTermDistinctSeats}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-surface-muted/50 px-4 py-3">
            <p className="text-xs text-ink-500">Short-term seats</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{data.seatSnapshot.shortTermDistinctSeats}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Recent payments</p>
            <Link href="/dashboard/payments" className="text-xs font-medium text-azure-600 hover:text-azure-700">
              All payments →
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <tr>
                  <th className="py-2 pr-2">When</th>
                  <th className="py-2 pr-2">Member</th>
                  <th className="py-2 pr-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-ink-800">
                {data.recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-xs text-ink-500">
                      No payment rows yet.
                    </td>
                  </tr>
                ) : (
                  data.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-2 font-mono text-xs whitespace-nowrap">
                        {new Date(p.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="py-2 pr-2 max-w-[10rem] truncate text-xs">{p.member_label}</td>
                      <td className="py-2 pr-2 font-mono text-xs">₹{Number(p.amount_rupees).toLocaleString("en-IN")}</td>
                      <td className="py-2 text-xs capitalize">{p.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Recent memberships</p>
            <Link
              href="/dashboard/subscriptions"
              className="text-xs font-medium text-azure-600 hover:text-azure-700"
            >
              Subscriptions →
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <tr>
                  <th className="py-2 pr-2">Created</th>
                  <th className="py-2 pr-2">Member</th>
                  <th className="py-2 pr-2">Plan</th>
                  <th className="py-2">Seat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-ink-800">
                {data.recentMemberships.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-xs text-ink-500">
                      No membership rows yet.
                    </td>
                  </tr>
                ) : (
                  data.recentMemberships.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 pr-2 font-mono text-xs whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="py-2 pr-2 max-w-[9rem] truncate text-xs">{m.member_label}</td>
                      <td className="py-2 pr-2 text-xs capitalize">{m.plan_kind.replace(/_/g, " ")}</td>
                      <td className="py-2 font-mono text-xs">
                        {resolveMemberSeatDisplayLabel({
                          plan_kind: m.plan_kind,
                          seat_number: m.seat_number,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border-2 border-amber-400 bg-amber-50/35 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700">Expiring soon</p>
            <p className="mt-1 text-xs text-ink-600">
              Long-term: <span className="font-mono">valid_until</span> within 14 days. Short-term:{" "}
              <span className="font-mono">ends_at</span> within 48 hours.
            </p>
          </div>
          <Link
            href="/dashboard/subscriptions?focus=expiring"
            className="text-xs font-medium text-azure-600 hover:text-azure-700"
          >
            Filter expiring →
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <tr>
                <th className="py-2 pr-2">Member</th>
                <th className="py-2 pr-2">Plan</th>
                <th className="py-2 pr-2">Seat</th>
                <th className="py-2">Ends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-ink-800">
              {data.expiringSoon.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-xs text-ink-500">
                    No memberships in the expiring window.
                  </td>
                </tr>
              ) : (
                data.expiringSoon.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-2 max-w-[11rem] truncate text-xs">{m.member_label}</td>
                    <td className="py-2 pr-2 text-xs capitalize">{m.plan_kind.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {resolveMemberSeatDisplayLabel({
                        plan_kind: m.plan_kind,
                        seat_number: m.seat_number,
                      })}
                    </td>
                    <td className="py-2 font-mono text-xs">{m.end_label}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
