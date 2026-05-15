"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useStaleWhileRevalidate } from "@/hooks/useStaleWhileRevalidate";
import { fetchAdminOverview, type AdminOverviewPayload } from "@/lib/client/fetch-admin-overview";
import { ddcKey } from "@/lib/client-data-cache";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

type Stats = {
  totalMembers: number;
  registeredAccounts: number;
  siteVisitorsUniqueAllTime: number;
  siteVisitorsUniqueToday: number;
  siteVisitorsUnique30d: number;
  sitePageViewsToday: number;
  sitePageViews30d: number;
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
  device_user_id: number | null;
};

type RecentMembership = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  created_at: string;
  member_label: string;
  device_user_id: number | null;
};

type ExpiringRow = {
  id: string;
  plan_kind: string;
  seat_number: string | number | null;
  end_label: string;
  member_label: string;
  device_user_id: number | null;
};

type ChartDay = { day: string; amountInr: number };
type ChartMem = { day: string; count: number };

type Payload = AdminOverviewPayload;

const TREND_DAYS = 14;

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function shortDayLabel(isoDay: string) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay.slice(5);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function TrendChart({
  mode,
  revenueDays,
  membershipDays,
  maxRevenue,
  maxMemberships,
}: {
  mode: "revenue" | "memberships";
  revenueDays: ChartDay[];
  membershipDays: ChartMem[];
  maxRevenue: number;
  maxMemberships: number;
}) {
  const safeMaxRev = Math.max(maxRevenue, 1);
  const safeMaxMem = Math.max(maxMemberships, 1);

  const series =
    mode === "revenue"
      ? revenueDays.map((x) => ({ label: x.day, value: x.amountInr, max: safeMaxRev }))
      : membershipDays.map((x) => ({ label: x.day, value: x.count, max: safeMaxMem }));

  const peak = mode === "revenue" ? safeMaxRev : safeMaxMem;
  const peakLabel =
    mode === "revenue" ? `${formatInr(Math.round(peak))} max / day` : `${Math.round(peak)} max / day`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Last {TREND_DAYS} days</p>
        <p className="font-mono text-[10px] text-ink-400">{peakLabel}</p>
      </div>
      <div className="relative rounded-xl border border-ink-100 bg-gradient-to-b from-white to-ink-50/80 px-2 pb-2 pt-4 sm:px-3">
        <div
          className="pointer-events-none absolute inset-x-3 top-4 bottom-10 rounded-md bg-[length:100%_25%] bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-1px),rgb(241_245_249/0.9)_calc(100%-1px))] opacity-70"
          aria-hidden
        />
        <div className="relative flex h-36 items-stretch justify-between gap-1 sm:gap-1.5">
          {series.map((pt) => {
            const h = Math.round((pt.value / pt.max) * 100);
            const barH = pt.value > 0 ? Math.max(8, h) : 4;
            return (
              <div
                key={pt.label}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${pt.label}: ${pt.value}`}
              >
                <div
                  className={
                    mode === "revenue"
                      ? "mx-auto w-full max-w-[18px] rounded-t-md bg-azure-600/90 shadow-sm transition-[height] duration-300"
                      : "mx-auto w-full max-w-[18px] rounded-t-md bg-emerald-600/88 shadow-sm transition-[height] duration-300"
                  }
                  style={{ height: `${barH}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between px-0.5 font-mono text-[9px] text-ink-400 sm:text-[10px]">
          <span className="truncate">{series[0] ? shortDayLabel(series[0].label) : "—"}</span>
          <span className="hidden truncate sm:inline">
            {series[Math.floor(series.length / 2)] ? shortDayLabel(series[Math.floor(series.length / 2)].label) : "—"}
          </span>
          <span className="truncate">{series[series.length - 1] ? shortDayLabel(series[series.length - 1].label) : "—"}</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-ink-400">Daily totals in UTC. Open Payments or Subscriptions for full history.</p>
    </div>
  );
}

export default function AdminLibraryInsights() {
  const [trendMode, setTrendMode] = useState<"revenue" | "memberships">("revenue");

  const { data, loading, revalidating, error } = useStaleWhileRevalidate<Payload>({
    cacheKey: ddcKey.adminOverview(),
    fetcher: fetchAdminOverview,
  });

  const slicedChart = useMemo(() => {
    if (!data) {
      return {
        revenue: [] as ChartDay[],
        memberships: [] as ChartMem[],
        maxRevenueInr: 1,
        maxMembershipsCreated: 1,
      };
    }
    const rev = data.chart.revenueByDay.slice(-TREND_DAYS);
    const mem = data.chart.membershipsCreatedByDay.slice(-TREND_DAYS);
    const maxRev = Math.max(1, ...rev.map((d) => d.amountInr), 1);
    const maxMem = Math.max(1, ...mem.map((d) => d.count), 1);
    return { revenue: rev, memberships: mem, maxRevenueInr: maxRev, maxMembershipsCreated: maxMem };
  }, [data]);

  if (error && !data) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-2xl border border-ink-100 bg-white" />
        <div className="h-52 animate-pulse rounded-2xl border border-ink-100 bg-white" />
      </div>
    );
  }

  if (!data) return null;

  const { stats, expiringSoon } = data;
  const pendingTone = stats.pendingPayments > 0;
  const registered = stats.registeredAccounts || stats.totalMembers;

  return (
    <div className="space-y-4">
      {revalidating ? (
        <p className="text-right text-[10px] font-medium uppercase tracking-wider text-ink-400">Updating…</p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
        <div
          className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3"
        >
          <div className="p-5 sm:border-r sm:border-ink-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Registered accounts</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{registered}</p>
            <p className="mt-1 text-xs text-ink-500">People who signed up on the website or app</p>
          </div>
          <div className="p-5 sm:border-r sm:border-ink-100 lg:border-r-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Website visitors · 30 days</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-800 tabular-nums">
              {stats.siteVisitorsUnique30d}
            </p>
            <p className="mt-1 text-xs text-ink-500">Unique browsers — includes guests who never register</p>
            <p className="mt-2 text-[11px] text-ink-400">
              Today {stats.siteVisitorsUniqueToday} · All-time {stats.siteVisitorsUniqueAllTime}
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Page views · 30 days</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{stats.sitePageViews30d}</p>
            <p className="mt-1 text-xs text-ink-500">
              Each browser once per 20 min — different visitors always count; same person counts again after 20 min
            </p>
            <p className="mt-2 text-[11px] text-ink-400">{stats.sitePageViewsToday} views today</p>
          </div>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm"
      >
        <div
          className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"
        >
          <Link
            href="/dashboard/subscriptions"
            className="group p-5 transition-colors hover:bg-ink-50/60 sm:border-r sm:border-ink-100 lg:border-r-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Active plans</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{stats.activeTotal}</p>
            <p className="mt-1 text-xs text-ink-500">
              {stats.activeLong} long · {stats.activeShort} short
            </p>
            <p className="mt-2 text-[11px] text-ink-400">
              Seats in use: {data.seatSnapshot.longTermDistinctSeats} long · {data.seatSnapshot.shortTermDistinctSeats} short
            </p>
            <p className="mt-2 text-[11px] text-ink-400">
              Roster {stats.totalMembers}
              {stats.newMemberships30d > 0 ? (
                <>
                  {" "}
                  · <span className="text-emerald-700">+{stats.newMemberships30d}</span> new (30d)
                </>
              ) : null}
            </p>
          </Link>

          <Link
            href="/dashboard/payments"
            className="group p-5 transition-colors hover:bg-ink-50/60 sm:border-r sm:border-ink-100 lg:border-r-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Income · 30 days</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-azure-800 tabular-nums">{formatInr(stats.revenue30dInr)}</p>
            <p className="mt-1 text-xs text-ink-500">{stats.paidCount30d} paid charges</p>
            <p className="mt-3 text-[11px] text-ink-400">All-time paid {formatInr(stats.totalPaidRevenueInr)}</p>
          </Link>

          <Link href="/dashboard/payments" className="group p-5 transition-colors hover:bg-ink-50/60 lg:border-r lg:border-ink-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Income · today</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{formatInr(stats.revenueTodayInr)}</p>
            <p className="mt-1 text-xs text-ink-500">{stats.paidCountToday} payments</p>
          </Link>

          <Link
            href="/dashboard/payments"
            className={`group p-5 transition-colors hover:bg-ink-50/60 ${pendingTone ? "bg-amber-50/40" : ""}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Pending</p>
            <p
              className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${pendingTone ? "text-amber-800" : "text-ink-900"}`}
            >
              {stats.pendingPayments}
            </p>
            <p className="mt-1 text-xs text-ink-500">Awaiting verify or capture</p>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Trend</p>
            <p className="mt-1 text-sm text-ink-600">Pick a metric. Bars scale to the busiest day in this window.</p>
          </div>
          <div className="inline-flex rounded-full border border-ink-200 bg-ink-50/80 p-0.5">
            <button
              type="button"
              onClick={() => setTrendMode("revenue")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                trendMode === "revenue" ? "bg-white text-azure-800 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              Revenue
            </button>
            <button
              type="button"
              onClick={() => setTrendMode("memberships")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                trendMode === "memberships" ? "bg-white text-emerald-800 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              New memberships
            </button>
          </div>
        </div>
        <div className="mt-6">
          <TrendChart
            mode={trendMode}
            revenueDays={slicedChart.revenue}
            membershipDays={slicedChart.memberships}
            maxRevenue={slicedChart.maxRevenueInr}
            maxMemberships={slicedChart.maxMembershipsCreated}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Needs attention</p>
            <p className="mt-1 text-sm text-ink-600">
              {expiringSoon.length === 0
                ? "No memberships in the expiring window."
                : `${expiringSoon.length} membership${expiringSoon.length === 1 ? "" : "s"} ending soon.`}
            </p>
          </div>
          <Link href="/dashboard/subscriptions?focus=expiring" className="text-xs font-medium text-azure-600 hover:text-azure-700">
            View all →
          </Link>
        </div>

        {expiringSoon.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-ink-100">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Library no.</th>
                  <th className="px-3 py-2">Seat</th>
                  <th className="px-3 py-2">Ends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-ink-800">
                {expiringSoon.slice(0, 5).map((m) => (
                  <tr key={m.id} className="bg-white">
                    <td className="max-w-[11rem] truncate px-3 py-2 text-xs">{m.member_label}</td>
                    <td className="px-3 py-2 text-xs capitalize">{m.plan_kind.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.device_user_id != null ? String(m.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {resolveMemberSeatDisplayLabel({ plan_kind: m.plan_kind, seat_number: m.seat_number })}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{m.end_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expiringSoon.length > 5 ? (
              <p className="border-t border-ink-100 bg-ink-50/40 px-3 py-2 text-center text-[11px] text-ink-500">
                +{expiringSoon.length - 5} more in Subscriptions
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
